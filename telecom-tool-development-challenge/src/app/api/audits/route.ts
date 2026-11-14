import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuditWithLines,
  listAudits,
  resetSampleAudit,
} from "@/lib/audit-service";
import { parseRawBillText } from "@/lib/bill-analyzer";

export const dynamic = "force-dynamic";

const manualItemSchema = z.object({
  rawLabel: z.string().trim().min(1, "Charge description is required").max(200),
  sectionName: z.string().trim().max(100).optional(),
  amountCents: z.number().int().min(-10000000).max(10000000),
  priorAmountCents: z.number().int().min(-10000000).max(10000000).nullable().optional(),
});

const createAuditSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("paste"),
    title: z.string().trim().min(1).max(160),
    providerLabel: z.string().trim().min(1).max(120),
    serviceType: z.enum(["mobile", "broadband", "bundle"]).default("mobile"),
    billingPeriodStart: z.string().trim().min(4).max(30),
    billingPeriodEnd: z.string().trim().min(4).max(30),
    previousTotalCents: z.number().int().min(0).max(10000000).optional(),
    customerContext: z.string().max(1500).optional(),
    rawBillText: z.string().min(3, "Please paste at least one bill line"),
  }),
  z.object({
    mode: z.literal("manual"),
    title: z.string().trim().min(1).max(160),
    providerLabel: z.string().trim().min(1).max(120),
    serviceType: z.enum(["mobile", "broadband", "bundle"]).default("mobile"),
    billingPeriodStart: z.string().trim().min(4).max(30),
    billingPeriodEnd: z.string().trim().min(4).max(30),
    previousTotalCents: z.number().int().min(0).max(10000000).default(0),
    customerContext: z.string().max(1500).optional(),
    items: z.array(manualItemSchema).min(1, "Add at least one bill line item").max(100),
  }),
  z.object({
    mode: z.literal("reset_sample"),
    sampleSlug: z.string().trim().min(1),
  }),
]);

export async function GET() {
  try {
    const audits = await listAudits();
    return NextResponse.json({ audits });
  } catch (err) {
    console.error("GET /api/audits failed:", err);
    return NextResponse.json(
      { error: "Failed to load saved bill audits." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createAuditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid bill audit payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.mode === "reset_sample") {
      const reset = await resetSampleAudit(payload.sampleSlug);
      if (!reset) {
        return NextResponse.json(
          { error: "Unknown sample scenario slug." },
          { status: 404 }
        );
      }
      return NextResponse.json({ audit: reset }, { status: 201 });
    }

    if (payload.mode === "paste") {
      const result = parseRawBillText(payload.rawBillText);
      if (result.items.length === 0) {
        return NextResponse.json(
          {
            // The form shows its own translated message for this code.
            code: "NO_CHARGE_LINES",
            error:
              "No charge lines with amounts were found. Put each charge and its ringgit amount on its own line, for example: Postpaid 98 Plan  RM98.00",
          },
          { status: 400 }
        );
      }

      const previousTotalCents =
        payload.previousTotalCents && payload.previousTotalCents > 0
          ? payload.previousTotalCents
          : result.detectedPreviousTotalCents ?? 0;

      const audit = await createAuditWithLines({
        title: payload.title,
        providerLabel: payload.providerLabel,
        serviceType: payload.serviceType,
        dataSource: "user_pasted",
        billingPeriodStart: payload.billingPeriodStart,
        billingPeriodEnd: payload.billingPeriodEnd,
        previousTotalCents,
        customerContext: payload.customerContext ?? "",
        rawBillText: payload.rawBillText,
        items: result.items.map((item) => ({
          rawLabel: item.rawLabel,
          sectionName: item.sectionName,
          amountCents: item.amountCents,
          priorAmountCents: item.priorAmountCents,
        })),
      });

      return NextResponse.json({ audit }, { status: 201 });
    }

    // Manual mode
    const audit = await createAuditWithLines({
      title: payload.title,
      providerLabel: payload.providerLabel,
      serviceType: payload.serviceType,
      dataSource: "user_manual",
      billingPeriodStart: payload.billingPeriodStart,
      billingPeriodEnd: payload.billingPeriodEnd,
      previousTotalCents: payload.previousTotalCents,
      customerContext: payload.customerContext ?? "",
      items: payload.items,
    });

    return NextResponse.json({ audit }, { status: 201 });
  } catch (err) {
    console.error("POST /api/audits failed:", err);
    return NextResponse.json(
      { error: "Failed to create bill audit." },
      { status: 500 }
    );
  }
}
