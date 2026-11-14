import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { billAudits, billLineItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildLineItemValues, recalcAuditTotal } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

// Amounts are integer sen (Malaysian Ringgit).
const addItemSchema = z.object({
  rawLabel: z.string().trim().min(1, "Charge label is required").max(200),
  sectionName: z.string().trim().max(100).optional(),
  amountCents: z.number().int().min(-10000000).max(10000000),
  priorAmountCents: z
    .number()
    .int()
    .min(-10000000)
    .max(10000000)
    .nullable()
    .optional(),
  userNote: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid audit ID." }, { status: 400 });
    }

    const [audit] = await db
      .select({ id: billAudits.id })
      .from(billAudits)
      .where(eq(billAudits.id, id))
      .limit(1);

    if (!audit) {
      return NextResponse.json(
        { error: "Bill audit not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid line item payload.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existingItems = await db
      .select({ sortOrder: billLineItems.sortOrder })
      .from(billLineItems)
      .where(eq(billLineItems.auditId, id));

    const maxSort = existingItems.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      -1
    );

    const [inserted] = await db
      .insert(billLineItems)
      .values(
        buildLineItemValues(id, maxSort + 1, {
          rawLabel: parsed.data.rawLabel,
          sectionName: parsed.data.sectionName ?? "Added Charges",
          amountCents: parsed.data.amountCents,
          priorAmountCents: parsed.data.priorAmountCents ?? null,
          userNote: parsed.data.userNote,
        })
      )
      .returning();

    const currentTotalCents = await recalcAuditTotal(id);

    return NextResponse.json(
      { item: inserted, currentTotalCents },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/audits/[id]/items failed:", err);
    return NextResponse.json(
      { error: "Failed to add line item." },
      { status: 500 }
    );
  }
}
