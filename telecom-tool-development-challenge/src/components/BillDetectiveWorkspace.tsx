"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  RotateCcw,
  Trash2,
  Loader2,
  X,
  Check,
} from "lucide-react";
import type { BillAuditRow, BillLineItemRow, CustomQuestion } from "@/db/schema";
import type { AuditListItem, AuditWithItems } from "@/lib/audit-service";
import {
  buildSupportBrief,
  computeAuditSummary,
  formatDateRange,
  formatDelta,
  formatMoney,
  presentLineItem,
} from "@/lib/bill-analyzer";
import { UI_TEXT, type Language, type ThemeMode } from "@/lib/i18n";
import { SAMPLE_SLUG_ORDER, SAMPLE_TEXT_BY_SLUG } from "@/lib/sample-bills";
import { usePreferences } from "@/lib/preferences-context";
import { AboutModal } from "./AboutModal";
import { NewAuditModal } from "./NewAuditModal";
import { BillBreakdownPanel } from "./BillBreakdownPanel";
import { ProrationCalculator } from "./ProrationCalculator";
import { SupportBriefPanel } from "./SupportBriefPanel";

interface BillDetectiveWorkspaceProps {
  initialAudits: AuditListItem[];
  initialActiveAudit: AuditWithItems | null;
}

type WorkflowTab = "audit" | "proration" | "brief";

function localizeAuditFields<
  T extends Pick<
    BillAuditRow,
    "sampleSlug" | "title" | "providerLabel" | "customerContext"
  >,
>(audit: T, lang: Language): T {
  if (!audit.sampleSlug) return audit;
  const loc = SAMPLE_TEXT_BY_SLUG[audit.sampleSlug]?.[lang];
  if (!loc) return audit;
  return {
    ...audit,
    title: loc.title,
    providerLabel: loc.providerLabel,
    customerContext: loc.customerContext,
  };
}

export function BillDetectiveWorkspace({
  initialAudits,
  initialActiveAudit,
}: BillDetectiveWorkspaceProps) {
  const { lang, setLang, theme, setTheme } = usePreferences();
  const t = UI_TEXT[lang];

  const [audits, setAudits] = useState<AuditListItem[]>(initialAudits);
  const [activeAudit, setActiveAudit] = useState<AuditWithItems | null>(
    initialActiveAudit
  );
  const [activeTab, setActiveTab] = useState<WorkflowTab>("audit");
  const [loadingAuditId, setLoadingAuditId] = useState<string | null>(null);
  const [resettingSlug, setResettingSlug] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showIntroStrip, setShowIntroStrip] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3000);
  }, []);

  const refreshAuditList = useCallback(async () => {
    const res = await fetch("/api/audits", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAudits(data.audits);
    }
  }, []);

  const selectAudit = useCallback(async (id: string) => {
    setLoadingAuditId(id);
    try {
      const res = await fetch(`/api/audits/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActiveAudit(data.audit);
        setActiveTab("audit");
      }
    } finally {
      setLoadingAuditId(null);
    }
  }, []);

  const handleCreated = useCallback(
    async (created: AuditWithItems) => {
      setActiveAudit(created);
      setActiveTab("audit");
      await refreshAuditList();
      showToast(t.toastCreated);
    },
    [refreshAuditList, showToast, t.toastCreated]
  );

  const handleResetSample = useCallback(
    async (sampleSlug: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setResettingSlug(sampleSlug);
      try {
        const res = await fetch("/api/audits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "reset_sample", sampleSlug }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveAudit(data.audit);
          await refreshAuditList();
          showToast(t.toastReset);
        }
      } finally {
        setResettingSlug(null);
      }
    },
    [refreshAuditList, showToast, t.toastReset]
  );

  const handleDeleteAudit = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const res = await fetch(`/api/audits/${id}`, { method: "DELETE" });
      if (!res.ok) return;

      const remaining = audits.filter((a) => a.id !== id);
      setAudits(remaining);
      if (activeAudit?.id === id) {
        if (remaining.length > 0) {
          await selectAudit(remaining[0].id);
        } else {
          setActiveAudit(null);
        }
      }
      showToast(t.toastDeleted);
    },
    [audits, activeAudit, selectAudit, showToast, t.toastDeleted]
  );

  const handleUpdateAudit = useCallback(
    async (patch: Partial<BillAuditRow>) => {
      if (!activeAudit) return;
      const res = await fetch(`/api/audits/${activeAudit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveAudit(data.audit);
        await refreshAuditList();
      }
    },
    [activeAudit, refreshAuditList]
  );

  const handleAddItem = useCallback(
    async (payload: {
      rawLabel: string;
      sectionName?: string;
      amountCents: number;
      priorAmountCents?: number | null;
    }) => {
      if (!activeAudit) return;
      const res = await fetch(`/api/audits/${activeAudit.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveAudit((prev) =>
          prev
            ? {
                ...prev,
                currentTotalCents: data.currentTotalCents,
                items: [...prev.items, data.item],
              }
            : null
        );
        await refreshAuditList();
        showToast(t.toastItemAdded);
      }
    },
    [activeAudit, refreshAuditList, showToast, t.toastItemAdded]
  );

  const handleUpdateItem = useCallback(
    async (
      itemId: string,
      patch: Partial<BillLineItemRow> & { reanalyze?: boolean }
    ) => {
      if (!activeAudit) return;
      const res = await fetch(
        `/api/audits/${activeAudit.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActiveAudit((prev) =>
          prev
            ? {
                ...prev,
                currentTotalCents: data.currentTotalCents,
                items: prev.items.map((item) =>
                  item.id === itemId ? data.item : item
                ),
              }
            : null
        );
        await refreshAuditList();
      }
    },
    [activeAudit, refreshAuditList]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!activeAudit) return;
      const res = await fetch(
        `/api/audits/${activeAudit.id}/items/${itemId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        const data = await res.json();
        setActiveAudit((prev) =>
          prev
            ? {
                ...prev,
                currentTotalCents: data.currentTotalCents,
                items: prev.items.filter((item) => item.id !== itemId),
              }
            : null
        );
        await refreshAuditList();
        showToast(t.toastItemRemoved);
      }
    },
    [activeAudit, refreshAuditList, showToast, t.toastItemRemoved]
  );

  const handleAddCustomQuestion = useCallback(
    async (text: string, intent: CustomQuestion["intent"]) => {
      if (!activeAudit) return;
      const next: CustomQuestion[] = [
        ...activeAudit.customQuestions,
        { id: `cq-${Date.now()}`, text, intent },
      ];
      await handleUpdateAudit({ customQuestions: next });
      showToast(t.toastQuestionAdded);
    },
    [activeAudit, handleUpdateAudit, showToast, t.toastQuestionAdded]
  );

  const localizedActiveAudit = useMemo(() => {
    if (!activeAudit) return null;
    return {
      ...localizeAuditFields(activeAudit, lang),
      items: activeAudit.items.map((item) => presentLineItem(item, lang)),
    };
  }, [activeAudit, lang]);

  const sampleAudits = useMemo(
    () =>
      audits
        .filter((a) => a.dataSource === "simulated_sample")
        .map((a) => localizeAuditFields(a, lang))
        .sort(
          (a, b) =>
            SAMPLE_SLUG_ORDER.indexOf(a.sampleSlug ?? "") -
            SAMPLE_SLUG_ORDER.indexOf(b.sampleSlug ?? "")
        ),
    [audits, lang]
  );

  const userAudits = useMemo(
    () => audits.filter((a) => a.dataSource !== "simulated_sample"),
    [audits]
  );

  const summary = useMemo(() => {
    if (!localizedActiveAudit) return null;
    return computeAuditSummary(
      localizedActiveAudit,
      localizedActiveAudit.items,
      lang
    );
  }, [localizedActiveAudit, lang]);

  const printableBrief = useMemo(() => {
    if (!localizedActiveAudit || !summary) return null;
    return buildSupportBrief(
      localizedActiveAudit,
      localizedActiveAudit.items,
      summary,
      lang
    );
  }, [localizedActiveAudit, summary, lang]);

  const serviceLabel = (type: string) => {
    if (type === "broadband") return t.serviceBroadband;
    if (type === "bundle") return t.serviceBundle;
    return t.serviceMobile;
  };

  const themeOptions: Array<{ mode: ThemeMode; label: string }> = [
    { mode: "light", label: t.themeLight },
    { mode: "dark", label: t.themeDark },
    { mode: "system", label: t.themeSystem },
  ];

  return (
    <>
      <div className="no-print flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
        {/* Top Instrument Header — 1px rule, zero blur, zero shadow */}
        <header className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
            {/* Brand & Instrument Identity */}
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase">
                  {t.brandOrg} · {t.brandLab}
                </span>
                <span className="text-[var(--rule)]" aria-hidden="true">
                  /
                </span>
                <span className="text-base font-bold tracking-tight text-[var(--ink)]">
                  {t.appTitle}
                </span>
                <span className="rams-tag hidden md:inline-flex">
                  {t.appBadge}
                </span>
              </div>
              <p className="hidden text-xs text-[var(--ink-soft)] sm:block">
                {t.appSubtitle}
              </p>
            </div>

            {/* Flat Instrument Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Language Switch (EN / BM) */}
              <div
                className="rams-seg"
                role="group"
                aria-label={t.langLabel}
              >
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  aria-pressed={lang === "en"}
                  className="rams-seg-btn"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang("ms")}
                  aria-pressed={lang === "ms"}
                  className="rams-seg-btn"
                >
                  BM
                </button>
              </div>

              {/* Theme Switch (Light / Dark / System) */}
              <div
                className="rams-seg"
                role="group"
                aria-label="Theme selector"
              >
                {themeOptions.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    title={label}
                    aria-pressed={theme === mode}
                    className="rams-seg-btn"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="rams-btn"
              >
                <span className="hidden md:inline">{t.guideBtn}</span>
                <span className="md:hidden">{t.guideShortBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="rams-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.analyzeBtn}
              </button>
            </div>
          </div>
        </header>

        {/* Purpose Strip — Unobtrusive 1px rule */}
        {showIntroStrip && (
          <div className="border-b border-[var(--rule)] bg-[var(--bg-subtle)]">
            <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-5 py-2.5 sm:px-8">
              <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
                <strong className="font-semibold text-[var(--ink)]">
                  {t.introFor}
                </strong>{" "}
                {t.introText}
              </p>
              <button
                type="button"
                onClick={() => setShowIntroStrip(false)}
                className="shrink-0 p-0.5 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                aria-label="Dismiss notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Grid — Left-Aligned Structure, Generous Whitespace */}
        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-12">
          {/* Left Column: Channels / Statements */}
          <aside className="space-y-8 lg:col-span-3">
            {/* Simulated Sample Scenarios */}
            <section className="rams-box">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--rule)] px-4 py-3">
                <h2 className="rams-kicker">{t.simulatedSamplesHeader}</h2>
                <span className="rams-tag">{t.fictionalDataBadge}</span>
              </div>
              <p className="border-b border-[var(--rule-soft)] px-4 py-2.5 text-xs leading-relaxed text-[var(--ink-soft)]">
                {t.simulatedSamplesDesc}
              </p>

              <div className="divide-y divide-[var(--rule-soft)]">
                {sampleAudits.map((item) => {
                  const isActive = activeAudit?.id === item.id;
                  const delta =
                    item.currentTotalCents - item.previousTotalCents;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectAudit(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectAudit(item.id);
                        }
                      }}
                      className={`group cursor-pointer border-l-2 px-4 py-3.5 text-left transition-colors ${
                        isActive
                          ? "border-l-[var(--ink)] bg-[var(--bg-subtle)]"
                          : "border-l-transparent bg-[var(--bg)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] tracking-wide text-[var(--ink-muted)] uppercase">
                            {serviceLabel(item.serviceType)} ·{" "}
                            {item.providerLabel}
                          </div>
                          <div className="mt-1 text-xs font-semibold leading-snug text-[var(--ink)]">
                            {item.title}
                          </div>
                        </div>
                        {loadingAuditId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--ink-muted)]" />
                        ) : (
                          item.sampleSlug && (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleResetSample(item.sampleSlug!, e)
                              }
                              title="Reset sample scenario"
                              className="p-1 text-[var(--ink-muted)] opacity-0 hover:text-[var(--ink)] group-hover:opacity-100 focus:opacity-100"
                            >
                              <RotateCcw
                                className={`h-3.5 w-3.5 ${
                                  resettingSlug === item.sampleSlug
                                    ? "animate-spin"
                                    : ""
                                }`}
                              />
                            </button>
                          )
                        )}
                      </div>

                      <div className="mt-2.5 flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
                        <span className="font-semibold text-[var(--ink)]">
                          {formatMoney(item.currentTotalCents, item.currency)}
                        </span>
                        {item.previousTotalCents > 0 ? (
                          <span
                            className={
                              delta > 0
                                ? "text-[var(--signal-alert)]"
                                : "text-[var(--ink-soft)]"
                            }
                          >
                            {formatDelta(delta, item.currency)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--ink-muted)]">
                            {t.noPriorBill}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* User-Entered Saved Audits */}
            <section className="rams-box">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--rule)] px-4 py-3">
                <h2 className="rams-kicker">
                  {t.yourAuditsHeader} ({userAudits.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="font-mono text-[11px] font-semibold text-[var(--ink)] underline underline-offset-4 hover:opacity-70"
                >
                  {t.newShortBtn}
                </button>
              </div>

              {userAudits.length === 0 ? (
                <div className="space-y-3 p-4 text-left">
                  <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
                    {t.emptyUserAudits}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(true)}
                    className="rams-btn w-full justify-start"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.startMyAuditBtn}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--rule-soft)]">
                  {userAudits.map((item) => {
                    const isActive = activeAudit?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectAudit(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectAudit(item.id);
                          }
                        }}
                        className={`group cursor-pointer border-l-2 px-4 py-3.5 text-left transition-colors ${
                          isActive
                            ? "border-l-[var(--ink)] bg-[var(--bg-subtle)]"
                            : "border-l-transparent bg-[var(--bg)] hover:bg-[var(--bg-subtle)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[10px] tracking-wide text-[var(--ink-muted)] uppercase">
                              {serviceLabel(item.serviceType)} ·{" "}
                              {item.providerLabel}
                            </div>
                            <div className="mt-1 truncate text-xs font-semibold text-[var(--ink)]">
                              {item.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAudit(item.id, e)}
                            title="Delete audit"
                            className="p-1 text-[var(--ink-muted)] opacity-0 hover:text-[var(--signal-alert)] group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2.5 flex items-baseline justify-between gap-2 font-mono text-xs tabular-nums">
                          <span className="font-semibold text-[var(--ink)]">
                            {formatMoney(item.currentTotalCents, item.currency)}
                          </span>
                          <span className="text-[11px] text-[var(--ink-muted)]">
                            {item.status === "resolved"
                              ? t.resolvedLabel
                              : `${item.briefCount} ${t.inBriefCount}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          {/* Right Main Workbench */}
          <main className="min-w-0 space-y-8 lg:col-span-9">
            {!localizedActiveAudit || !summary ? (
              <div className="rams-box p-8 text-left">
                <p className="rams-kicker">00 / WORKBENCH</p>
                <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                  {t.emptyCanvasTitle}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-[var(--ink-soft)]">
                  {t.emptyCanvasDesc}
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(true)}
                    className="rams-btn-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.analyzeBtn}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Statement Header & Workflow Switcher */}
                <div className="rams-box">
                  {/* Data Provenance Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] bg-[var(--bg-subtle)] px-5 py-2">
                    <span className="font-mono text-[11px] font-medium text-[var(--ink-soft)]">
                      {localizedActiveAudit.dataSource === "simulated_sample"
                        ? t.simulatedBanner
                        : t.userEnteredBanner}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAboutModal(true)}
                      className="font-mono text-[11px] text-[var(--ink)] underline underline-offset-4 hover:opacity-75"
                    >
                      {t.methodologyLink}
                    </button>
                  </div>

                  {/* Statement Metadata */}
                  <div className="px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                          <span className="rams-tag">
                            {serviceLabel(localizedActiveAudit.serviceType)}
                          </span>
                          <span>{localizedActiveAudit.providerLabel}</span>
                          <span aria-hidden="true">/</span>
                          <span>
                            {formatDateRange(
                              localizedActiveAudit.billingPeriodStart,
                              localizedActiveAudit.billingPeriodEnd,
                              lang
                            )}
                          </span>
                        </div>
                        <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--ink)]">
                          {localizedActiveAudit.title}
                        </h1>
                        {localizedActiveAudit.customerContext && (
                          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--ink-soft)]">
                            <strong className="font-semibold text-[var(--ink)]">
                              {t.contextLabel}
                            </strong>{" "}
                            {localizedActiveAudit.customerContext}
                          </p>
                        )}
                      </div>

                      {localizedActiveAudit.promisedCreditCents > 0 && (
                        <div className="border border-[var(--signal-good)] bg-[var(--signal-good-bg)] px-3.5 py-2 text-left">
                          <div className="font-mono text-[10px] font-semibold tracking-wider text-[var(--signal-good)] uppercase">
                            {t.loggedCreditPromised}
                          </div>
                          <div className="mt-0.5 font-mono text-base font-bold text-[var(--signal-good)] tabular-nums">
                            {formatMoney(
                              localizedActiveAudit.promisedCreditCents,
                              localizedActiveAudit.currency
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3-Step Workflow Bar — Shared 1px Rules, Honest Active State */}
                  <div className="grid grid-cols-1 border-t border-[var(--rule)] sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("audit")}
                      aria-pressed={activeTab === "audit"}
                      className={`flex items-center justify-between border-b border-[var(--rule)] px-5 py-3 text-left text-xs transition-colors sm:border-r sm:border-b-0 ${
                        activeTab === "audit"
                          ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
                          : "bg-[var(--bg)] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span>{t.tabAudit}</span>
                      <span className="font-mono text-[11px] tabular-nums opacity-80">
                        [{localizedActiveAudit.items.length}]
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("proration")}
                      aria-pressed={activeTab === "proration"}
                      className={`flex items-center justify-between border-b border-[var(--rule)] px-5 py-3 text-left text-xs transition-colors sm:border-r sm:border-b-0 ${
                        activeTab === "proration"
                          ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
                          : "bg-[var(--bg)] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span>{t.tabProration}</span>
                      <span className="font-mono text-[11px] opacity-80">
                        RM/d
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("brief")}
                      aria-pressed={activeTab === "brief"}
                      className={`flex items-center justify-between px-5 py-3 text-left text-xs transition-colors ${
                        activeTab === "brief"
                          ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
                          : "bg-[var(--bg)] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span>{t.tabBrief}</span>
                      <span className="font-mono text-[11px] tabular-nums opacity-80">
                        [
                        {summary.briefItemCount +
                          localizedActiveAudit.customQuestions.length}{" "}
                        {t.readySuffix}]
                      </span>
                    </button>
                  </div>
                </div>

                {/* Active Step Content */}
                {activeTab === "audit" && (
                  <BillBreakdownPanel
                    key={localizedActiveAudit.id}
                    audit={localizedActiveAudit}
                    items={localizedActiveAudit.items}
                    summary={summary}
                    onUpdateAudit={handleUpdateAudit}
                    onAddItem={handleAddItem}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                    onGoToBrief={() => setActiveTab("brief")}
                  />
                )}

                {activeTab === "proration" && (
                  <ProrationCalculator
                    key={localizedActiveAudit.id}
                    items={localizedActiveAudit.items}
                    onAddCustomQuestion={handleAddCustomQuestion}
                  />
                )}

                {activeTab === "brief" && (
                  <SupportBriefPanel
                    key={localizedActiveAudit.id}
                    audit={localizedActiveAudit}
                    items={localizedActiveAudit.items}
                    summary={summary}
                    onUpdateAudit={handleUpdateAudit}
                    onUpdateItem={handleUpdateItem}
                    onGoToAudit={() => setActiveTab("audit")}
                  />
                )}
              </>
            )}
          </main>
        </div>

        {/* Footer — 1px rule, plain typography */}
        <footer className="mt-12 border-t border-[var(--rule)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 text-xs text-[var(--ink-muted)] sm:px-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rams-tag text-[var(--ink)]">
                MI4, INC. · kdmirah lab
              </span>
              <span>{t.footerBrand}</span>
            </div>
            <div>{t.footerDisclaimer}</div>
          </div>
        </footer>
      </div>

      {/* Print-Only Support Brief */}
      {localizedActiveAudit && summary && printableBrief && (
        <div className="print-only hidden p-8 font-sans text-black">
          <div className="border-b border-black pb-4">
            <div className="font-mono text-xs font-semibold tracking-widest uppercase">
              {t.printHeader}
            </div>
            <h1 className="mt-1 text-2xl font-bold">
              {localizedActiveAudit.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
              <span>
                <strong>{t.printProvider}</strong>{" "}
                {localizedActiveAudit.providerLabel}
              </span>
              <span>
                <strong>{t.printPeriod}</strong>{" "}
                {formatDateRange(
                  localizedActiveAudit.billingPeriodStart,
                  localizedActiveAudit.billingPeriodEnd,
                  lang
                )}
              </span>
              <span>
                <strong>{t.printCurrentTotal}</strong>{" "}
                {formatMoney(
                  summary.currentTotalCents,
                  localizedActiveAudit.currency
                )}
              </span>
              {summary.previousTotalCents > 0 && (
                <span>
                  <strong>{t.printPriorTotal}</strong>{" "}
                  {formatMoney(
                    summary.previousTotalCents,
                    localizedActiveAudit.currency
                  )}{" "}
                  (
                  {formatDelta(
                    summary.netDeltaCents,
                    localizedActiveAudit.currency
                  )}
                  )
                </span>
              )}
            </div>
            <div className="mt-3 border border-black px-3 py-1.5 font-mono text-[11px]">
              {localizedActiveAudit.dataSource === "simulated_sample"
                ? t.printSimNotice
                : t.printUserNotice}
            </div>
          </div>

          <pre className="mt-5 whitespace-pre-wrap font-mono text-xs leading-relaxed text-black">
            {printableBrief.plainTextExport}
          </pre>
        </div>
      )}

      {/* Flat Status Notification — 1px rule, zero shadow */}
      {toast && (
        <div className="no-print fixed right-6 bottom-6 z-50 flex items-center gap-2 border border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 font-mono text-xs text-[var(--bg)]">
          <Check className="h-3.5 w-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {showNewModal && (
        <NewAuditModal
          open
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
      <AboutModal
        open={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </>
  );
}
