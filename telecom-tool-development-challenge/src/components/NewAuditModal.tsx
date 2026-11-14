"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import type { ServiceType } from "@/db/schema";
import type { AuditWithItems } from "@/lib/audit-service";
import {
  CURRENCY_SYMBOL,
  FLAG_META,
  analyzeLineItem,
  formatMoney,
  getCategoryLabel,
  parseMoneyInput,
  type ParsedBillResult,
} from "@/lib/bill-analyzer";
import { SAMPLE_RAW_PASTE_TEXT } from "@/lib/sample-bills";
import { usePreferences } from "@/lib/preferences-context";

interface NewAuditModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (audit: AuditWithItems) => void;
}

interface ManualRow {
  id: string;
  rawLabel: string;
  amountStr: string;
  priorStr: string;
  sectionName: string;
}

export function NewAuditModal({
  open,
  onClose,
  onCreated,
}: NewAuditModalProps) {
  const { lang } = usePreferences();
  const ms = lang === "ms";

  const [tab, setTab] = useState<"paste" | "manual">("paste");
  const [title, setTitle] = useState(
    ms ? "Audit Bil Telekom Bulanan Saya" : "My Monthly Telecom Bill Audit"
  );
  const [providerLabel, setProviderLabel] = useState(
    ms ? "Pembekal Mudah Alih / Internet Saya" : "My Mobile / Internet Provider"
  );
  const [serviceType, setServiceType] = useState<ServiceType>("mobile");
  const [periodStart, setPeriodStart] = useState("2026-03-01");
  const [periodEnd, setPeriodEnd] = useState("2026-03-31");
  const [previousTotalStr, setPreviousTotalStr] = useState("");
  const [customerContext, setCustomerContext] = useState("");

  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<ParsedBillResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const [manualRows, setManualRows] = useState<ManualRow[]>([
    {
      id: "row-1",
      rawLabel: "Postpaid 68 Plan (Monthly Fee)",
      amountStr: "68.00",
      priorStr: "68.00",
      sectionName: "Monthly Charges",
    },
    {
      id: "row-2",
      rawLabel: "Loyalty Rebate (Missing this month)",
      amountStr: "0.00",
      priorStr: "-10.00",
      sectionName: "Rebates & Credits",
    },
    {
      id: "row-3",
      rawLabel: "Admin & Processing Fee",
      amountStr: "5.00",
      priorStr: "3.00",
      sectionName: "Fees & Tax",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePreview = rawText.trim() ? preview : null;
  const foreignMarkers = activePreview?.foreignCurrencyMarkers ?? [];

  useEffect(() => {
    if (!open || tab !== "paste") return;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const handle = setTimeout(async () => {
      setParsing(true);
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: trimmed }),
        });
        if (res.ok) {
          const data: ParsedBillResult = await res.json();
          setPreview(data);
          if (
            data.detectedPreviousTotalCents &&
            data.detectedPreviousTotalCents > 0 &&
            previousTotalStr.trim() === ""
          ) {
            setPreviousTotalStr(
              (data.detectedPreviousTotalCents / 100).toFixed(2)
            );
          }
        }
      } catch {
        // Preview will retry on next input change.
      } finally {
        setParsing(false);
      }
    }, 260);

    return () => clearTimeout(handle);
  }, [rawText, open, tab, previousTotalStr]);

  if (!open) return null;

  const addManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length}`,
        rawLabel: "",
        amountStr: "",
        priorStr: "",
        sectionName: "General Charges",
      },
    ]);
  };

  const removeManualRow = (id: string) => {
    setManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateManualRow = (
    id: string,
    field: keyof ManualRow,
    value: string
  ) => {
    setManualRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleLoadSamplePaste = () => {
    setRawText(SAMPLE_RAW_PASTE_TEXT);
    setTitle(
      ms
        ? "Bil Mudah Alih + Wi-Fi Rumah Mac (Sampel Tampalan)"
        : "March Mobile + Home Wi-Fi Bill (Pasted Sample)"
    );
    setProviderLabel(
      ms ? "Northwind Mobile (Rekaan)" : "Northwind Mobile (Fictional)"
    );
    setServiceType("bundle");
    setPreviousTotalStr("77.38");
    setCustomerContext(
      ms
        ? "Bil saya melonjak kira-kira RM80 selepas saya menaik taraf pelan pada pertengahan bulan, dan terdapat caj tambah nilai data serta perlindungan peranti yang saya tidak kenali."
        : "My bill jumped by about RM80 after I upgraded my plan mid-month, and there is a data top-up and a device protection charge I do not recognise."
    );
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !providerLabel.trim()) {
      setError(
        ms
          ? "Sila masukkan nama audit dan nama pembekal."
          : "Please enter an audit name and a provider nickname."
      );
      return;
    }

    const previousText = previousTotalStr.trim();
    const previousTotalCents =
      previousText === "" ? 0 : parseMoneyInput(previousText);
    if (previousTotalCents === null || previousTotalCents < 0) {
      setError(
        ms
          ? "Jumlah bil bulan lepas mestilah amaun ringgit yang sah, cth. 148.40."
          : "Last month's bill total must be a valid ringgit amount, e.g. 148.40."
      );
      return;
    }

    const shared = {
      title: title.trim(),
      providerLabel: providerLabel.trim(),
      serviceType,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      previousTotalCents,
      customerContext: customerContext.trim(),
    };

    let body: Record<string, unknown>;

    if (tab === "paste") {
      if (!rawText.trim()) {
        setError(
          ms
            ? "Sila tampal baris bil anda dahulu (atau klik “Muatkan Contoh Tampalan Sintetik”)."
            : "Please paste your bill lines first (or click “Load Synthetic Paste Example”)."
        );
        return;
      }
      body = { mode: "paste", ...shared, rawBillText: rawText };
    } else {
      const prepared: Array<{
        rawLabel: string;
        sectionName: string;
        amountCents: number;
        priorAmountCents: number | null;
      }> = [];

      for (const [index, row] of manualRows.entries()) {
        const labelText = row.rawLabel.trim();
        const amountText = row.amountStr.trim();
        const priorText = row.priorStr.trim();
        if (!labelText && !amountText && !priorText) continue;

        const amountCents = parseMoneyInput(amountText);
        const priorCents = priorText === "" ? null : parseMoneyInput(priorText);
        if (
          !labelText ||
          amountCents === null ||
          (priorText !== "" && priorCents === null)
        ) {
          setError(
            ms
              ? `Baris ${index + 1}: masukkan perihalan caj dan amaun ringgit yang sah (cth. 15.00, atau -10.00 untuk kredit).`
              : `Line ${index + 1}: enter a charge description and valid ringgit amounts (e.g. 15.00, or -10.00 for a credit).`
          );
          return;
        }

        prepared.push({
          rawLabel: labelText,
          sectionName: row.sectionName.trim() || "General Charges",
          amountCents,
          priorAmountCents: priorCents,
        });
      }

      if (prepared.length === 0) {
        setError(
          ms
            ? "Sila lengkapkan sekurang-kurangnya satu perihalan caj dan amaun."
            : "Please complete at least one charge description and amount."
        );
        return;
      }

      body = { mode: "manual", ...shared, items: prepared };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_CHARGE_LINES") {
          setError(
            ms
              ? "Tiada baris caj beramaun dikesan. Letakkan setiap caj dan amaun ringgitnya pada baris tersendiri, cth. “Postpaid 98 Plan  RM98.00”."
              : "No charge lines with amounts were found. Put each charge and its ringgit amount on its own line, e.g. “Postpaid 98 Plan  RM98.00”."
          );
        } else {
          setError(
            ms
              ? "Audit bil tidak dapat disimpan. Sila semak butiran dan cuba lagi."
              : data.error || "The bill audit could not be saved."
          );
        }
        return;
      }

      onCreated(data.audit);
      onClose();
    } catch {
      setError(
        ms
          ? "Ralat rangkaian semasa menyimpan audit bil. Sila cuba lagi."
          : "Network error while saving the bill audit. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-audit-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-[var(--ink)] bg-[var(--bg)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] px-6 py-4">
          <div>
            <div className="rams-kicker">MI4, INC. · kdmirah lab</div>
            <h2
              id="new-audit-title"
              className="mt-1 text-base font-bold text-[var(--ink)]"
            >
              {ms ? "Analisis Bil Telekom" : "Analyze a Telecom Bill"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              {ms
                ? "Tampal teks bil atau masukkan caj secara manual. Semua amaun dalam Ringgit Malaysia (RM)."
                : "Paste copied bill lines or enter charges by hand. All amounts are in Malaysian Ringgit (RM)."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rams-btn px-2 py-1.5"
            aria-label={ms ? "Tutup" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Privacy Notice */}
            <div className="rams-box-subtle px-4 py-2.5 text-xs leading-relaxed text-[var(--ink-soft)]">
              {ms ? (
                <>
                  <strong className="text-[var(--ink)]">Tip privasi:</strong>{" "}
                  Hanya sertakan label caj dan amaun ringgit. Buang nombor
                  akaun, nombor MyKad / pasport, nombor telefon dan alamat
                  sebelum menampal.
                </>
              ) : (
                <>
                  <strong className="text-[var(--ink)]">Privacy tip:</strong>{" "}
                  Only include charge labels and ringgit amounts. Remove account
                  numbers, MyKad / passport numbers, phone numbers and addresses
                  before pasting.
                </>
              )}
            </div>

            {/* Mode Switch */}
            <div className="grid grid-cols-2 border border-[var(--rule)]">
              <button
                type="button"
                aria-pressed={tab === "paste"}
                onClick={() => {
                  setTab("paste");
                  setError(null);
                }}
                className={`border-r border-[var(--rule)] px-4 py-2.5 text-xs font-semibold transition-colors ${
                  tab === "paste"
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "bg-[var(--bg)] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                }`}
              >
                {ms ? "Tampal Teks Bil / CSV" : "Paste Bill Text / CSV"}
              </button>
              <button
                type="button"
                aria-pressed={tab === "manual"}
                onClick={() => {
                  setTab("manual");
                  setError(null);
                }}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors ${
                  tab === "manual"
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "bg-[var(--bg)] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                }`}
              >
                {ms ? "Masukkan Caj Secara Manual" : "Enter Charges Manually"}
              </button>
            </div>

            {/* Bill Metadata */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rams-label">
                  {ms ? "Nama Audit" : "Audit Name"}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    ms ? "cth. Bil Mudah Alih Mac" : "e.g. March Mobile Bill"
                  }
                  className="rams-input"
                  required
                />
              </div>

              <div>
                <label className="rams-label">
                  {ms
                    ? "Nama Pembekal (Tiada No. Akaun Diperlukan)"
                    : "Provider Nickname (No Account No. Needed)"}
                </label>
                <input
                  type="text"
                  value={providerLabel}
                  onChange={(e) => setProviderLabel(e.target.value)}
                  placeholder={
                    ms ? "cth. Syarikat Telekom Saya" : "e.g. My Mobile Provider"
                  }
                  className="rams-input"
                  required
                />
              </div>

              <div>
                <label className="rams-label">
                  {ms ? "Jenis Perkhidmatan" : "Service Type"}
                </label>
                <select
                  value={serviceType}
                  onChange={(e) =>
                    setServiceType(e.target.value as ServiceType)
                  }
                  className="rams-input"
                >
                  <option value="mobile">
                    {ms ? "Mudah Alih (Pascabayar / Prabayar)" : "Mobile"}
                  </option>
                  <option value="broadband">
                    {ms
                      ? "Jalur Lebar / Internet Rumah"
                      : "Home Broadband / Internet"}
                  </option>
                  <option value="bundle">
                    {ms
                      ? "Pakej Mudah Alih + Internet Rumah"
                      : "Mobile + Home Bundle"}
                  </option>
                </select>
              </div>

              <div>
                <label className="rams-label">
                  {ms
                    ? `Jumlah Bil Bulan Lepas (Pilihan, ${CURRENCY_SYMBOL})`
                    : `Last Month's Bill Total (Optional, ${CURRENCY_SYMBOL})`}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={previousTotalStr}
                  onChange={(e) => setPreviousTotalStr(e.target.value)}
                  placeholder={ms ? "cth. 148.40" : "e.g. 148.40"}
                  className="rams-input font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="rams-label">
                  {ms ? "Tarikh Mula Kitaran Bil" : "Billing Cycle Start"}
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="rams-input font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="rams-label">
                  {ms ? "Tarikh Akhir Kitaran Bil" : "Billing Cycle End"}
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="rams-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="rams-label">
                {ms
                  ? "Apakah yang mengejutkan anda atau berubah bulan ini? (Pilihan)"
                  : "What surprised you or changed this month? (Optional)"}
              </label>
              <input
                type="text"
                value={customerContext}
                onChange={(e) => setCustomerContext(e.target.value)}
                placeholder={
                  ms
                    ? "cth. Menukar pelan pertengahan bulan, ke luar negara, atau bil naik tiba-tiba"
                    : "e.g. Changed plan mid-month, travelled abroad, or the bill jumped unexpectedly"
                }
                className="rams-input"
              />
            </div>

            {tab === "paste" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[var(--ink-soft)]">
                    {ms
                      ? `Tampal Baris Caj (satu caj dan amaun ${CURRENCY_SYMBOL} setiap baris, atau CSV)`
                      : `Paste Line Items (one charge and its ${CURRENCY_SYMBOL} amount per line, or CSV)`}
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSamplePaste}
                    className="rams-btn py-1"
                  >
                    {ms
                      ? "Muatkan Contoh Tampalan Sintetik"
                      : "Load Synthetic Paste Example"}
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Postpaid 98 Plan (Monthly Fee)     RM98.00\nAuto-Debit Rebate                 -RM10.00\nRoaming Day Pass (2 Days)          RM38.00\nAdmin & Processing Fee              RM5.00\nService Tax (SST) 6%                RM7.86`}
                  className="rams-input font-mono text-xs leading-relaxed"
                />

                {parsing && (
                  <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {ms
                      ? "Mengesan baris caj dan menterjemah istilah telekom…"
                      : "Detecting line items and decoding telecom jargon…"}
                  </div>
                )}

                {foreignMarkers.length > 0 && (
                  <div className="border border-[var(--signal-warn)] border-l-2 bg-[var(--signal-warn-bg)] px-3.5 py-2.5 text-xs text-[var(--signal-warn)]">
                    {ms ? (
                      <>
                        Amaun bertanda{" "}
                        <strong>{foreignMarkers.join(", ")}</strong> dikesan.
                        Alat ini menggunakan ringgit sahaja, jadi angka tersebut
                        akan dibaca sebagai {CURRENCY_SYMBOL}{" "}
                        <strong>tanpa penukaran mata wang</strong>.
                      </>
                    ) : (
                      <>
                        Amounts marked{" "}
                        <strong>{foreignMarkers.join(", ")}</strong> were found.
                        This tool works in ringgit only, so those figures will
                        be read as {CURRENCY_SYMBOL} with{" "}
                        <strong>no currency conversion</strong>.
                      </>
                    )}
                  </div>
                )}

                {activePreview && activePreview.items.length > 0 && (
                  <div className="rams-box">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] bg-[var(--bg-subtle)] px-3.5 py-2">
                      <span className="font-mono text-xs font-semibold text-[var(--ink)]">
                        {ms
                          ? `Pratonton · ${activePreview.items.length} caj dikesan`
                          : `Live Preview · ${activePreview.items.length} charge${
                              activePreview.items.length === 1 ? "" : "s"
                            } detected`}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--ink)] tabular-nums">
                        {ms ? "Jumlah:" : "Sum:"}{" "}
                        {formatMoney(
                          activePreview.items.reduce(
                            (s, i) => s + i.amountCents,
                            0
                          )
                        )}
                      </span>
                    </div>
                    <div className="max-h-44 divide-y divide-[var(--rule-soft)] overflow-y-auto">
                      {activePreview.items.map((item, idx) => {
                        const cat = getCategoryLabel(
                          item.analysis.category,
                          lang
                        );
                        const flag = FLAG_META[item.analysis.flagLevel];
                        return (
                          <div
                            key={`${item.rawLabel}-${idx}`}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-[var(--ink)]">
                                {item.rawLabel}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rams-tag">
                                  {cat.displayShortLabel}
                                </span>
                                {item.analysis.flagLevel !== "normal" && (
                                  <span
                                    className={`rams-tag ${flag.badgeClass}`}
                                  >
                                    {ms ? flag.labelMs : flag.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 font-mono font-semibold text-[var(--ink)] tabular-nums">
                              {formatMoney(item.amountCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink)]">
                      {ms
                        ? `Baris Caj Bil (amaun dalam ${CURRENCY_SYMBOL})`
                        : `Bill Line Items (amounts in ${CURRENCY_SYMBOL})`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                      {ms ? (
                        <>
                          Gantikan baris contoh di bawah dengan caj anda. Guna
                          amaun negatif (cth.{" "}
                          <code className="font-mono">-10.00</code>) untuk
                          kredit. Bagi rebat yang hilang, masukkan{" "}
                          <code className="font-mono">0.00</code> bil ini dan{" "}
                          <code className="font-mono">-10.00</code> bil lepas.
                        </>
                      ) : (
                        <>
                          Replace the example rows below with your own charges.
                          Use negative amounts (e.g.{" "}
                          <code className="font-mono">-10.00</code>) for
                          credits. For a rebate that vanished, enter{" "}
                          <code className="font-mono">0.00</code> this bill and{" "}
                          <code className="font-mono">-10.00</code> last bill.
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addManualRow}
                    className="rams-btn shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {ms ? "Tambah Baris" : "Add Line"}
                  </button>
                </div>

                <div className="divide-y divide-[var(--rule)] border border-[var(--rule)]">
                  {manualRows.map((row) => {
                    const amt = parseMoneyInput(row.amountStr);
                    const prior = parseMoneyInput(row.priorStr);
                    const quickAnalysis =
                      row.rawLabel.trim() && amt !== null
                        ? analyzeLineItem(
                            {
                              rawLabel: row.rawLabel,
                              amountCents: amt,
                              priorAmountCents: prior,
                            },
                            lang
                          )
                        : null;
                    const cat = quickAnalysis
                      ? getCategoryLabel(quickAnalysis.category, lang)
                      : null;

                    return (
                      <div key={row.id} className="bg-[var(--bg)] p-3.5">
                        <div className="grid gap-2.5 sm:grid-cols-12">
                          <div className="sm:col-span-6">
                            <label className="rams-label">
                              {ms
                                ? "Perihalan Caj pada Bil"
                                : "Charge Wording on Bill"}
                            </label>
                            <input
                              type="text"
                              value={row.rawLabel}
                              onChange={(e) =>
                                updateManualRow(
                                  row.id,
                                  "rawLabel",
                                  e.target.value
                                )
                              }
                              placeholder={
                                ms
                                  ? "cth. Roaming Day Pass atau Caj Pentadbiran"
                                  : "e.g. Roaming Day Pass or Admin Fee"
                              }
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
                              value={row.amountStr}
                              onChange={(e) =>
                                updateManualRow(
                                  row.id,
                                  "amountStr",
                                  e.target.value
                                )
                              }
                              placeholder="0.00"
                              className="rams-input font-mono text-xs tabular-nums"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="rams-label">
                              {ms
                                ? `Bil Lepas (${CURRENCY_SYMBOL}, pil.)`
                                : `Last Bill (${CURRENCY_SYMBOL}, opt.)`}
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.priorStr}
                              onChange={(e) =>
                                updateManualRow(
                                  row.id,
                                  "priorStr",
                                  e.target.value
                                )
                              }
                              placeholder={ms ? "pilihan" : "optional"}
                              className="rams-input font-mono text-xs tabular-nums"
                            />
                          </div>
                          <div className="flex items-end justify-end sm:col-span-1">
                            <button
                              type="button"
                              onClick={() => removeManualRow(row.id)}
                              disabled={manualRows.length <= 1}
                              className="rams-btn px-2 py-2 text-[var(--ink-muted)] hover:text-[var(--signal-alert)]"
                              aria-label={ms ? "Buang baris" : "Remove line"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {quickAnalysis && cat && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-soft)]">
                            <span className="rams-tag">
                              {cat.displayShortLabel}
                            </span>
                            <span className="truncate">
                              {ms ? "Dinyahkod sebagai:" : "Decoded as:"}{" "}
                              <strong className="text-[var(--ink)]">
                                {quickAnalysis.plainTitle}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="border border-[var(--signal-alert)] border-l-2 bg-[var(--signal-alert-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--signal-alert)]">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] bg-[var(--bg-subtle)] px-6 py-4">
            <span className="text-xs text-[var(--ink-muted)]">
              {ms
                ? "Disimpan dalam pangkalan data aplikasi ini supaya anda boleh menjejak hasil sokongan."
                : "Saved to this app's database so you can track support outcomes."}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={onClose} className="rams-btn">
                {ms ? "Batal" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rams-btn-primary"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {ms ? "Nyahkod & Audit Bil" : "Decode & Audit Bill"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
