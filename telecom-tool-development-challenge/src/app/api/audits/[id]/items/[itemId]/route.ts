import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { billLineItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { analyzeLineItem } from "@/lib/bill-analyzer";
import { derivedLineFields, recalcAuditTotal } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

// Amounts are integer sen (Malaysian Ringgit).
const patchItemSchema = z.object({
  rawLabel: z.string().trim().min(1).max(200).optional(),
  sectionName: z.string().trim().max(100).optional(),
  amountCents: z.number().int().min(-10000000).max(10000000).optional(),
  priorAmountCents: z
    .number()
    .int()
    .min(-10000000)
    .max(10000000)
    .nullable()
    .optional(),
  // The user's own wording for the support question. An empty string goes
  // back to the suggested wording, which is generated when the line is shown.
  suggestedQuestion: z.string().trim().max(1000).optional(),
  includeInBrief: z.boolean().optional(),
  userNote: z.string().max(1000).optional(),
  resolutionStatus: z
    .enum(["open", "to_ask", "credit_promised", "explained", "cancelled"])
    .optional(),
  // Optional: force the stored classification to be refreshed.
  reanalyze: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await context.params;
    if (
      !uuidSchema.safeParse(id).success ||
      !uuidSchema.safeParse(itemId).success
    ) {
      return NextResponse.json({ error: "Invalid ID format." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(billLineItems)
      .where(and(eq(billLineItems.id, itemId), eq(billLineItems.auditId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Line item not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = patchItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid line item update.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const nextLabel = data.rawLabel ?? existing.rawLabel;
    const nextSection = data.sectionName ?? existing.sectionName;
    const nextAmount = data.amountCents ?? existing.amountCents;
    const nextPrior =
      data.priorAmountCents !== undefined
        ? data.priorAmountCents
        : existing.priorAmountCents;

    const factsChanged =
      nextLabel !== existing.rawLabel ||
      nextAmount !== existing.amountCents ||
      nextPrior !== existing.priorAmountCents;

    const updateValues: Partial<typeof billLineItems.$inferInsert> = {
      rawLabel: nextLabel,
      sectionName: nextSection,
      amountCents: nextAmount,
      priorAmountCents: nextPrior,
      // Keep the stored classification in step with the wording and figures.
      ...(factsChanged || data.reanalyze
        ? derivedLineFields(
            analyzeLineItem(
              {
                rawLabel: nextLabel,
                amountCents: nextAmount,
                priorAmountCents: nextPrior,
                sectionName: nextSection,
              },
              "en"
            )
          )
        : {}),
      ...(data.suggestedQuestion !== undefined
        ? { suggestedQuestion: data.suggestedQuestion }
        : {}),
      ...(data.includeInBrief !== undefined
        ? { includeInBrief: data.includeInBrief }
        : {}),
      ...(data.userNote !== undefined ? { userNote: data.userNote } : {}),
      ...(data.resolutionStatus !== undefined
        ? { resolutionStatus: data.resolutionStatus }
        : {}),
    };

    const [updated] = await db
      .update(billLineItems)
      .set(updateValues)
      .where(and(eq(billLineItems.id, itemId), eq(billLineItems.auditId, id)))
      .returning();

    const currentTotalCents = await recalcAuditTotal(id);

    return NextResponse.json({ item: updated, currentTotalCents });
  } catch (err) {
    console.error("PATCH /api/audits/[id]/items/[itemId] failed:", err);
    return NextResponse.json(
      { error: "Failed to update line item." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await context.params;
    if (
      !uuidSchema.safeParse(id).success ||
      !uuidSchema.safeParse(itemId).success
    ) {
      return NextResponse.json({ error: "Invalid ID format." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(billLineItems)
      .where(and(eq(billLineItems.id, itemId), eq(billLineItems.auditId, id)))
      .returning({ id: billLineItems.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Line item not found." },
        { status: 404 }
      );
    }

    const currentTotalCents = await recalcAuditTotal(id);

    return NextResponse.json({ deletedId: deleted.id, currentTotalCents });
  } catch (err) {
    console.error("DELETE /api/audits/[id]/items/[itemId] failed:", err);
    return NextResponse.json(
      { error: "Failed to delete line item." },
      { status: 500 }
    );
  }
}
