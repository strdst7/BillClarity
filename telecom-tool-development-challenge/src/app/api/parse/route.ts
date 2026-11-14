import { NextResponse } from "next/server";
import { z } from "zod";
import { parseRawBillText } from "@/lib/bill-analyzer";

export const dynamic = "force-dynamic";

const parseSchema = z.object({
  rawText: z.string().min(1).max(20000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide bill text to parse." },
        { status: 400 }
      );
    }

    const result = parseRawBillText(parsed.data.rawText);
    return NextResponse.json({
      items: result.items,
      detectedPreviousTotalCents: result.detectedPreviousTotalCents,
      detectedCurrentTotalCents: result.detectedCurrentTotalCents,
      skippedLines: result.skippedLines,
      foreignCurrencyMarkers: result.foreignCurrencyMarkers,
    });
  } catch (err) {
    console.error("POST /api/parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse raw bill text." },
      { status: 500 }
    );
  }
}
