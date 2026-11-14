"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Download,
  Printer,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import type {
  AuditStatus,
  BillAuditRow,
  BillLineItemRow,
  CustomQuestion,
  ResolutionStatus,
} from "@/db/schema";
import {
  buildSupportBrief,
  formatMoney,
  getChecklistForAudit,
  parseMoneyInput,
  type AuditSummary,
} from "@/lib/bill-analyzer";
import { usePreferences } from "@/lib/preferences-context";

interface SupportBriefPanelProps {
  audit: BillAuditRow;
  items: BillLineItemRow[];
  summary: AuditSummary;
  onUpdateAudit: (patch: Partial<BillAuditRow>) => Promise<void>;
  onUpdateItem: (
    itemId: string,
    patch: Partial<BillLineItemRow> & { reanalyze?: boolean }
  ) => Promise<void>;
  onGoToAudit: () => void;
}

export function SupportBriefPanel({
  audit,
  items,
  summary,
  onUpdateAudit,
  onUpdateItem,
  onGoToAudit,
}: SupportBriefPanelProps) {
  const { lang } = usePreferences();
  const ms = lang === "ms";

  const brief = buildSupportBrief(audit, items, summary, lang);
  const checklist = getChecklistForAudit(items, lang);

  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionIntent, setNewQuestionIntent] =
    useState<CustomQuestion["intent"]>("clarify");

  const [supportRef, setSupportRef] = useState(audit.supportRefNumber);
  const [promisedCreditStr, setPromisedCreditStr] = useState(
    audit.promisedCreditCents > 0
      ? (audit.promisedCreditCents / 100).toFixed(2)
      : ""
  );
  const [supportNotes, setSupportNotes] = useState(audit.supportNotes);
  const [status, setStatus] = useState<AuditStatus>(audit.status);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [creditInvalid, setCreditInvalid] = useState(false);

  const totalQuestionCount =
    brief.creditRequests.length +
    brief.clarifications.length +
    brief.cancelOrReview.length +
    brief.customQuestions.length;

  const copyToClipboard = async (text: string, which: "script" | "full") => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "script") {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2200);
      } else {
        setCopiedFull(true);
        setTimeout(() => setCopiedFull(false), 2200);
      }
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  };

  const downloadFile = (content: string, ext: "txt" | "md") => {
    const slug = audit.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const blob = new Blob([content], {
      type:
        ext === "md"
          ? "text/markdown;charset=utf-8"
          : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billclarity-mi4-kdmirah-${slug || "audit"}-${lang}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleChecklist = async (id: string) => {
    const next = {
      ...audit.checklistState,
      [id]: !audit.checklistState[id],
    };
    await onUpdateAudit({ checklistState: next });
  };

  const handleAddCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    const nextList: CustomQuestion[] = [
      ...audit.customQuestions,
      {
        id: `cq-${Date.now()}`,
        text: newQuestionText.trim(),
        intent: newQuestionIntent,
      },
    ];
    await onUpdateAudit({ customQuestions: nextList });
    setNewQuestionText("");
  };

  const handleDeleteCustomQuestion = async (id: string) => {
    const nextList = audit.customQuestions.filter((q) => q.id !== id);
    await onUpdateAudit({ customQuestions: nextList });
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    const creditText = promisedCreditStr.trim();
    const creditCents = creditText === "" ? 0 : parseMoneyInput(creditText);
    if (creditCents === null || creditCents < 0) {
      setCreditInvalid(true);
      return;
    }
    setCreditInvalid(false);

    setSavingOutcome(true);
    try {
      await onUpdateAudit({
        supportRefNumber: supportRef.trim(),
        promisedCreditCents: creditCents,
        supportNotes: supportNotes.trim(),
        status,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSavingOutcome(false);
    }
  };

  const renderQuestionGroup = (
    code: string,
    title: string,
    subtitle: string,
    group: Array<{ item: BillLineItemRow; question: string }>
  ) => {
    if (group.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="border-b border-[var(--rule)] pb-2">
          <div className="flex items-baseline gap-2">
            <span className="rams-kicker">{code}</span>
            <h4 className="text-xs font-bold tracking-wide text-[var(--ink)] uppercase">
              {title}
            </h4>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            {subtitle}
          </p>
        </div>
        <div className="divide-y divide-[var(--rule)] border border-[var(--rule)]">
          {group.map(({ item, question }) => (
            <div key={item.id} className="bg-[var(--bg)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">
                    {item.rawLabel}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                    {item.plainTitle}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--ink)] tabular-nums">
                    {formatMoney(item.amountCents, audit.currency)}
                  </span>
                  <select
                    aria-label={`Resolution status for ${item.rawLabel}`}
                    value={item.resolutionStatus}
                    onChange={(e) =>
                      onUpdateItem(item.id, {
                        resolutionStatus: e.target.value as ResolutionStatus,
                        reanalyze: false,
                      })
                    }
                    className="rams-input w-auto py-1 font-mono text-[11px]"
                  >
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
                    <option value="open">
                      {ms ? "Dalam Semakan" : "In Review"}
                    </option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateItem(item.id, {
                        includeInBrief: false,
                        reanalyze: false,
                      })
                    }
                    title={
                      ms
                        ? "Keluarkan daripada Ringkasan Sokongan"
                        : "Remove from Support Brief"
                    }
                    className="rams-btn px-2 py-1 text-[var(--ink-muted)] hover:text-[var(--signal-alert)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 border-l-2 border-l-[var(--ink)] bg-[var(--bg-subtle)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
                &ldquo;{question}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Left Main Brief Column */}
      <div className="space-y-8 lg:col-span-8">
        {/* Export Action Toolbar */}
        <section className="rams-box flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-subtle)] px-5 py-4">
          <div>
            <div className="text-sm font-bold text-[var(--ink)]">
              {ms
                ? "Ringkasan Persediaan Sokongan Anda"
                : "Your Actionable Support Prep Brief"}
            </div>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              <span className="font-mono tabular-nums">
                {totalQuestionCount}
              </span>{" "}
              {ms
                ? "soalan sedia · Angg. amaun boleh laras:"
                : `question${totalQuestionCount === 1 ? "" : "s"} ready · Est. clarifiable amount:`}{" "}
              <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
                {formatMoney(summary.estimatedAdjustableCents, audit.currency)}
              </span>{" "}
              ({ms ? "anggaran" : "estimate"})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => copyToClipboard(brief.plainTextExport, "full")}
              className="rams-btn-primary"
            >
              {copiedFull ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {ms ? "Disalin!" : "Copied Brief!"}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {ms ? "Salin untuk Sembang" : "Copy for Live Chat"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => downloadFile(brief.plainTextExport, "txt")}
              className="rams-btn font-mono"
            >
              <Download className="h-3.5 w-3.5" />
              .txt
            </button>
            <button
              type="button"
              onClick={() => downloadFile(brief.markdownExport, "md")}
              className="rams-btn font-mono"
            >
              <Download className="h-3.5 w-3.5" />
              .md
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rams-btn"
            >
              <Printer className="h-3.5 w-3.5" />
              {ms ? "Cetak" : "Print"}
            </button>
          </div>
        </section>

        {/* 01 Opening Script */}
        <section className="rams-box p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {ms
                ? "1. Skrip Pembukaan Tenang & Berfakta"
                : "1. Calm, Factual Opening Statement"}
            </h3>
            <button
              type="button"
              onClick={() => copyToClipboard(brief.openingScript, "script")}
              className="rams-btn py-1"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {ms ? "Disalin" : "Copied"}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {ms ? "Salin Pembuka" : "Copy Opener"}
                </>
              )}
            </button>
          </div>
          <blockquote className="border-l-2 border-l-[var(--ink)] bg-[var(--bg-subtle)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)]">
            &ldquo;{brief.openingScript}&rdquo;
          </blockquote>
        </section>

        {/* 02 Prioritized Questions */}
        <section className="rams-box p-5">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--rule)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {ms
                  ? "2. Soalan Utama untuk Khidmat Pelanggan"
                  : "2. Prioritized Questions to Ask Support"}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                {ms
                  ? "Dikumpulkan mengikut matlamat supaya perbualan anda kekal teratur."
                  : "Grouped by outcome so you stay focused during your call or chat."}
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToAudit}
              className="font-mono text-xs font-semibold text-[var(--ink)] underline underline-offset-4 hover:opacity-70"
            >
              {ms ? "+ Pilih Lagi Caj" : "+ Pick More Charges"}
            </button>
          </div>

          {totalQuestionCount === 0 ? (
            <div className="rams-box-subtle p-5 text-left">
              <p className="text-xs text-[var(--ink-soft)]">
                {ms
                  ? "Tiada item baris dipilih untuk Ringkasan Sokongan anda buat masa ini."
                  : "No line items are currently toggled for your Support Brief."}
              </p>
              <button
                type="button"
                onClick={onGoToAudit}
                className="rams-btn-primary mt-3"
              >
                {ms
                  ? "Pilih Caj dalam Audit Baris demi Baris"
                  : "Select Charges in Line-by-Line Audit"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {renderQuestionGroup(
                "2A",
                ms
                  ? "Semak / Mohon Kredit Ihsan"
                  : "Question / Request Courtesy Credit",
                ms
                  ? "Promosi tamat tempoh, perayauan/lebihan tidak dijangka, atau fi pengaktifan/lewat bayar sekali sahaja"
                  : "Expired promos, unexpected roaming/overages, or one-time activation/late fees",
                brief.creditRequests
              )}
              {renderQuestionGroup(
                "2B",
                ms
                  ? "Penjelasan Pengiraan & Perubahan Kadar"
                  : "Clarify Calculation & Rate Changes",
                ms
                  ? "Kiraan prorata, kenaikan kadar asas, surcaj syarikat, atau item tidak dikenal pasti"
                  : "Proration math, base rate increases, carrier surcharges, or unrecognized items",
                brief.clarifications
              )}
              {renderQuestionGroup(
                "2C",
                ms
                  ? "Tambahan Pilihan & Peralatan untuk Disemak atau Dibatalkan"
                  : "Optional Add-Ons & Equipment to Review or Cancel",
                ms
                  ? "Pelan perlindungan berulang, caj penyata kertas, atau perkakasan sewaan yang mungkin tidak diperlukan"
                  : "Recurring protection plans, paper fees, or rented hardware you may not need",
                brief.cancelOrReview
              )}

              {brief.customQuestions.length > 0 && (
                <div className="space-y-3">
                  <div className="border-b border-[var(--rule)] pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="rams-kicker">2D</span>
                      <h4 className="text-xs font-bold tracking-wide text-[var(--ink)] uppercase">
                        {ms
                          ? "Soalan Tambahan Tersuai"
                          : "Additional Custom Questions"}
                      </h4>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--rule)] border border-[var(--rule)]">
                    {brief.customQuestions.map((cq) => (
                      <div
                        key={cq.id}
                        className="flex items-start justify-between gap-3 bg-[var(--bg)] px-4 py-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="rams-tag mr-2">{cq.intent}</span>
                          <span className="text-[var(--ink)]">{cq.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomQuestion(cq.id)}
                          className="p-1 text-[var(--ink-muted)] hover:text-[var(--signal-alert)]"
                          aria-label="Delete custom question"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Custom Question Form */}
          <form
            onSubmit={handleAddCustomQuestion}
            className="rams-box-subtle mt-6 p-4"
          >
            <label className="rams-label">
              {ms
                ? "Tambah Soalan Umum ke Ringkasan Anda"
                : "Add a General Question to Your Brief"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={newQuestionIntent}
                onChange={(e) =>
                  setNewQuestionIntent(
                    e.target.value as CustomQuestion["intent"]
                  )
                }
                className="rams-input w-auto text-xs sm:w-40"
              >
                <option value="clarify">
                  {ms ? "Penjelasan" : "Clarify"}
                </option>
                <option value="credit">
                  {ms ? "Mohon Kredit" : "Ask for Credit"}
                </option>
                <option value="cancel">
                  {ms ? "Batal / Tukar" : "Cancel / Change"}
                </option>
              </select>
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder={
                  ms
                    ? "cth., Berapakah jumlah penuh bil bulanan saya pada kitaran seterusnya selepas caj sekali sahaja selesai?"
                    : "e.g., What will my exact all-in monthly total be next cycle once one-time fees clear?"
                }
                className="rams-input flex-1 text-xs"
              />
              <button type="submit" className="rams-btn-primary">
                <Plus className="h-3.5 w-3.5" />
                {ms ? "Tambah" : "Add"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Right Column: Checklist + Post-Call Outcome Log */}
      <div className="space-y-8 lg:col-span-4">
        {/* Before-You-Contact Checklist */}
        <section className="rams-box">
          <div className="border-b border-[var(--rule)] px-5 py-3.5">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {ms
                ? "Senarai Semak Sebelum Menghubungi Sokongan"
                : "Before You Contact Support"}
            </h3>
          </div>
          <div className="divide-y divide-[var(--rule-soft)]">
            {checklist.map((item) => {
              const checked = Boolean(audit.checklistState[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => handleToggleChecklist(item.id)}
                  className="flex w-full items-start gap-3 bg-[var(--bg)] px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  {/* Honest 1px square checkbox */}
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
                      checked
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                        : "border-[var(--rule)] bg-[var(--bg)]"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-semibold ${
                        checked
                          ? "text-[var(--ink-muted)] line-through"
                          : "text-[var(--ink)]"
                      }`}
                    >
                      {item.label}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-soft)]">
                      {item.hint}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Post-Call Outcome Log */}
        <form onSubmit={handleSaveOutcome} className="rams-box p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {ms
                ? "Log Panggilan & Penjejak Hasil"
                : "Support Call & Outcome Log"}
            </h3>
            {savedNotice && (
              <span className="rams-tag-good">
                <Check className="h-3 w-3" /> {ms ? "Disimpan" : "Saved"}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs leading-relaxed text-[var(--ink-soft)]">
            {ms
              ? "Rekodkan nombor tiket sokongan dan kredit yang dijanjikan supaya anda boleh menyemaknya pada bil bulan hadapan."
              : "Record your support ticket number and promised credit so you can verify it appears on next month's bill."}
          </p>

          <div className="space-y-3.5">
            <div>
              <label className="rams-label">
                {ms ? "Status Kemajuan Audit" : "Audit Progress Status"}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AuditStatus)}
                className="rams-input text-xs"
              >
                <option value="in_review">
                  {ms ? "Dalam Semakan" : "In Review"}
                </option>
                <option value="ready_for_support">
                  {ms
                    ? "Sedia untuk Panggilan Sokongan"
                    : "Ready for Support Call"}
                </option>
                <option value="resolved">
                  {ms ? "Selesai / Ditutup" : "Resolved / Completed"}
                </option>
              </select>
            </div>

            <div>
              <label className="rams-label">
                {ms
                  ? "No. Rujukan Kes / Tiket Sokongan"
                  : "Support Case / Reference #"}
              </label>
              <input
                type="text"
                value={supportRef}
                onChange={(e) => setSupportRef(e.target.value)}
                placeholder="e.g., CASE-2026-88412"
                className="rams-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="rams-label">
                {ms
                  ? "Kredit / Pelarasan Dijanjikan (RM)"
                  : "Promised Credit / Adjustment (RM)"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={promisedCreditStr}
                onChange={(e) => setPromisedCreditStr(e.target.value)}
                placeholder="0.00"
                className="rams-input font-mono text-xs tabular-nums"
              />
              {creditInvalid && (
                <p className="mt-1 text-[11px] font-medium text-[var(--signal-alert)]">
                  {ms
                    ? "Masukkan amaun ringgit yang sah, cth. 38.00 — belum disimpan."
                    : "Enter a valid ringgit amount, e.g. 38.00 — not saved yet."}
                </p>
              )}
            </div>

            <div>
              <label className="rams-label">
                {ms
                  ? "Nota Ejen & Tindakan Susulan Bil Seterusnya"
                  : "Agent Notes & Next-Bill Follow-Up"}
              </label>
              <textarea
                rows={3}
                value={supportNotes}
                onChange={(e) => setSupportNotes(e.target.value)}
                placeholder={
                  ms
                    ? "cth. Ejen Alex mengecualikan pas perayauan RM38 dan memberikan rebat kesetiaan RM10 sebulan selama 12 kitaran mulai bil depan."
                    : "e.g. Agent Alex waived the RM38 roaming pass and applied an RM10-a-month loyalty rebate for 12 cycles from the next bill."
                }
                className="rams-input text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={savingOutcome}
              className="rams-btn-primary w-full"
            >
              {savingOutcome && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {ms ? "Simpan Hasil Sokongan" : "Save Support Outcome"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
