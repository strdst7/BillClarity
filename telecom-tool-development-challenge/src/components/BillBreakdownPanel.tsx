"use client";

import { useState, useMemo } from "react";
import { Plus, Loader2 } from "lucide-react";
import type {
  BillAuditRow,
  BillLineItemRow,
  LineItemCategory,
} from "@/db/schema";
import {
  CURRENCY_SYMBOL,
  formatDelta,
  formatMoney,
  parseMoneyInput,
  type AuditSummary,
  type PresentedLineItem,
} from "@/lib/bill-analyzer";
import { usePreferences } from "@/lib/preferences-context";
import { LineItemCard } from "./LineItemCard";

interface BillBreakdownPanelProps {
  audit: BillAuditRow;
  items: PresentedLineItem[];
  summary: AuditSummary;
  onUpdateAudit: (patch: Partial<BillAuditRow>) => Promise<void>;
  onAddItem: (payload: {
    rawLabel: string;
    sectionName?: string;
    amountCents: number;
    priorAmountCents?: number | null;
  }) => Promise<void>;
  onUpdateItem: (
    itemId: string,
    patch: Partial<BillLineItemRow> & { reanalyze?: boolean }
  ) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onGoToBrief: () => void;
}

export function BillBreakdownPanel({
  audit,
  items,
  summary,
  onUpdateAudit,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onGoToBrief,
}: BillBreakdownPanelProps) {
  const { lang } = usePreferences();
  const ms = lang === "ms";

  const [filterMode, setFilterMode] = useState<"all" | "flagged" | "brief">(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<
    LineItemCategory | "all"
  >("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Inline edit of the previous bill total
  const [editingPrior, setEditingPrior] = useState(false);
  const [priorDraft, setPriorDraft] = useState(
    (audit.previousTotalCents / 100).toFixed(2)
  );
  const [priorInvalid, setPriorInvalid] = useState(false);

  // Add charge form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newPrior, setNewPrior] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [addInvalid, setAddInvalid] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterMode === "flagged") {
        if (
          item.flagLevel !== "high_attention" &&
          item.flagLevel !== "review"
        ) {
          return false;
        }
      } else if (filterMode === "brief") {
        if (!item.includeInBrief) return false;
      }

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [items, filterMode, categoryFilter]);

  const positiveBuckets = useMemo(
    () => summary.categoryBuckets.filter((b) => b.totalCents > 0),
    [summary.categoryBuckets]
  );

  const handleSavePriorTotal = async () => {
    const cents = priorDraft.trim() === "" ? 0 : parseMoneyInput(priorDraft);
    if (cents === null || cents < 0) {
      setPriorInvalid(true);
      return;
    }
    setPriorInvalid(false);
    await onUpdateAudit({ previousTotalCents: cents });
    setEditingPrior(false);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoneyInput(newAmount);
    const priorText = newPrior.trim();
    const priorAmountCents =
      priorText === "" ? null : parseMoneyInput(priorText);
    if (
      !newLabel.trim() ||
      amountCents === null ||
      (priorText !== "" && priorAmountCents === null)
    ) {
      setAddInvalid(true);
      return;
    }
    setAddInvalid(false);
    setAddingItem(true);
    try {
      await onAddItem({
        rawLabel: newLabel.trim(),
        amountCents,
        priorAmountCents,
        sectionName: ms ? "Caj Ditambah" : "Added Charges",
      });
      setNewLabel("");
      setNewAmount("");
      setNewPrior("");
      setShowAddForm(false);
    } finally {
      setAddingItem(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 4-Channel Metric Grid — Single Bordered Container, 1px Rules */}
      <section className="rams-box grid grid-cols-1 divide-y divide-[var(--rule)] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
        {/* 01 Current Bill */}
        <div className="p-5 sm:border-r sm:border-b sm:border-[var(--rule)] xl:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="rams-kicker">
              {ms ? "Jumlah Bil Semasa" : "Current Bill Total"}
            </span>
            <span className="font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
              {items.length}{" "}
              {ms ? "baris" : `line${items.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
            {formatMoney(summary.currentTotalCents, audit.currency)}
          </div>
          <div className="mt-2 text-xs text-[var(--ink-soft)]">
            {ms ? "Termasuk" : "Includes"}{" "}
            <span className="font-mono font-medium text-[var(--signal-good)] tabular-nums">
              {formatMoney(summary.totalCreditsCents, audit.currency)}
            </span>{" "}
            {ms ? "kredit / rebat" : "in credits"}
          </div>
        </div>

        {/* 02 Change vs Prior Cycle */}
        <div className="p-5 sm:border-b sm:border-[var(--rule)] xl:border-r xl:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="rams-kicker">
              {ms ? "lwn. Kitaran Lepas" : "vs. Prior Cycle"}
            </span>
            {!editingPrior && (
              <button
                type="button"
                onClick={() => {
                  setPriorDraft((audit.previousTotalCents / 100).toFixed(2));
                  setPriorInvalid(false);
                  setEditingPrior(true);
                }}
                className="font-mono text-[11px] text-[var(--ink)] underline underline-offset-4 hover:opacity-70"
              >
                {ms ? "Ubah" : "Edit Prior"}
              </button>
            )}
          </div>

          {editingPrior ? (
            <div className="mt-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold text-[var(--ink-muted)]">
                  {CURRENCY_SYMBOL}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priorDraft}
                  onChange={(e) => setPriorDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePriorTotal();
                  }}
                  aria-label={
                    ms ? "Jumlah bil terdahulu (RM)" : "Previous bill total (RM)"
                  }
                  className={`rams-input w-24 py-1 font-mono text-sm ${
                    priorInvalid ? "border-[var(--signal-alert)]" : ""
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSavePriorTotal}
                  className="rams-btn-primary py-1.5"
                >
                  {ms ? "Simpan" : "Save"}
                </button>
              </div>
              {priorInvalid && (
                <p className="mt-1 text-[11px] font-medium text-[var(--signal-alert)]">
                  {ms
                    ? "Masukkan amaun ringgit, cth. 210.54"
                    : "Enter a ringgit amount, e.g. 210.54"}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 flex items-baseline gap-2.5">
              <span
                className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
                  summary.previousTotalCents === 0
                    ? "text-[var(--ink-muted)]"
                    : summary.netDeltaCents > 0
                      ? "text-[var(--signal-alert)]"
                      : summary.netDeltaCents < 0
                        ? "text-[var(--signal-good)]"
                        : "text-[var(--ink)]"
                }`}
              >
                {summary.previousTotalCents > 0
                  ? formatDelta(summary.netDeltaCents, audit.currency)
                  : "—"}
              </span>
              {summary.deltaPercent !== null && (
                <span className="font-mono text-xs text-[var(--ink-soft)] tabular-nums">
                  ({summary.deltaPercent > 0 ? "+" : ""}
                  {summary.deltaPercent}%)
                </span>
              )}
            </div>
          )}

          <div className="mt-2 text-xs text-[var(--ink-soft)]">
            {ms ? "Bil terdahulu:" : "Previous bill:"}{" "}
            <span className="font-mono text-[var(--ink)] tabular-nums">
              {summary.previousTotalCents > 0
                ? formatMoney(summary.previousTotalCents, audit.currency)
                : ms
                  ? "Belum ditetapkan"
                  : "Not set"}
            </span>
          </div>
        </div>

        {/* 03 Carrier Fees vs Tax */}
        <div className="p-5 sm:border-r sm:border-[var(--rule)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="rams-kicker">
              {ms ? "Fi Syarikat lwn. Cukai (SST)" : "Carrier Fees vs. Tax (SST)"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
              {formatMoney(summary.carrierSurchargesCents, audit.currency)}
            </span>
            <span className="font-mono text-[11px] text-[var(--ink-muted)]">
              {ms ? "syarikat" : "carrier"}
            </span>
          </div>
          <div className="mt-2 text-xs text-[var(--ink-soft)]">
            {ms ? "Cukai kerajaan:" : "Government tax:"}{" "}
            <span className="font-mono text-[var(--ink)] tabular-nums">
              {formatMoney(summary.govTaxesCents, audit.currency)}
            </span>
          </div>
        </div>

        {/* 04 Worth Asking About (Estimate) */}
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="rams-kicker">
              {ms ? "Wajar Ditanya / Semak" : "Worth Asking About"}
            </span>
            <span className="rams-tag">{ms ? "Anggaran" : "Estimate"}</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
            {formatMoney(summary.estimatedAdjustableCents, audit.currency)}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
            <span className="font-mono text-[11px] tabular-nums">
              {ms
                ? `${summary.flaggedCount} ditanda · ${summary.briefItemCount} dlm ringkasan`
                : `${summary.flaggedCount} flagged · ${summary.briefItemCount} in brief`}
            </span>
            <button
              type="button"
              onClick={onGoToBrief}
              className="font-mono text-[11px] font-semibold text-[var(--ink)] underline underline-offset-4 hover:opacity-70"
            >
              {ms ? "Buka Ringkasan →" : "Open Brief →"}
            </button>
          </div>
        </div>
      </section>

      {/* Cost Composition — Crisp Rectangular Bar & Flat Switches */}
      {positiveBuckets.length > 0 && (
        <section className="rams-box p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold tracking-wide text-[var(--ink)] uppercase">
                {ms ? "Pecahan Komposisi Bil" : "Where Your Money Goes"}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                {ms
                  ? "Klik mana-mana kategori untuk menapis baris caj. Fi syarikat diasingkan daripada cukai kerajaan (SST)."
                  : "Click a category to filter the lines. Carrier-set fees are kept apart from government tax (SST)."}
              </p>
            </div>
            {categoryFilter !== "all" && (
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className="rams-btn py-1"
              >
                {ms ? "Padam Tapisan Kategori" : "Clear Category Filter"}
              </button>
            )}
          </div>

          {/* 1px Bordered Proportional Bar */}
          <div className="flex h-3 w-full border border-[var(--rule)] bg-[var(--bg-subtle)]">
            {positiveBuckets.map((bucket) => (
              <button
                key={bucket.category}
                type="button"
                title={`${bucket.label}: ${formatMoney(bucket.totalCents, audit.currency)} (${bucket.sharePercent}%)`}
                onClick={() =>
                  setCategoryFilter((prev) =>
                    prev === bucket.category ? "all" : bucket.category
                  )
                }
                style={{
                  width: `${Math.max(bucket.sharePercent, 2)}%`,
                  backgroundColor: bucket.color,
                }}
                className={`h-full border-r border-[var(--bg)] last:border-r-0 ${
                  categoryFilter !== "all" &&
                  categoryFilter !== bucket.category
                    ? "opacity-25"
                    : "opacity-100 hover:opacity-80"
                }`}
              />
            ))}
          </div>

          {/* Category Switches */}
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.categoryBuckets.map((bucket) => {
              const active = categoryFilter === bucket.category;
              return (
                <button
                  key={bucket.category}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setCategoryFilter((prev) =>
                      prev === bucket.category ? "all" : bucket.category
                    )
                  }
                  className="rams-btn px-2.5 py-1.5 text-xs"
                >
                  <span
                    className="h-2 w-2 shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <span>{bucket.shortLabel}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatMoney(bucket.totalCents, audit.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Executive Findings — Plain Bordered Rows with Functional Left Indicator */}
      {summary.findings.length > 0 && (
        <section className="rams-box divide-y divide-[var(--rule)]">
          {summary.findings.map((finding) => {
            const indicatorClass =
              finding.tone === "alert"
                ? "border-l-[var(--signal-alert)]"
                : finding.tone === "warn"
                  ? "border-l-[var(--signal-warn)]"
                  : finding.tone === "positive"
                    ? "border-l-[var(--signal-good)]"
                    : "border-l-[var(--ink)]";

            return (
              <div
                key={finding.id}
                className={`border-l-2 px-5 py-3.5 text-left ${indicatorClass}`}
              >
                <div className="text-xs font-bold text-[var(--ink)]">
                  {finding.headline}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">
                  {finding.detail}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Line-by-Line Ledger */}
      <section className="rams-box">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-5 py-3.5">
          <div className="rams-seg" role="group" aria-label="Line item filter">
            <button
              type="button"
              aria-pressed={filterMode === "all"}
              onClick={() => setFilterMode("all")}
              className="rams-seg-btn"
            >
              {ms
                ? `Semua Baris (${items.length})`
                : `All Lines (${items.length})`}
            </button>
            <button
              type="button"
              aria-pressed={filterMode === "flagged"}
              onClick={() => setFilterMode("flagged")}
              className="rams-seg-btn"
            >
              {ms
                ? `Ditandakan (${summary.flaggedCount})`
                : `Flagged (${summary.flaggedCount})`}
            </button>
            <button
              type="button"
              aria-pressed={filterMode === "brief"}
              onClick={() => setFilterMode("brief")}
              className="rams-seg-btn"
            >
              {ms
                ? `Dalam Ringkasan (${summary.briefItemCount})`
                : `In Support Brief (${summary.briefItemCount})`}
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showAddForm}
            onClick={() => {
              setAddInvalid(false);
              setShowAddForm((prev) => !prev);
            }}
            className="rams-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            {ms ? "Tambah Caj / Kredit Hilang" : "Add Charge / Missing Credit"}
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="border-b border-[var(--rule)] bg-[var(--bg-subtle)] px-5 py-4"
          >
            <div className="mb-2.5 text-xs font-semibold text-[var(--ink)]">
              {ms
                ? "Tambah Baris Caj (dinyahkod & disimpan secara automatik)"
                : "Add a Line Item (automatically decoded & saved)"}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={
                    ms
                      ? "Perihalan pada bil (cth. Data Top-Up 5GB atau Rebat Auto-Debit Tiada)"
                      : "Exact bill wording (e.g. Data Top-Up 5GB or Missing Auto-Debit Rebate)"
                  }
                  className="rams-input text-xs"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder={
                    ms
                      ? `Bil ini (${CURRENCY_SYMBOL})`
                      : `This bill (${CURRENCY_SYMBOL})`
                  }
                  className="rams-input font-mono text-xs tabular-nums"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPrior}
                  onChange={(e) => setNewPrior(e.target.value)}
                  placeholder={
                    ms
                      ? `Sebelum (${CURRENCY_SYMBOL}, pil.)`
                      : `Prior (${CURRENCY_SYMBOL}, opt.)`
                  }
                  className="rams-input font-mono text-xs tabular-nums"
                />
              </div>
              <div className="flex items-stretch gap-1.5 sm:col-span-2">
                <button
                  type="submit"
                  disabled={addingItem}
                  className="rams-btn-primary flex-1"
                >
                  {addingItem ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : ms ? (
                    "Tambah"
                  ) : (
                    "Add"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rams-btn"
                >
                  {ms ? "Batal" : "Cancel"}
                </button>
              </div>
            </div>
            {addInvalid && (
              <p className="mt-2 text-xs font-medium text-[var(--signal-alert)]">
                {ms
                  ? "Masukkan perihalan dan amaun ringgit yang sah, cth. 15.00 atau -10.00 untuk kredit."
                  : "Enter a description and valid ringgit amounts, e.g. 15.00, or -10.00 for a credit."}
              </p>
            )}
            <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
              {ms ? (
                <>
                  Tip: Untuk merekodkan rebat yang hilang bulan ini, masukkan{" "}
                  <code className="font-mono font-semibold text-[var(--ink)]">
                    0.00
                  </code>{" "}
                  bagi Bil Ini dan{" "}
                  <code className="font-mono font-semibold text-[var(--ink)]">
                    -20.00
                  </code>{" "}
                  bagi Sebelum.
                </>
              ) : (
                <>
                  Tip: To record a rebate that disappeared this month, enter{" "}
                  <code className="font-mono font-semibold text-[var(--ink)]">
                    0.00
                  </code>{" "}
                  for This Bill and{" "}
                  <code className="font-mono font-semibold text-[var(--ink)]">
                    -20.00
                  </code>{" "}
                  for Prior.
                </>
              )}
            </p>
          </form>
        )}

        {filteredItems.length === 0 ? (
          <div className="px-5 py-10 text-left text-sm text-[var(--ink-soft)]">
            {ms
              ? "Tiada baris caj yang sepadan dengan tapisan semasa."
              : "No bill line items match the current filter."}
          </div>
        ) : (
          <div className="divide-y divide-[var(--rule)]">
            {filteredItems.map((item) => (
              <LineItemCard
                key={item.id}
                item={item}
                lang={lang}
                currency={audit.currency}
                expanded={expandedItemId === item.id}
                onToggleExpand={() =>
                  setExpandedItemId((prev) =>
                    prev === item.id ? null : item.id
                  )
                }
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
