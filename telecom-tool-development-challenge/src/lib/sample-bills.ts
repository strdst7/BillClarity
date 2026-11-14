import type { ServiceType } from "@/db/schema";
import type { Language } from "./i18n";

/*
 * Synthetic sample bills in Malaysian Ringgit.
 *
 * Every provider here is fictional and every figure is made up for
 * demonstration: plan prices and fees are illustrative, NOT real tariffs.
 * Amounts are integer sen. Each "Service Tax (SST) 6%" line is worked out as
 * 6% of that bill's service charges so the samples add up; device instalments
 * and stamp duty are left out of the taxable amount.
 *
 * Changing a slug retires the old version of that sample: on the next server
 * start, stored samples whose slug is no longer listed here are replaced.
 */

export interface SampleBillLineSeed {
  rawLabel: string;
  sectionName: string;
  amountCents: number;
  /** Same line on the previous bill; null when there is no previous bill. */
  priorAmountCents: number | null;
}

export interface SampleBillText {
  title: string;
  providerLabel: string;
  customerContext: string;
}

export interface SampleBillSeed {
  slug: string;
  serviceType: ServiceType;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  /** Total of the previous bill; 0 when there is none to compare with. */
  previousTotalCents: number;
  text: Record<Language, SampleBillText>;
  lines: SampleBillLineSeed[];
}

export const SAMPLE_BILL_SEEDS: SampleBillSeed[] = [
  {
    // RM288.98 this cycle vs RM210.54 before (+RM78.44).
    // 30-day cycle; line 2 moved from an RM68 to an RM98 plan on 1 Mar, so the
    // upgrade is (98 - 68) / 30 x 14 days = RM14.00.
    // SST: 6% x (136 - 10 + 14 + 38 + 5 = 183) = RM10.98;
    // before: 6% x (136 - 10 - 20 + 3 = 109) = RM6.54.
    slug: "myr-rebate-ended-roaming",
    serviceType: "mobile",
    billingPeriodStart: "2026-02-13",
    billingPeriodEnd: "2026-03-14",
    previousTotalCents: 21054,
    text: {
      en: {
        title: "March Family Mobile Bill (Rebate Ended + Roaming)",
        providerLabel: "Northwind Mobile (Fictional)",
        customerContext:
          "My bill is usually about RM210 a month. I upgraded one line mid-cycle and spent a weekend across the border, and now it is almost RM290.",
      },
      ms: {
        title: "Bil Mudah Alih Keluarga Mac (Rebat Tamat + Perayauan)",
        providerLabel: "Northwind Mobile (Rekaan)",
        customerContext:
          "Bil saya biasanya kira-kira RM210 sebulan. Saya menaik taraf satu talian pada pertengahan kitaran dan menghabiskan hujung minggu di seberang sempadan, dan kini bil saya hampir RM290.",
      },
    },
    lines: [
      {
        rawLabel: "Northwind Postpaid 68 — 2 Lines (Monthly Fee)",
        sectionName: "Monthly Charges",
        amountCents: 13600,
        priorAmountCents: 13600,
      },
      {
        rawLabel: "Auto-Debit & e-Bill Rebate (2 Lines)",
        sectionName: "Rebates & Credits",
        amountCents: -1000,
        priorAmountCents: -1000,
      },
      {
        rawLabel: "12-Month Loyalty Rebate (Expired)",
        sectionName: "Rebates & Credits",
        amountCents: 0,
        priorAmountCents: -2000,
      },
      {
        rawLabel: "Pro-Rated Plan Upgrade — Line 2 (1–14 Mar)",
        sectionName: "Plan Changes",
        amountCents: 1400,
        priorAmountCents: 0,
      },
      {
        rawLabel: "Roaming Day Pass — Line 2 (2 Days)",
        sectionName: "Usage & Roaming",
        amountCents: 3800,
        priorAmountCents: 0,
      },
      {
        rawLabel: "Smartphone Instalment 16 of 24",
        sectionName: "Device",
        amountCents: 9500,
        priorAmountCents: 9500,
      },
      {
        rawLabel: "Admin & Network Service Fee",
        sectionName: "Fees & Tax",
        amountCents: 500,
        priorAmountCents: 300,
      },
      {
        rawLabel: "Service Tax (SST) 6%",
        sectionName: "Fees & Tax",
        amountCents: 1098,
        priorAmountCents: 654,
      },
    ],
  },
  {
    // A first bill: RM326.94, with no earlier bill to compare against.
    // Service started 13 Feb, 7 days before the first 28-day cycle, so the
    // part-month charge is (129 + 59) / 28 x 7 days = RM47.00.
    // SST: 6% x (129 + 59 + 30 + 47 + 15 + 15 + 4) = RM17.94 (stamp duty is not taxed).
    slug: "myr-first-bill-fibre-bundle",
    serviceType: "bundle",
    billingPeriodStart: "2026-02-20",
    billingPeriodEnd: "2026-03-19",
    previousTotalCents: 0,
    text: {
      en: {
        title: "First Bill — Home Fibre + Mobile Bundle",
        providerLabel: "Harborline Fibre & Mobile (Fictional)",
        customerContext:
          "The sales agent quoted about RM178 a month (before SST) with auto-debit for Home Fibre 300 Mbps plus one mobile line, but my very first bill came to RM326.94.",
      },
      ms: {
        title: "Bil Pertama — Pakej Fibre Rumah + Mudah Alih",
        providerLabel: "Harborline Fibre & Mobile (Rekaan)",
        customerContext:
          "Jurujual menyebut kira-kira RM178 sebulan (sebelum SST) dengan auto-debit untuk Fibre Rumah 300 Mbps dan satu talian mudah alih, tetapi bil pertama saya berjumlah RM326.94.",
      },
    },
    lines: [
      {
        rawLabel: "Harborline Home Fibre 300 Mbps (Monthly Fee)",
        sectionName: "Monthly Charges",
        amountCents: 12900,
        priorAmountCents: null,
      },
      {
        rawLabel: "Harborline Postpaid 59 Mobile Plan (Monthly Fee)",
        sectionName: "Monthly Charges",
        amountCents: 5900,
        priorAmountCents: null,
      },
      {
        rawLabel: "Auto-Debit Rebate (Missing — Pending Enrolment)",
        sectionName: "Rebates & Credits",
        amountCents: 0,
        priorAmountCents: null,
      },
      {
        rawLabel: "One-Time Activation Fee (New Mobile Line)",
        sectionName: "One-Time Charges",
        amountCents: 3000,
        priorAmountCents: null,
      },
      {
        rawLabel: "Pro-Rated Charges (13–19 Feb)",
        sectionName: "One-Time Charges",
        amountCents: 4700,
        priorAmountCents: null,
      },
      {
        rawLabel: "Stamp Duty (Service Agreement)",
        sectionName: "One-Time Charges",
        amountCents: 1000,
        priorAmountCents: null,
      },
      {
        rawLabel: "Device Shield Plus (Auto-Enrolled)",
        sectionName: "Add-Ons & Equipment",
        amountCents: 1500,
        priorAmountCents: null,
      },
      {
        rawLabel: "Mesh Wi-Fi Router Rental",
        sectionName: "Add-Ons & Equipment",
        amountCents: 1500,
        priorAmountCents: null,
      },
      {
        rawLabel: "Processing & Admin Fee",
        sectionName: "Fees & Tax",
        amountCents: 400,
        priorAmountCents: null,
      },
      {
        rawLabel: "Service Tax (SST) 6%",
        sectionName: "Fees & Tax",
        amountCents: 1794,
        priorAmountCents: null,
      },
    ],
  },
  {
    // RM149.04 this cycle vs RM111.30 before (+RM37.74).
    // IDD: 14 min x RM0.90 = RM12.60.
    // SST: 6% x (109 + 12.60 + 8 + 5 + 6) = RM8.44; before: 6% x (99 + 3 + 3) = RM6.30.
    slug: "myr-quiet-fee-creep",
    serviceType: "broadband",
    billingPeriodStart: "2026-03-01",
    billingPeriodEnd: "2026-03-31",
    previousTotalCents: 11130,
    text: {
      en: {
        title: "Home Fibre & Voice — Quiet Fee Creep",
        providerLabel: "Meadowbrook Telecom (Fictional)",
        customerContext:
          "My home fibre and phone bill was about RM111 last month and is almost RM150 now, even though I never changed my plan.",
      },
      ms: {
        title: "Fibre Rumah & Suara — Kenaikan Caj Secara Senyap",
        providerLabel: "Meadowbrook Telecom (Rekaan)",
        customerContext:
          "Bil fibre dan telefon rumah saya kira-kira RM111 bulan lepas dan kini hampir RM150, walaupun saya tidak pernah menukar pelan.",
      },
    },
    lines: [
      {
        rawLabel: "Meadowbrook Fibre 100 Mbps + Home Voice (Monthly Fee)",
        sectionName: "Monthly Charges",
        amountCents: 10900,
        priorAmountCents: 9900,
      },
      {
        rawLabel: "IDD Calls — Out of Bundle (14 min)",
        sectionName: "Usage",
        amountCents: 1260,
        priorAmountCents: 0,
      },
      {
        rawLabel: "MeadowCloud Backup 100GB Add-On",
        sectionName: "Add-Ons",
        amountCents: 800,
        priorAmountCents: 0,
      },
      {
        rawLabel: "Paper Bill Fee",
        sectionName: "Add-Ons",
        amountCents: 500,
        priorAmountCents: 300,
      },
      {
        rawLabel: "Network Maintenance & Admin Fee",
        sectionName: "Fees & Tax",
        amountCents: 600,
        priorAmountCents: 300,
      },
      {
        rawLabel: "Service Tax (SST) 6%",
        sectionName: "Fees & Tax",
        amountCents: 844,
        priorAmountCents: 630,
      },
    ],
  },
];

/** Display order of the samples in the sidebar. */
export const SAMPLE_SLUG_ORDER: string[] = SAMPLE_BILL_SEEDS.map(
  (seed) => seed.slug
);

/** Title, provider and context of each sample in both languages, by slug. */
export const SAMPLE_TEXT_BY_SLUG: Record<
  string,
  Record<Language, SampleBillText>
> = Object.fromEntries(SAMPLE_BILL_SEEDS.map((seed) => [seed.slug, seed.text]));

/*
 * Synthetic example for the "paste bill text" box.
 * Upgrade from an RM68 to an RM98 plan on 16 Mar of a 31-day cycle:
 * (98 - 68) / 31 x 16 days = RM15.48.
 * SST: 6% x (98 - 10 + 15.48 + 15 + 15 + 10 + 5) = RM8.91; total RM157.39.
 * Previous bill: (68 - 10 + 10 + 5) x 1.06 = RM77.38.
 */
export const SAMPLE_RAW_PASTE_TEXT = `Previous Bill Amount: RM77.38

Monthly Charges
Postpaid 98 Plan (Monthly Fee)            RM98.00
Auto-Debit & e-Bill Rebate               -RM10.00

Usage & One-Time Charges
Pro-Rated Plan Upgrade (16 - 31 Mar)      RM15.48
Data Top-Up 5GB                           RM15.00
Device Care+ Protection                   RM15.00
Mesh Wi-Fi Rental                         RM10.00

Fees & Tax
Admin & Processing Fee                     RM5.00
Service Tax (SST) 6%                       RM8.91
Total Amount Due                         RM157.39`;
