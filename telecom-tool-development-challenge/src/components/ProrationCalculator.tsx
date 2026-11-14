"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import {
  CURRENCY_SYMBOL,
  calculateProrationEstimate,
  formatAmount,
  formatMoney,
} from "@/lib/bill-analyzer";
import type { BillLineItemRow } from "@/db/schema";
import { usePreferences } from "@/lib/preferences-context";

interface ProrationCalculatorProps {
  items: BillLineItemRow[];
  onAddCustomQuestion: (
    question: string,
    intent: "clarify" | "credit" | "cancel"
  ) => Promise<void>;
}

export function ProrationCalculator({
  items,
  onAddCustomQuestion,
}: ProrationCalculatorProps) {
  const { lang } = usePreferences();
  const ms = lang === "ms";

  const detectedProration = useMemo(
    () =>
      items.find(
        (i) =>
          i.category === "one_time_fee" &&
          /pro-?rat|partial|separa|mid[- ]?cycle|plan|pelan/i.test(i.rawLabel)
      ),
    [items]
  );

  const [oldRate, setOldRate] = useState("68.00");
  const [newRate, setNewRate] = useState("98.00");
  const [cycleDays, setCycleDays] = useState("30");
  const [daysOnNew, setDaysOnNew] = useState("14");
  const [billedProration, setBilledProration] = useState(
    detectedProration
      ? (detectedProration.amountCents / 100).toFixed(2)
      : "14.00"
  );
  const [addedFeedback, setAddedFeedback] = useState(false);

  const values = useMemo(
    () => ({
      oldMonthlyRate: Number.parseFloat(oldRate) || 0,
      newMonthlyRate: Number.parseFloat(newRate) || 0,
      cycleDays: Number.parseInt(cycleDays, 10) || 30,
      daysOnNewPlan: Number.parseInt(daysOnNew, 10) || 0,
      billedProration: Number.parseFloat(billedProration) || 0,
    }),
    [oldRate, newRate, cycleDays, daysOnNew, billedProration]
  );

  const result = useMemo(
    () => calculateProrationEstimate(values, lang),
    [values, lang]
  );

  const handleLoadDetected = () => {
    if (!detectedProration) return;
    setBilledProration((detectedProration.amountCents / 100).toFixed(2));
  };

  const handleAddToBrief = async () => {
    const from = formatAmount(values.oldMonthlyRate);
    const to = formatAmount(values.newMonthlyRate);
    const billed = formatAmount(values.billedProration);
    const expected = formatAmount(result.expectedDifference);
    const q = ms
      ? `Bagi pertukaran pelan pertengahan kitaran saya (daripada ${from} kepada ${to} sebulan, ${daysOnNew} daripada ${cycleDays} hari pada pelan baharu), saya dicaj ${billed} sebagai caj prorata, manakala kiraan harian mudah memberikan kira-kira ${expected}. Boleh sahkan bilangan hari yang tepat dan sama ada pengebilan pendahuluan turut disertakan?`
      : `For my mid-cycle plan change (from ${from} to ${to} a month, ${daysOnNew} of ${cycleDays} days on the new plan), I was charged ${billed} in pro-rated charges, while a simple daily calculation gives about ${expected}. Could you confirm the exact day count and whether advance billing is included?`;
    await onAddCustomQuestion(q, "clarify");
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 3000);
  };

  const perDay = ms ? "hari" : "day";

  return (
    <section className="rams-box">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rule)] px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {ms
                ? "Semakan Kiraan Prorata Pertengahan Kitaran"
                : "Mid-Cycle Proration Sanity Check"}
            </h3>
            <span className="rams-tag">
              {ms ? "Anggaran Sahaja" : "Estimate Only"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--ink-soft)]">
            {ms
              ? "Semak sama ada caj separa bulan selepas menukar atau mengaktifkan pelan sepadan dengan kiraan harian yang mudah, sebelum bertanya kepada khidmat pelanggan. Semua amaun dalam ringgit (RM)."
              : "Check whether a part-month charge after changing or activating a plan matches simple daily maths before you raise it with support. All amounts are in ringgit (RM)."}
          </p>
        </div>

        {detectedProration && (
          <button
            type="button"
            onClick={handleLoadDetected}
            className="rams-btn font-mono text-xs tabular-nums"
          >
            {ms
              ? `Guna Prorata pada Bil (${formatMoney(detectedProration.amountCents)})`
              : `Use the Bill's Proration (${formatMoney(detectedProration.amountCents)})`}
          </button>
        )}
      </div>

      {/* Two-Column Instrument Grid Divided by 1px Rule */}
      <div className="grid grid-cols-1 divide-y divide-[var(--rule)] lg:grid-cols-12 lg:divide-y-0">
        {/* Left: Numeric Inputs */}
        <div className="space-y-4 p-5 lg:col-span-6 lg:border-r lg:border-[var(--rule)]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="rams-label">
                {ms
                  ? `Harga Pelan Lama (${CURRENCY_SYMBOL}/bulan)`
                  : `Old Plan Price (${CURRENCY_SYMBOL}/month)`}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={oldRate}
                onChange={(e) => setOldRate(e.target.value)}
                className="rams-input font-mono tabular-nums"
              />
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                {ms
                  ? "Tetapkan 0.00 untuk talian atau perkhidmatan baharu."
                  : "Set to 0.00 for a brand-new line or service."}
              </p>
            </div>
            <div>
              <label className="rams-label">
                {ms
                  ? `Harga Pelan Baharu (${CURRENCY_SYMBOL}/bulan)`
                  : `New Plan Price (${CURRENCY_SYMBOL}/month)`}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="rams-input font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="rams-label">
                {ms ? "Bilangan Hari dalam Kitaran Bil" : "Days in Billing Cycle"}
              </label>
              <select
                value={cycleDays}
                onChange={(e) => setCycleDays(e.target.value)}
                className="rams-input font-mono tabular-nums"
              >
                <option value="28">{ms ? "28 hari" : "28 days"}</option>
                <option value="29">{ms ? "29 hari" : "29 days"}</option>
                <option value="30">{ms ? "30 hari" : "30 days"}</option>
                <option value="31">{ms ? "31 hari" : "31 days"}</option>
              </select>
            </div>

            <div>
              <label className="rams-label">
                {ms
                  ? `Hari pada Pelan Baharu (${daysOnNew} / ${cycleDays})`
                  : `Days on New Plan (${daysOnNew} / ${cycleDays})`}
              </label>
              <input
                type="number"
                min="1"
                max={values.cycleDays}
                value={daysOnNew}
                onChange={(e) => setDaysOnNew(e.target.value)}
                className="rams-input font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <input
              type="range"
              min="1"
              max={values.cycleDays}
              value={Math.max(1, values.daysOnNewPlan)}
              onChange={(e) => setDaysOnNew(e.target.value)}
              className="rams-range"
              aria-label={
                ms ? "Hari pada pelan baharu" : "Days on the new plan"
              }
            />
            <div className="flex justify-between font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
              <span>{ms ? "Hari 1" : "Day 1"}</span>
              <span>{ms ? "Pertengahan kitaran" : "Mid-cycle"}</span>
              <span>{ms ? `Hari ${cycleDays}` : `Day ${cycleDays}`}</span>
            </div>
          </div>

          <div>
            <label className="rams-label">
              {ms
                ? `Amaun Prorata yang Dicaj pada Bil (${CURRENCY_SYMBOL})`
                : `Pro-Rated Amount Charged on the Bill (${CURRENCY_SYMBOL})`}
            </label>
            <input
              type="number"
              step="0.01"
              value={billedProration}
              onChange={(e) => setBilledProration(e.target.value)}
              className="rams-input font-mono font-semibold tabular-nums"
            />
          </div>
        </div>

        {/* Right: Transparent Calculation Ledger */}
        <div className="flex flex-col justify-between bg-[var(--bg-subtle)] p-5 lg:col-span-6">
          <div className="space-y-3.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--ink-soft)]">
                {ms
                  ? "Kadar Harian Pelan Lama (angg.)"
                  : "Old Plan Daily Rate (est.)"}
              </span>
              <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                {CURRENCY_SYMBOL}
                {result.oldDailyRate.toFixed(3)}/{perDay}
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--ink-soft)]">
                {ms
                  ? "Kadar Harian Pelan Baharu (angg.)"
                  : "New Plan Daily Rate (est.)"}
              </span>
              <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                {CURRENCY_SYMBOL}
                {result.newDailyRate.toFixed(3)}/{perDay}
              </span>
            </div>

            <div className="border-t border-[var(--rule)] pt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--ink)]">
                  {ms
                    ? "Kaedah A · Perbezaan Bersih Naik Taraf"
                    : "Method A · Net Upgrade Difference"}
                </span>
                <span className="font-mono text-sm font-bold text-[var(--ink)] tabular-nums">
                  {formatAmount(result.expectedDifference)}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                {values.daysOnNewPlan} {ms ? "hari" : "days"} × (
                {CURRENCY_SYMBOL}
                {result.newDailyRate.toFixed(3)} − {CURRENCY_SYMBOL}
                {result.oldDailyRate.toFixed(3)})
              </p>
            </div>

            <div className="border-t border-[var(--rule)] pt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--ink)]">
                  {ms
                    ? "Kaedah B · Separa Bulan Pelan Baharu Sahaja"
                    : "Method B · Part-Month on the New Plan Only"}
                </span>
                <span className="font-mono text-sm font-bold text-[var(--ink)] tabular-nums">
                  {formatAmount(result.expectedPartialNewPlan)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                {ms
                  ? "Digunakan apabila pelan lama dikreditkan pada baris yang berasingan."
                  : "Used when the old plan is credited on a separate line."}
              </p>
            </div>

            <div
              className={`border bg-[var(--bg)] p-3.5 text-xs leading-relaxed ${
                result.likelyMethod === "mismatch"
                  ? "border-[var(--signal-alert)] border-l-2"
                  : "border-[var(--signal-good)] border-l-2"
              }`}
            >
              <div
                className={`mb-1 font-bold ${
                  result.likelyMethod === "mismatch"
                    ? "text-[var(--signal-alert)]"
                    : "text-[var(--signal-good)]"
                }`}
              >
                {result.likelyMethod === "mismatch"
                  ? ms
                    ? "Kemungkinan Percanggahan Prorata (Wajar Ditanya)"
                    : "Possible Proration Discrepancy (Worth Asking Support)"
                  : ms
                    ? "Konsisten dengan Kiraan Prorata Harian yang Biasa"
                    : "Looks Consistent with Standard Daily Proration"}
              </div>
              <p className="text-[var(--ink-soft)]">{result.explanation}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] pt-3.5">
            <span className="text-[11px] text-[var(--ink-muted)]">
              {ms
                ? "SST dan pembundaran berbeza mengikut penyedia."
                : "SST and rounding vary by provider."}
            </span>
            <button
              type="button"
              onClick={handleAddToBrief}
              className="rams-btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {addedFeedback
                ? ms
                  ? "Ditambah ke Ringkasan Sokongan!"
                  : "Added to Support Brief!"
                : ms
                  ? "Tambah Soalan Prorata ke Ringkasan"
                  : "Add Proration Question to Brief"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
