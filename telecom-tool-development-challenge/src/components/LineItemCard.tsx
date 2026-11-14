"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { BillLineItemRow, ResolutionStatus } from "@/db/schema";
import {
  CURRENCY_SYMBOL,
  FLAG_META,
  RESOLUTION_META,
  formatDelta,
  formatMoney,
  getCategoryLabel,
  parseMoneyInput,
  type PresentedLineItem,
} from "@/lib/bill-analyzer";
import type { Language } from "@/lib/i18n";

type UpdateLineItem = (
  itemId: string,
  patch: Partial<BillLineItemRow> & { reanalyze?: boolean }
) => Promise<void>;

interface LineItemCardProps {
  item: PresentedLineItem;
  lang: Language;
  currency: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: UpdateLineItem;
  onDelete: (itemId: string) => Promise<void>;
}

export function LineItemCard({
  item,
  lang,
  currency,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
}: LineItemCardProps) {
  const ms = lang === "ms";
  const cat = getCategoryLabel(item.category, lang);
  const flag = FLAG_META[item.flagLevel] ?? FLAG_META.normal;
  const resMeta =
    RESOLUTION_META[item.resolutionStatus] ?? RESOLUTION_META.open;

  const delta =
    item.priorAmountCents !== null
      ? item.amountCents - item.priorAmountCents
      : null;

  const handleToggleBrief = async () => {
    const next = !item.includeInBrief;
    await onUpdate(item.id, {
      includeInBrief: next,
      resolutionStatus:
        next && item.resolutionStatus === "open"
          ? "to_ask"
          : !next && item.resolutionStatus === "to_ask"
            ? "open"
            : item.resolutionStatus,
    });
  };

  const editorKey = [
    lang,
    item.rawLabel,
    item.amountCents,
    item.priorAmountCents ?? "",
    item.suggestedQuestion,
    item.userNote,
    item.resolutionStatus,
  ].join("\u0001");

  const leftSignalClass =
    item.flagLevel === "high_attention"
      ? "border-l-2 border-l-[var(--signal-alert)]"
      : item.flagLevel === "review"
        ? "border-l-2 border-l-[var(--signal-warn)]"
        : "border-l-2 border-l-transparent";

  return (
    <div className={`bg-[var(--bg)] px-5 py-4 ${leftSignalClass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: Decoded Description & Technical Tags */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rams-tag">{cat.displayShortLabel}</span>
            {item.flagLevel !== "normal" && (
              <span className={`rams-tag ${flag.badgeClass}`}>
                <span className={`h-1.5 w-1.5 ${flag.dotClass}`} />
                {ms ? flag.labelMs : flag.label}
              </span>
            )}
            {item.resolutionStatus !== "open" && (
              <span className={`rams-tag ${resMeta.badgeClass}`}>
                {ms ? resMeta.labelMs : resMeta.label}
              </span>
            )}
            <span className="font-mono text-[11px] text-[var(--ink-muted)]">
              {item.sectionName}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[var(--ink)]">
              {item.plainTitle}
            </h4>
            <p className="mt-0.5 font-mono text-xs text-[var(--ink-muted)]">
              {ms ? "Label bil:" : "Bill wording:"} &ldquo;{item.rawLabel}
              &rdquo;
            </p>
          </div>

          <p className="max-w-3xl text-xs leading-relaxed text-[var(--ink-soft)]">
            {item.plainExplanation}
          </p>

          {item.flagReason && (
            <p
              className={`border-l-2 pl-2.5 text-xs font-medium leading-relaxed ${
                item.flagLevel === "high_attention"
                  ? "border-l-[var(--signal-alert)] text-[var(--signal-alert)]"
                  : "border-l-[var(--signal-warn)] text-[var(--signal-warn)]"
              }`}
            >
              {item.flagReason}
            </p>
          )}

          {item.userNote && !expanded && (
            <p className="font-mono text-xs text-[var(--ink)]">
              <strong>{ms ? "Nota anda:" : "Your note:"}</strong>{" "}
              {item.userNote}
            </p>
          )}
        </div>

        {/* Right: Tabular Data & Flat Action Switches */}
        <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
          <div className="text-left sm:text-right">
            <div
              className={`font-mono text-lg font-bold tabular-nums ${
                item.amountCents < 0
                  ? "text-[var(--signal-good)]"
                  : "text-[var(--ink)]"
              }`}
            >
              {formatMoney(item.amountCents, currency)}
            </div>
            {item.priorAmountCents !== null && (
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-[var(--ink-muted)] tabular-nums sm:justify-end">
                <span>
                  {ms ? "Sebelum:" : "Prior:"}{" "}
                  {formatMoney(item.priorAmountCents, currency)}
                </span>
                {delta !== null && delta !== 0 && (
                  <span
                    className={`font-semibold ${
                      delta > 0
                        ? "text-[var(--signal-alert)]"
                        : "text-[var(--signal-good)]"
                    }`}
                  >
                    ({formatDelta(delta, currency)})
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={item.includeInBrief}
              onClick={handleToggleBrief}
              className="rams-btn"
            >
              {item.includeInBrief ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {ms ? "Dlm Ringkasan" : "In Brief"}
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  {ms ? "Tanya Sokongan" : "Ask Support"}
                </>
              )}
            </button>

            <button
              type="button"
              aria-expanded={expanded}
              aria-pressed={expanded}
              onClick={onToggleExpand}
              className="rams-btn"
            >
              {expanded ? (
                <>
                  {ms ? "Tutup" : "Hide"} <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  {ms ? "Ubah / Soalan" : "Edit / Question"}{" "}
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <LineItemEditor
          key={editorKey}
          item={item}
          lang={lang}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

interface LineItemEditorProps {
  item: PresentedLineItem;
  lang: Language;
  onUpdate: UpdateLineItem;
  onDelete: (itemId: string) => Promise<void>;
}

function LineItemEditor({ item, lang, onUpdate, onDelete }: LineItemEditorProps) {
  const ms = lang === "ms";

  const [label, setLabel] = useState(item.rawLabel);
  const [amount, setAmount] = useState((item.amountCents / 100).toFixed(2));
  const [prior, setPrior] = useState(
    item.priorAmountCents !== null
      ? (item.priorAmountCents / 100).toFixed(2)
      : ""
  );
  const [question, setQuestion] = useState(item.suggestedQuestion);
  const [note, setNote] = useState(item.userNote);
  const [status, setStatus] = useState<ResolutionStatus>(item.resolutionStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const amountCents = parseMoneyInput(amount);
    const priorText = prior.trim();
    const priorCents = priorText === "" ? null : parseMoneyInput(priorText);

    if (!label.trim()) {
      setError(
        ms ? "Perihalan caj diperlukan." : "A charge description is required."
      );
      return;
    }
    if (amountCents === null || (priorText !== "" && priorCents === null)) {
      setError(
        ms
          ? "Masukkan amaun dalam ringgit, cth. 15.00 atau -10.00 untuk kredit."
          : "Enter amounts in ringgit, e.g. 15.00, or -10.00 for a credit."
      );
      return;
    }
    setError(null);

    const typedQuestion = question.trim();
    const questionEdited = typedQuestion !== item.suggestedQuestion.trim();

    setSaving(true);
    try {
      await onUpdate(item.id, {
        rawLabel: label.trim(),
        amountCents,
        priorAmountCents: priorCents,
        ...(questionEdited ? { suggestedQuestion: typedQuestion } : {}),
        userNote: note.trim(),
        resolutionStatus: status,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rams-box-subtle mt-4 space-y-3.5 p-4">
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <label className="rams-label">
            {ms ? "Perihalan Caj" : "Bill Wording"}
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rams-input text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="rams-label">
            {ms
              ? `Bil Ini (${CURRENCY_SYMBOL})`
              : `This Bill (${CURRENCY_SYMBOL})`}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rams-input font-mono text-xs tabular-nums"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="rams-label">
            {ms
              ? `Bil Sebelum (${CURRENCY_SYMBOL})`
              : `Prior Bill (${CURRENCY_SYMBOL})`}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={prior}
            onChange={(e) => setPrior(e.target.value)}
            placeholder={ms ? "pilihan" : "optional"}
            className="rams-input font-mono text-xs tabular-nums"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="rams-label">
            {ms ? "Status Penyelesaian" : "Resolution Status"}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ResolutionStatus)}
            className="rams-input text-xs"
          >
            <option value="open">{ms ? "Dalam Semakan" : "In Review"}</option>
            <option value="to_ask">
              {ms ? "Untuk Ditanya" : "Queued for Support"}
            </option>
            <option value="credit_promised">
              {ms ? "Kredit Dijanjikan" : "Credit Promised"}
            </option>
            <option value="explained">
              {ms ? "Dijelaskan / Kekal" : "Explained / Kept"}
            </option>
            <option value="cancelled">
              {ms ? "Dibatalkan / Dibuang" : "Cancelled / Removed"}
            </option>
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-semibold text-[var(--ink-soft)]">
            {ms
              ? "Soalan untuk Ringkasan Sokongan"
              : "Question for the Support Brief"}
            {item.questionIsCustom && (
              <span className="rams-tag-invert ml-2">
                {ms ? "Ayat anda sendiri" : "Your own wording"}
              </span>
            )}
          </label>
          {item.questionIsCustom && (
            <button
              type="button"
              onClick={() => onUpdate(item.id, { suggestedQuestion: "" })}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--ink)] underline underline-offset-4 hover:opacity-70"
            >
              <RotateCcw className="h-3 w-3" />
              {ms ? "Guna ayat cadangan" : "Use suggested wording"}
            </button>
          )}
        </div>
        <textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="rams-input text-xs leading-relaxed"
        />
        {!item.questionIsCustom && (
          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
            {ms
              ? "Ayat cadangan ini mengikut bahasa dan amaun semasa. Ubah untuk menggunakan ayat anda sendiri."
              : "This suggested wording follows the language and the current amounts. Edit it to use your own."}
          </p>
        )}
      </div>

      <div>
        <label className="rams-label">
          {ms
            ? "Nota Konteks Peribadi Anda (disertakan dalam ringkasan)"
            : "Your Personal Context Note (included in brief)"}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            ms
              ? "cth., Saya tidak mengaktifkan perayauan — hanya memandu dekat sempadan"
              : "e.g., I never turned on roaming — I was only driving near the border"
          }
          className="rams-input text-xs"
        />
      </div>

      {error && (
        <p className="text-xs font-medium text-[var(--signal-alert)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] pt-3">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rams-btn text-[var(--signal-alert)] hover:border-[var(--signal-alert)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {ms ? "Buang Caj" : "Remove Charge"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rams-btn-primary"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {ms ? "Simpan Perubahan" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
