import { db } from "@/db";
import {
  billAudits,
  billLineItems,
  type BillAuditRow,
  type BillLineItemRow,
  type DataSourceType,
  type NewBillAuditRow,
  type NewBillLineItemRow,
  type ServiceType,
} from "@/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  analyzeLineItem,
  CURRENCY_CODE,
  type AnalyzedLineResult,
} from "./bill-analyzer";
import { SAMPLE_BILL_SEEDS, type SampleBillSeed } from "./sample-bills";

export interface AuditWithItems extends BillAuditRow {
  items: BillLineItemRow[];
}

export interface AuditListItem extends BillAuditRow {
  itemCount: number;
  flaggedCount: number;
  briefCount: number;
}

export interface AuditLineInput {
  rawLabel: string;
  sectionName?: string;
  amountCents: number;
  priorAmountCents?: number | null;
  userNote?: string;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

/** The classifier output that is stored alongside a bill line. */
export function derivedLineFields(analysis: AnalyzedLineResult) {
  return {
    category: analysis.category,
    plainTitle: analysis.plainTitle,
    plainExplanation: analysis.plainExplanation,
    flagLevel: analysis.flagLevel,
    flagReason: analysis.flagReason,
  };
}

/**
 * Builds the row for a new bill line. The suggested question is left empty on
 * purpose: screens generate it for the active language until the user writes
 * their own (see presentLineItem).
 */
export function buildLineItemValues(
  auditId: string,
  sortOrder: number,
  line: AuditLineInput
): NewBillLineItemRow {
  const sectionName = line.sectionName?.trim() || "General Charges";
  const priorAmountCents = line.priorAmountCents ?? null;
  const analysis = analyzeLineItem(
    {
      rawLabel: line.rawLabel,
      amountCents: line.amountCents,
      priorAmountCents,
      sectionName,
    },
    "en"
  );

  return {
    auditId,
    sortOrder,
    rawLabel: line.rawLabel,
    sectionName,
    amountCents: line.amountCents,
    priorAmountCents,
    ...derivedLineFields(analysis),
    suggestedQuestion: "",
    includeInBrief: analysis.includeInBrief,
    userNote: line.userNote?.trim() ?? "",
    resolutionStatus: analysis.includeInBrief ? "to_ask" : "open",
  };
}

async function insertAuditWithLines(
  executor: Executor,
  auditValues: NewBillAuditRow,
  lines: AuditLineInput[]
): Promise<AuditWithItems> {
  const [audit] = await executor
    .insert(billAudits)
    .values(auditValues)
    .returning();

  const lineValues = lines.map((line, index) =>
    buildLineItemValues(audit.id, index, line)
  );

  const insertedItems =
    lineValues.length > 0
      ? await executor.insert(billLineItems).values(lineValues).returning()
      : [];

  return {
    ...audit,
    items: insertedItems.sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function sampleAuditValues(seed: SampleBillSeed): NewBillAuditRow {
  return {
    title: seed.text.en.title,
    providerLabel: seed.text.en.providerLabel,
    serviceType: seed.serviceType,
    dataSource: "simulated_sample",
    sampleSlug: seed.slug,
    billingPeriodStart: seed.billingPeriodStart,
    billingPeriodEnd: seed.billingPeriodEnd,
    previousTotalCents: seed.previousTotalCents,
    currentTotalCents: seed.lines.reduce((sum, l) => sum + l.amountCents, 0),
    currency: CURRENCY_CODE,
    customerContext: seed.text.en.customerContext,
  };
}

// Arbitrary key for a Postgres advisory lock that serialises the data sync.
const DATA_SYNC_LOCK_KEY = 720411801;

async function syncStoredData(): Promise<void> {
  const currentSlugs = SAMPLE_BILL_SEEDS.map((seed) => seed.slug);

  await db.transaction(async (tx) => {
    // Only one server instance at a time, so samples are never inserted twice.
    await tx.execute(
      sql.raw(`select pg_advisory_xact_lock(${DATA_SYNC_LOCK_KEY})`)
    );

    // The tool is ringgit-only. Earlier versions labelled every audit "USD"
    // no matter what was typed, so the label is corrected here. The figures
    // themselves are left exactly as entered — nothing is converted.
    await tx
      .update(billAudits)
      .set({ currency: CURRENCY_CODE })
      .where(ne(billAudits.currency, CURRENCY_CODE));

    // Retire sample scenarios from older data sets (e.g. the US-dollar ones).
    await tx
      .delete(billAudits)
      .where(
        and(
          eq(billAudits.dataSource, "simulated_sample"),
          or(
            isNull(billAudits.sampleSlug),
            notInArray(billAudits.sampleSlug, currentSlugs)
          )
        )
      );

    const existing = await tx
      .select({ sampleSlug: billAudits.sampleSlug })
      .from(billAudits)
      .where(inArray(billAudits.sampleSlug, currentSlugs));
    const present = new Set(existing.map((row) => row.sampleSlug));

    for (const seed of SAMPLE_BILL_SEEDS) {
      if (!present.has(seed.slug)) {
        await insertAuditWithLines(tx, sampleAuditValues(seed), seed.lines);
      }
    }
  });
}

let readyPromise: Promise<void> | null = null;

/**
 * Runs once per server start (and again on the next request if it failed):
 * makes sure the current synthetic samples exist and stored audits carry the
 * ringgit currency label.
 */
export function ensureAppReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = syncStoredData().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

export async function listAudits(): Promise<AuditListItem[]> {
  await ensureAppReady();

  const audits = await db
    .select()
    .from(billAudits)
    .orderBy(
      desc(billAudits.updatedAt),
      desc(billAudits.createdAt),
      asc(billAudits.id)
    );

  if (audits.length === 0) return [];

  const allItems = await db
    .select({
      auditId: billLineItems.auditId,
      flagLevel: billLineItems.flagLevel,
      includeInBrief: billLineItems.includeInBrief,
    })
    .from(billLineItems);

  const statsMap = new Map<
    string,
    { itemCount: number; flaggedCount: number; briefCount: number }
  >();

  for (const item of allItems) {
    const stat = statsMap.get(item.auditId) ?? {
      itemCount: 0,
      flaggedCount: 0,
      briefCount: 0,
    };
    stat.itemCount += 1;
    if (item.flagLevel === "high_attention" || item.flagLevel === "review") {
      stat.flaggedCount += 1;
    }
    if (item.includeInBrief) {
      stat.briefCount += 1;
    }
    statsMap.set(item.auditId, stat);
  }

  return audits.map((a) => {
    const stat = statsMap.get(a.id) ?? {
      itemCount: 0,
      flaggedCount: 0,
      briefCount: 0,
    };
    return {
      ...a,
      ...stat,
    };
  });
}

export async function getAuditWithItems(
  id: string
): Promise<AuditWithItems | null> {
  await ensureAppReady();

  const [audit] = await db
    .select()
    .from(billAudits)
    .where(eq(billAudits.id, id))
    .limit(1);

  if (!audit) return null;

  const items = await db
    .select()
    .from(billLineItems)
    .where(eq(billLineItems.auditId, id))
    .orderBy(asc(billLineItems.sortOrder), asc(billLineItems.createdAt));

  return {
    ...audit,
    items,
  };
}

export async function recalcAuditTotal(auditId: string): Promise<number> {
  const items = await db
    .select({ amountCents: billLineItems.amountCents })
    .from(billLineItems)
    .where(eq(billLineItems.auditId, auditId));

  const total = items.reduce((sum, i) => sum + i.amountCents, 0);

  await db
    .update(billAudits)
    .set({
      currentTotalCents: total,
      updatedAt: new Date(),
    })
    .where(eq(billAudits.id, auditId));

  return total;
}

export interface CreateAuditInput {
  title: string;
  providerLabel: string;
  serviceType: ServiceType;
  dataSource: DataSourceType;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  previousTotalCents: number;
  customerContext?: string;
  rawBillText?: string;
  items: AuditLineInput[];
}

export async function createAuditWithLines(
  input: CreateAuditInput
): Promise<AuditWithItems> {
  await ensureAppReady();

  // One transaction, so a failure can never leave an audit without its lines.
  return db.transaction((tx) =>
    insertAuditWithLines(
      tx,
      {
        title: input.title,
        providerLabel: input.providerLabel,
        serviceType: input.serviceType,
        dataSource: input.dataSource,
        sampleSlug: null,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        previousTotalCents: input.previousTotalCents,
        currentTotalCents: input.items.reduce(
          (sum, l) => sum + l.amountCents,
          0
        ),
        currency: CURRENCY_CODE,
        customerContext: input.customerContext ?? "",
        rawBillText: input.rawBillText ?? "",
      },
      input.items
    )
  );
}

export async function resetSampleAudit(
  sampleSlug: string
): Promise<AuditWithItems | null> {
  const seed = SAMPLE_BILL_SEEDS.find((s) => s.slug === sampleSlug);
  if (!seed) return null;

  await ensureAppReady();

  return db.transaction(async (tx) => {
    await tx.delete(billAudits).where(eq(billAudits.sampleSlug, sampleSlug));
    return insertAuditWithLines(tx, sampleAuditValues(seed), seed.lines);
  });
}
