import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { billAudits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuditWithItems } from "@/lib/audit-service";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

const patchAuditSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  providerLabel: z.string().trim().min(1).max(120).optional(),
  serviceType: z.enum(["mobile", "broadband", "bundle"]).optional(),
  billingPeriodStart: z.string().trim().min(4).max(30).optional(),
  billingPeriodEnd: z.string().trim().min(4).max(30).optional(),
  previousTotalCents: z.number().int().min(0).max(10000000).optional(),
  customerContext: z.string().max(1500).optional(),
  supportRefNumber: z.string().max(120).optional(),
  supportNotes: z.string().max(3000).optional(),
  promisedCreditCents: z.number().int().min(0).max(10000000).optional(),
  checklistState: z.record(z.string(), z.boolean()).optional(),
  customQuestions: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        text: z.string().trim().min(1).max(500),
        intent: z.enum(["clarify", "credit", "cancel"]),
      })
    )
    .max(25)
    .optional(),
  status: z.enum(["in_review", "ready_for_support", "resolved"]).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid audit ID." }, { status: 400 });
    }

    const audit = await getAuditWithItems(id);
    if (!audit) {
      return NextResponse.json({ error: "Bill audit not found." }, { status: 404 });
    }

    return NextResponse.json({ audit });
  } catch (err) {
    console.error("GET /api/audits/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to load bill audit." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid audit ID." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = patchAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update payload.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = {
      ...parsed.data,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(billAudits)
      .set(updateData)
      .where(eq(billAudits.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Bill audit not found." }, { status: 404 });
    }

    const fullAudit = await getAuditWithItems(id);
    return NextResponse.json({ audit: fullAudit });
  } catch (err) {
    console.error("PATCH /api/audits/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to update bill audit." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid audit ID." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(billAudits)
      .where(eq(billAudits.id, id))
      .returning({ id: billAudits.id });

    if (!deleted) {
      return NextResponse.json({ error: "Bill audit not found." }, { status: 404 });
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (err) {
    console.error("DELETE /api/audits/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to delete bill audit." },
      { status: 500 }
    );
  }
}
