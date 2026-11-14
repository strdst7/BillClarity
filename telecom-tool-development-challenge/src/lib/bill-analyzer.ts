import type {
  BillAuditRow,
  BillLineItemRow,
  CustomQuestion,
  FlagLevel,
  LineItemCategory,
  ResolutionStatus,
} from "@/db/schema";
import type { Language } from "./i18n";

/* -------------------------------------------------------------------------- */
/* Currency                                                                   */
/*                                                                            */
/* The whole tool works in Malaysian Ringgit (MYR, written "RM"). Amounts are */
/* stored as integer sen and are never converted between currencies: what the */
/* user enters is what is shown.                                              */
/* -------------------------------------------------------------------------- */

export const CURRENCY_CODE = "MYR";
export const CURRENCY_SYMBOL = "RM";

const CURRENCY_PREFIX: Record<string, string> = {
  [CURRENCY_CODE]: CURRENCY_SYMBOL,
};

/**
 * Formats integer sen as ringgit, e.g. 123450 -> "RM1,234.50", -1000 -> "-RM10.00".
 * Built by hand instead of with Intl so the server and every browser produce
 * identical text (no hydration mismatches from differing locale data).
 */
export function formatMoney(
  cents: number,
  currency: string = CURRENCY_CODE
): string {
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sen = String(abs % 100).padStart(2, "0");
  return `${cents < 0 && abs !== 0 ? "-" : ""}${prefix}${whole}.${sen}`;
}

/** Formats a ringgit amount given as a decimal number, e.g. 14.5 -> "RM14.50". */
export function formatAmount(ringgit: number): string {
  return formatMoney(Math.round(ringgit * 100));
}

export function formatDelta(
  deltaCents: number,
  currency: string = CURRENCY_CODE
): string {
  if (deltaCents === 0) return formatMoney(0, currency);
  const sign = deltaCents > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(deltaCents), currency)}`;
}

/* -------------------------------------------------------------------------- */
/* Reading money that a person typed or pasted                                */
/* -------------------------------------------------------------------------- */

const CURRENCY_MARKERS = String.raw`RM|MYR|USD|SGD|US\$|S\$|\$|£|€`;
const MARKER_PREFIX_RE = new RegExp(`^(${CURRENCY_MARKERS})\\s*`, "i");
const NUMBER_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;

interface MoneyToken {
  cents: number;
  /** Currency marker written next to the figure (upper-cased), if any. */
  marker: string | null;
}

function parseMoneyToken(raw: string): MoneyToken | null {
  let text = raw.trim();
  if (!text) return null;
  let negative = false;

  // Accounting style: (RM10.00) and "RM10.00 CR" are both credits.
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  if (/CR$/i.test(text)) {
    negative = true;
    text = text.replace(/\s*CR$/i, "");
  }
  if (/^[-−]/.test(text)) {
    negative = true;
    text = text.slice(1).trim();
  } else if (text.startsWith("+")) {
    text = text.slice(1).trim();
  }

  let marker: string | null = null;
  const markerMatch = MARKER_PREFIX_RE.exec(text);
  if (markerMatch) {
    marker = markerMatch[1].toUpperCase();
    text = text.slice(markerMatch[0].length);
  }
  // "RM-10.00"
  if (/^[-−]/.test(text)) {
    negative = true;
    text = text.slice(1).trim();
  }

  if (!NUMBER_RE.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return { cents: negative && cents !== 0 ? -cents : cents, marker };
}

/**
 * Strictly reads a ringgit amount typed into a form field and returns integer
 * sen, or null when the text is not a clean amount. Accepts "65", "65.5",
 * "RM65.00", "1,234.50", "-10", "RM-10", "(10.00)" and "10.00 CR".
 * Works on the digits directly, so there is no floating-point rounding.
 */
export function parseMoneyInput(raw: string): number | null {
  return parseMoneyToken(raw)?.cents ?? null;
}

/* -------------------------------------------------------------------------- */
/* Dates — day first, as used in Malaysia, with fixed month names             */
/* -------------------------------------------------------------------------- */

const MONTHS: Record<Language, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ms: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"],
};

function formatIsoDate(iso: string, lang: Language): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso;
  return `${day} ${MONTHS[lang][month - 1]} ${match[1]}`;
}

export function formatDateRange(
  start: string,
  end: string,
  lang: Language = "en"
): string {
  if (!start || !end) {
    return lang === "ms"
      ? "Kitaran pengebilan tidak dinyatakan"
      : "Billing cycle not specified";
  }
  return `${formatIsoDate(start, lang)} – ${formatIsoDate(end, lang)}`;
}

/* -------------------------------------------------------------------------- */
/* Categories, flags and statuses                                             */
/* -------------------------------------------------------------------------- */

export interface CategoryMeta {
  key: LineItemCategory;
  label: string;
  shortLabel: string;
  labelMs: string;
  shortLabelMs: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
  descriptionMs: string;
}

const NEUTRAL_TAG_BG = "bg-[var(--bg-subtle)]";
const NEUTRAL_TAG_TEXT = "text-[var(--ink-soft)]";
const NEUTRAL_TAG_BORDER = "border-[var(--rule)]";

export const CATEGORY_META: Record<LineItemCategory, CategoryMeta> = {
  base_plan: {
    key: "base_plan",
    label: "Base Plan & Service",
    shortLabel: "Base Plan",
    labelMs: "Pelan Asas & Perkhidmatan",
    shortLabelMs: "Pelan Asas",
    color: "#222222",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description: "Core monthly charge for a mobile or home broadband plan.",
    descriptionMs:
      "Caj bulanan teras untuk pelan mudah alih atau jalur lebar rumah.",
  },
  usage_overage: {
    key: "usage_overage",
    label: "Usage, Roaming & Overages",
    shortLabel: "Usage / Roaming",
    labelMs: "Penggunaan, Perayauan & Lebihan",
    shortLabelMs: "Perayauan / Lebihan",
    color: "#c8280e",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Charges on top of your plan allowance (roaming, extra data, IDD calls).",
    descriptionMs:
      "Caj melebihi kuota pelan anda (perayauan, data tambahan, panggilan IDD).",
  },
  one_time_fee: {
    key: "one_time_fee",
    label: "One-Time & Pro-Rated Fees",
    shortLabel: "One-Time / Pro-Rated",
    labelMs: "Caj Sekali Sahaja & Prorata",
    shortLabelMs: "Sekali / Prorata",
    color: "#8f5200",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Part-month charges after a plan change, plus activation, installation or late fees.",
    descriptionMs:
      "Caj separa bulan selepas pertukaran pelan, serta fi pengaktifan, pemasangan atau lewat bayar.",
  },
  add_on: {
    key: "add_on",
    label: "Optional Add-Ons",
    shortLabel: "Add-Ons",
    labelMs: "Tambahan Pilihan (Add-On)",
    shortLabelMs: "Tambahan",
    color: "#555555",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Device protection, cloud storage, security, content subscriptions or a paper bill fee.",
    descriptionMs:
      "Perlindungan peranti, storan awan, keselamatan, langganan kandungan atau caj bil bercetak.",
  },
  equipment: {
    key: "equipment",
    label: "Equipment & Instalments",
    shortLabel: "Equipment",
    labelMs: "Peralatan & Ansuran Peranti",
    shortLabelMs: "Peralatan",
    color: "#767676",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description: "Phone instalments and rented routers, modems or mesh Wi-Fi.",
    descriptionMs:
      "Ansuran telefon serta sewaan penghala (router), modem atau mesh Wi-Fi.",
  },
  carrier_surcharge: {
    key: "carrier_surcharge",
    label: "Carrier Surcharges",
    shortLabel: "Carrier Fees",
    labelMs: "Surcaj Syarikat Telekom",
    shortLabelMs: "Caj Syarikat",
    color: "#b06a00",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Admin, processing or recovery fees set by the provider — not a government tax.",
    descriptionMs:
      "Fi pentadbiran, pemprosesan atau pemulihan kos yang ditetapkan oleh syarikat telekom — bukan cukai kerajaan.",
  },
  gov_tax: {
    key: "gov_tax",
    label: "Government Tax (SST)",
    shortLabel: "Gov. Tax (SST)",
    labelMs: "Cukai Kerajaan (SST)",
    shortLabelMs: "Cukai (SST)",
    color: "#9a9a9a",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Service Tax (SST) and other government charges such as stamp duty.",
    descriptionMs:
      "Cukai Perkhidmatan (SST) dan caj kerajaan lain seperti duti setem.",
  },
  promo_credit: {
    key: "promo_credit",
    label: "Promos & Credits",
    shortLabel: "Credits",
    labelMs: "Promosi & Rebat Kredit",
    shortLabelMs: "Kredit / Rebat",
    color: "#186332",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description:
      "Auto-debit, e-bill, bundle, trade-in or loyalty rebates applied to your bill.",
    descriptionMs:
      "Rebat auto-debit, e-bil, pakej gabungan, tukar beli atau kesetiaan pada bil anda.",
  },
  other: {
    key: "other",
    label: "Unclassified Charge",
    shortLabel: "Other",
    labelMs: "Caj Lain / Tidak Dikenal Pasti",
    shortLabelMs: "Lain-lain",
    color: "#b8b8b8",
    bgClass: NEUTRAL_TAG_BG,
    textClass: NEUTRAL_TAG_TEXT,
    borderClass: NEUTRAL_TAG_BORDER,
    description: "A line that did not match a common telecom charge.",
    descriptionMs: "Baris yang tidak sepadan dengan caj telekom yang biasa.",
  },
};

export function getCategoryLabel(cat: LineItemCategory, lang: Language) {
  const m = CATEGORY_META[cat] ?? CATEGORY_META.other;
  return {
    ...m,
    displayLabel: lang === "ms" ? m.labelMs : m.label,
    displayShortLabel: lang === "ms" ? m.shortLabelMs : m.shortLabel,
    displayDescription: lang === "ms" ? m.descriptionMs : m.description,
  };
}

export const FLAG_META: Record<
  FlagLevel,
  {
    label: string;
    labelMs: string;
    badgeClass: string;
    dotClass: string;
    priority: number;
  }
> = {
  high_attention: {
    label: "High Attention",
    labelMs: "Perhatian Tinggi",
    badgeClass: "rams-tag-alert",
    dotClass: "bg-[var(--signal-alert)]",
    priority: 3,
  },
  review: {
    label: "Worth Checking",
    labelMs: "Perlu Disemak",
    badgeClass: "rams-tag-warn",
    dotClass: "bg-[var(--signal-warn)]",
    priority: 2,
  },
  info: {
    label: "Good to Know",
    labelMs: "Makluman",
    badgeClass: "rams-tag",
    dotClass: "bg-[var(--ink-muted)]",
    priority: 1,
  },
  normal: {
    label: "Expected",
    labelMs: "Dijangka",
    badgeClass: "rams-tag",
    dotClass: "bg-[var(--rule)]",
    priority: 0,
  },
};

export const RESOLUTION_META: Record<
  ResolutionStatus,
  { label: string; labelMs: string; badgeClass: string }
> = {
  open: {
    label: "In Review",
    labelMs: "Dalam Semakan",
    badgeClass: "rams-tag",
  },
  to_ask: {
    label: "Queued for Support",
    labelMs: "Untuk Ditanya",
    badgeClass: "rams-tag-invert",
  },
  credit_promised: {
    label: "Credit Promised",
    labelMs: "Kredit Dijanjikan",
    badgeClass: "rams-tag-good",
  },
  explained: {
    label: "Explained / Kept",
    labelMs: "Dijelaskan / Kekal",
    badgeClass: "rams-tag",
  },
  cancelled: {
    label: "Cancelled / Removed",
    labelMs: "Dibatalkan / Dibuang",
    badgeClass: "rams-tag",
  },
};

/* -------------------------------------------------------------------------- */
/* Line-item classifier                                                       */
/* -------------------------------------------------------------------------- */

export interface AnalyzedLineInput {
  rawLabel: string;
  amountCents: number;
  priorAmountCents?: number | null;
  sectionName?: string;
}

export interface AnalyzedLineResult {
  category: LineItemCategory;
  plainTitle: string;
  plainExplanation: string;
  flagLevel: FlagLevel;
  flagReason: string;
  suggestedQuestion: string;
  includeInBrief: boolean;
}

/*
 * Keyword patterns, tested against the lower-cased bill wording. Stems that
 * take endings use \w* ("roam" -> roaming, "pro-rat" -> prorated / pro-rata)
 * because a bare \b after the stem would stop them matching at all.
 * English and Bahasa Melayu bill wording are both covered.
 */
const RX = {
  autoDebit:
    /\bauto[- ]?(?:pay|debit)\b|\bdebit terus\b|\bpaperless\b|\be-?bil{1,2}\b/,
  creditWord:
    /\b(?:credits?|discounts?|promo|promotion|promosi|rebates?|rebat|savings|waiver|loyalty|diskaun|kredit|kesetiaan)\b/,
  endedWord: /\b(?:expired?|missing|ended|lapsed|tamat|luput|tiada|hilang)\b/,
  reversal: /\b(?:reversal|reversed|ditarik balik)\b/,
  roaming:
    /\b(?:roam\w*|perayauan|travel pass|day pass|intl|international|antarabangsa|abroad|luar negara|global pass|long distance|idd)\b/,
  overage:
    /\b(?:overage|top[- ]?up|tambah nilai|data boost\w*|booster|extra data|additional data|data add-?on|data tambahan|kuota tambahan|lebihan|per gb|excess usage|usage charges?|pay[- ]?per[- ]?use)\b/,
  proration:
    /\b(?:pro-?rat\w*|partial|separa|mid[- ]?cycle|advance bill\w*|plan change|plan swap|plan upgrade|tukar pelan|naik taraf pelan|billing adj\w*|cycle adj\w*)\b/,
  oneTime:
    /\b(?:activation|pengaktifan|registration|pendaftaran|set-?up fee|upgrade fee|connection fee|installation|pemasangan|dispatch|truck roll|technician|juruteknik|late fee|late payment|lewat bayar|bayaran lewat|caj lewat|reconnect\w*|penyambungan semula|restocking|early termination|penamatan awal|etf)\b/,
  late: /\b(?:late fee|late payment|lewat bayar|bayaran lewat|caj lewat|reconnect\w*|penyambungan semula)\b/,
  carrierFee:
    /\b(?:admin\w*|pentadbiran|processing|pemprosesan|telco recovery|cost recovery|regulatory recovery|economic adjustment|network recovery|carrier recovery|network maintenance|carrier fee|billing fee|surcharge|surcaj)\b/,
  govTax: /\b(?:tax|cukai|sst|gst|vat|stamp duty|duti setem)\b/,
  addOn:
    /\b(?:protect\w*|perlindungan|shield|insurance|insurans|takaful|device care|warranty|waranti|paper bill|paper statement|printed bill|itemi[sz]ed bill|penyata kertas|bil kertas|bil bercetak|cloud|awan|backup|storage|storan|security|antivirus|spam|caller id|roadside|stream\w*|penstriman|music|muzik|vas|value[- ]added|premium sms|content charges?|caj kandungan|voicemail plus|visual voicemail|add-?ons?)\b/,
  paperBill:
    /\b(?:paper bill|paper statement|printed bill|itemi[sz]ed bill|penyata kertas|bil kertas|bil bercetak)\b/,
  equipment:
    /\b(?:router|penghala|modem|gateway|extender|mesh|set-?top|decoder|instal?lments?|ansuran|eip|device payment|phone payment|bayaran peranti|equipment|peralatan|hardware|perkakasan)\b/,
  instalment:
    /\b(?:instal?lments?|ansuran|eip|device payment|phone payment|bayaran peranti)\b/,
  basePlan:
    /\b(?:plan|pelan|postpaid|prepaid|pascabayar|prabayar|unlimited|tanpa had|fiber|fibre|broadband|jalur lebar|internet|gigabit|\d+\s?(?:mbps|gbps)|mbps|gbps|wireless|mobile|mudah alih|line access|line rental|monthly service|monthly fee|monthly commitment|commitment fee|yuran bulanan|yuran komitmen|mrc|voice & data|talk.*text|family share|starter|essentials|plus)\b/,
};

/**
 * Deterministic, rule-based classifier for one bill line. Explains the charge
 * in plain language (English or Bahasa Melayu), flags anything unusual and
 * drafts a question for support. All amounts in the text are in ringgit.
 */
export function analyzeLineItem(
  input: AnalyzedLineInput,
  lang: Language = "en"
): AnalyzedLineResult {
  const label = input.rawLabel.trim();
  const lower = label.toLowerCase();
  const amount = input.amountCents;
  const prior = input.priorAmountCents ?? null;
  const before = prior ?? 0;
  const change = prior !== null ? amount - prior : 0;
  const increased = prior !== null && change > 0;
  const pick = (en: string, ms: string) => (lang === "ms" ? ms : en);
  const money = (cents: number) => formatMoney(cents);

  const creditLike = RX.creditWord.test(lower) || RX.autoDebit.test(lower);

  // 1. A discount that has disappeared or expired
  if (
    (amount === 0 && prior !== null && prior < 0) ||
    (amount >= 0 &&
      creditLike &&
      (RX.endedWord.test(lower) || RX.reversal.test(lower)))
  ) {
    const lost =
      prior !== null && prior < 0 ? Math.abs(amount - prior) : Math.abs(amount);
    const auto = RX.autoDebit.test(lower);
    return {
      category: "promo_credit",
      plainTitle: auto
        ? pick(
            "Auto-Debit / e-Bill Discount Missing",
            "Diskaun Auto-Debit / e-Bil Tiada"
          )
        : pick(
            "Promotional or Loyalty Credit Ended",
            "Kredit Promosi atau Kesetiaan Telah Tamat"
          ),
      plainExplanation: auto
        ? pick(
            "Your recurring auto-debit or e-bill discount was not applied this cycle. This commonly happens when a card expires, the auto-debit arrangement lapses, or on the very first bill.",
            "Diskaun bulanan auto-debit atau e-bil anda tidak dimasukkan pada kitaran ini. Ini sering berlaku apabila kad tamat tempoh, arahan auto-debit terbatal, atau pada bil yang pertama."
          )
        : pick(
            "A recurring promotional or loyalty discount from your previous bill was not applied this cycle. An expired promotion is one of the most common reasons a telecom bill jumps without any change of plan.",
            "Diskaun promosi atau rebat kesetiaan daripada bil terdahulu tidak lagi dimasukkan pada kitaran ini. Promosi yang tamat tempoh ialah antara punca paling biasa bil meningkat tanpa sebarang pertukaran pelan."
          ),
      flagLevel: "high_attention",
      flagReason:
        lost > 0
          ? pick(
              `You lost a ${money(lost)} discount compared with your previous bill.`,
              `Anda kehilangan diskaun ${money(lost)} berbanding bil terdahulu.`
            )
          : pick(
              "An expected discount or promotional credit appears to be missing.",
              "Diskaun atau kredit promosi yang dijangka nampaknya tiada."
            ),
      suggestedQuestion: auto
        ? pick(
            `My auto-debit / e-bill discount ("${label}") was not applied on this bill. Can you confirm why it dropped off, check that my payment method is still eligible, and apply a courtesy credit for this cycle?`,
            `Diskaun auto-debit / e-bil saya ("${label}") tidak dimasukkan dalam bil ini. Boleh sahkan mengapa ia digugurkan, semak sama ada kaedah bayaran saya masih layak, dan berikan kredit ihsan untuk kitaran ini?`
          )
        : pick(
            `The credit "${label}" ended or did not appear on this bill. When was it scheduled to end, and am I eligible for a current loyalty or retention offer so my monthly amount stays closer to previous months?`,
            `Kredit "${label}" telah tamat atau tiada pada bil ini. Bilakah tarikh tamatnya, dan adakah saya layak mendapat tawaran kesetiaan semasa supaya bayaran bulanan saya kekal hampir dengan bulan-bulan sebelumnya?`
          ),
      includeInBrief: true,
    };
  }

  // 2. A credit or rebate that is being applied
  if (amount < 0 || (amount === 0 && creditLike)) {
    const reduced = prior !== null && prior < 0 && amount > prior;
    return {
      category: "promo_credit",
      plainTitle: RX.autoDebit.test(lower)
        ? pick("Auto-Debit & e-Bill Discount", "Diskaun Auto-Debit & e-Bil")
        : /\b(?:bundle|pakej)\b/.test(lower)
          ? pick("Multi-Service Bundle Credit", "Rebat Pakej Gabungan")
          : /\b(?:trade|tukar beli)\b/.test(lower)
            ? pick("Device Trade-In Bill Credit", "Kredit Tukar Beli Peranti")
            : pick("Promotional Discount / Credit", "Diskaun / Rebat Promosi"),
      plainExplanation: pick(
        "A monthly discount that reduces your total bill. Note when promotional credits are due to end so you are not surprised when they drop off.",
        "Potongan bulanan yang mengurangkan jumlah bil anda. Catat tarikh tamat kredit promosi supaya anda tidak terkejut apabila ia berakhir."
      ),
      flagLevel: reduced ? "review" : "normal",
      flagReason: reduced
        ? pick(
            `This credit shrank by ${money(amount - before)} compared with last month.`,
            `Kredit ini berkurang sebanyak ${money(amount - before)} berbanding bulan lepas.`
          )
        : "",
      suggestedQuestion: reduced
        ? pick(
            `My credit "${label}" went from ${money(before)} to ${money(amount)}. Could you explain why the discount changed?`,
            `Kredit saya "${label}" berubah daripada ${money(before)} kepada ${money(amount)}. Boleh jelaskan mengapa jumlah diskaun berubah?`
          )
        : pick(
            `Can you confirm when "${label}" is due to end, so I know when my monthly amount may change?`,
            `Boleh sahkan bila "${label}" akan tamat supaya saya tahu bila bayaran bulanan saya mungkin berubah?`
          ),
      includeInBrief: reduced,
    };
  }

  // 3. Roaming, IDD and other international usage
  if (RX.roaming.test(lower)) {
    return {
      category: "usage_overage",
      plainTitle: pick(
        "International Roaming or Calling Charge",
        "Caj Perayauan atau Panggilan Antarabangsa"
      ),
      plainExplanation: pick(
        "A usage charge triggered when a phone connects to a network abroad (even briefly near a border, or through background app activity) or when you call or text an overseas number outside your plan.",
        "Caj penggunaan yang dikenakan apabila telefon bersambung ke rangkaian luar negara (walaupun seketika berhampiran sempadan, atau melalui aktiviti aplikasi di latar belakang) atau apabila anda menelefon atau menghantar SMS ke nombor luar negara di luar pelan anda."
      ),
      flagLevel: "high_attention",
      flagReason: pick(
        "Roaming and international charges are often triggered by accident — background data or a tower just across the border. Providers sometimes agree to a one-time goodwill adjustment.",
        "Caj perayauan dan antarabangsa sering tercetus secara tidak sengaja — data latar belakang atau menara di seberang sempadan. Penyedia kadangkala bersetuju memberi pelarasan ihsan sekali sahaja."
      ),
      suggestedQuestion: pick(
        `I was charged ${money(amount)} for "${label}". Can you share the dates, times and type of usage (data, calls or SMS) behind this charge, and check whether a one-time goodwill waiver or a cheaper roaming pass can be applied instead?`,
        `Saya dicaj ${money(amount)} untuk "${label}". Boleh kongsikan tarikh, masa dan jenis penggunaan (data, panggilan atau SMS) bagi caj ini, serta semak sama ada pengecualian ihsan sekali sahaja atau pas perayauan yang lebih murah boleh digunakan?`
      ),
      includeInBrief: true,
    };
  }

  // 4. Extra data, top-ups and other usage beyond the plan
  if (RX.overage.test(lower)) {
    return {
      category: "usage_overage",
      plainTitle: pick(
        "Extra Data or Usage Top-Up Charge",
        "Caj Data Tambahan atau Lebihan Penggunaan"
      ),
      plainExplanation: pick(
        "A charge on top of your plan, applied after you used more than your monthly data or usage allowance — usually billed per GB or as an automatic top-up.",
        "Caj di luar pelan yang dikenakan selepas anda melebihi kuota data atau penggunaan bulanan — lazimnya dicaj mengikut GB atau sebagai tambah nilai automatik."
      ),
      flagLevel: "high_attention",
      flagReason: pick(
        "This can repeat next month unless you set a usage limit or alert, or move to a plan that fits your usage.",
        "Caj ini boleh berulang bulan depan melainkan anda menetapkan had atau amaran penggunaan, atau bertukar kepada pelan yang lebih sesuai."
      ),
      suggestedQuestion: pick(
        `Can you confirm which line and dates caused the ${money(amount)} "${label}" charge, whether a goodwill credit is possible, and how I can set a usage cap or alert so it does not happen again?`,
        `Boleh sahkan talian dan tarikh yang menyebabkan caj ${money(amount)} "${label}", sama ada kredit ihsan boleh diberikan, dan cara menetapkan had atau amaran penggunaan supaya ia tidak berulang?`
      ),
      includeInBrief: true,
    };
  }

  // 5. Pro-rated / part-month charges after a plan change
  if (RX.proration.test(lower)) {
    return {
      category: "one_time_fee",
      plainTitle: pick(
        "Pro-Rated (Part-Month) Charge",
        "Caj Prorata (Separa Bulan)"
      ),
      plainExplanation: pick(
        "When a plan starts, ends or changes part-way through a billing cycle, the provider charges by the day for that part of the cycle — and often bills the new plan a month in advance at the same time.",
        "Apabila pelan bermula, tamat atau ditukar di pertengahan kitaran bil, penyedia mengenakan caj mengikut hari bagi tempoh tersebut — dan sering mengebil pelan baharu sebulan lebih awal pada masa yang sama."
      ),
      flagLevel: "review",
      flagReason: pick(
        "Pro-rated amounts are a common source of confusion — use the Proration Check tab to test the daily maths, and confirm it will not repeat next month.",
        "Amaun prorata sering mengelirukan — gunakan tab Semakan Prorata untuk menguji kiraan harian, dan sahkan caj ini tidak berulang bulan depan."
      ),
      suggestedQuestion: pick(
        `Please walk me through the exact dates and daily rate used to work out "${label}" (${money(amount)}), and confirm what my regular monthly bill will be from the next cycle.`,
        `Sila terangkan tarikh tepat dan kadar harian yang digunakan untuk mengira "${label}" (${money(amount)}), dan sahkan jumlah bil bulanan tetap saya mulai kitaran seterusnya.`
      ),
      includeInBrief: true,
    };
  }

  // 6. One-time activation, installation and late-payment fees
  if (RX.oneTime.test(lower)) {
    const isLate = RX.late.test(lower);
    return {
      category: "one_time_fee",
      plainTitle: isLate
        ? pick(
            "Late Payment or Reconnection Charge",
            "Caj Bayaran Lewat atau Penyambungan Semula"
          )
        : pick(
            "One-Time Activation / Set-Up Fee",
            "Fi Pengaktifan / Pemasangan Sekali Sahaja"
          ),
      plainExplanation: isLate
        ? pick(
            "A penalty charged when a payment arrives after the due date. Customers who normally pay on time can often ask for a one-time waiver.",
            "Penalti yang dikenakan apabila bayaran diterima selepas tarikh akhir. Pelanggan yang biasanya membayar tepat pada masanya sering boleh memohon pengecualian sekali sahaja."
          )
        : pick(
            "A non-recurring fee for activating a line, installing a service, upgrading or sending a technician. It should appear once only, and is sometimes waived on request.",
            "Fi tidak berulang untuk mengaktifkan talian, memasang perkhidmatan, menaik taraf atau menghantar juruteknik. Ia sepatutnya dikenakan sekali sahaja, dan kadangkala boleh dikecualikan atas permintaan."
          ),
      flagLevel: "high_attention",
      flagReason: pick(
        "A one-time fee is pushing this bill up — worth asking politely for a waiver and checking it was disclosed when you signed up.",
        "Fi sekali sahaja ini menaikkan bil anda — wajar memohon pengecualian dengan sopan dan menyemak sama ada ia dimaklumkan semasa pendaftaran."
      ),
      suggestedQuestion: isLate
        ? pick(
            `I see a ${money(amount)} "${label}" charge. Given my payment history, could you waive it as a one-time goodwill gesture?`,
            `Saya mendapati caj ${money(amount)} "${label}". Berdasarkan rekod bayaran saya, bolehkah ia dikecualikan sekali sahaja sebagai ihsan?`
          )
        : pick(
            `Was the ${money(amount)} "${label}" fee disclosed when I signed up or placed my order? Can it be waived or credited back?`,
            `Adakah fi ${money(amount)} "${label}" dimaklumkan semasa saya mendaftar atau membuat pesanan? Bolehkah ia dikecualikan atau dikreditkan semula?`
          ),
      includeInBrief: true,
    };
  }

  // 7. Fees set by the provider (NOT a government tax)
  if (RX.carrierFee.test(lower)) {
    return {
      category: "carrier_surcharge",
      plainTitle: pick(
        "Carrier-Set Admin / Service Fee",
        "Fi Pentadbiran / Perkhidmatan Syarikat Telekom"
      ),
      plainExplanation: pick(
        "Although it often sits next to the tax lines, an administrative, processing or 'recovery' fee is set by the provider to cover its own costs — it is NOT a government tax such as SST.",
        "Walaupun sering diletakkan bersebelahan baris cukai, fi pentadbiran, pemprosesan atau 'pemulihan kos' ditetapkan oleh syarikat telekom sendiri untuk menampung kosnya — ia BUKAN cukai kerajaan seperti SST."
      ),
      flagLevel: increased ? "review" : "info",
      flagReason: increased
        ? pick(
            `This carrier-set fee went up by ${formatDelta(change)} since your last bill — providers sometimes raise these outside the advertised plan price.`,
            `Fi syarikat ini meningkat sebanyak ${formatDelta(change)} berbanding bil lepas — penyedia kadangkala menaikkannya di luar harga pelan yang diiklankan.`
          )
        : pick(
            "Set by the provider, not a government tax. Include it when comparing the true all-in cost of plans.",
            "Ditetapkan oleh syarikat telekom, bukan cukai kerajaan. Ambil kira fi ini semasa membandingkan kos sebenar pelan."
          ),
      suggestedQuestion: increased
        ? pick(
            `The fee "${label}" went from ${money(before)} to ${money(amount)}. When was I notified of this increase, and is there a plan without separate admin fees?`,
            `Fi "${label}" meningkat daripada ${money(before)} kepada ${money(amount)}. Bilakah saya dimaklumkan tentang kenaikan ini, dan adakah terdapat pelan tanpa fi pentadbiran berasingan?`
          )
        : pick(
            `Can you explain what "${label}" (${money(amount)}) covers, and whether any plan includes it in the advertised price?`,
            `Boleh jelaskan apa yang dirangkumi oleh "${label}" (${money(amount)}), dan sama ada terdapat pelan yang sudah merangkuminya dalam harga yang diiklankan?`
          ),
      includeInBrief: increased,
    };
  }

  // 8. Service Tax (SST) and other government charges
  if (RX.govTax.test(lower)) {
    const jumped = prior !== null && change > 300;
    return {
      category: "gov_tax",
      plainTitle: pick(
        "Service Tax (SST) or Government Duty",
        "Cukai Perkhidmatan (SST) atau Duti Kerajaan"
      ),
      plainExplanation: pick(
        "A charge the provider collects on behalf of the government — on Malaysian telecom bills this is normally Service Tax (SST, 6% on telecommunication services when this tool was last updated) and sometimes stamp duty on a new contract. Because SST is a percentage of your taxable charges, it rises and falls with the rest of the bill.",
        "Caj yang dikutip oleh syarikat telekom bagi pihak kerajaan — pada bil telekom di Malaysia, lazimnya Cukai Perkhidmatan (SST, 6% bagi perkhidmatan telekomunikasi semasa alat ini dikemas kini) dan kadangkala duti setem bagi kontrak baharu. Oleh sebab SST dikira sebagai peratusan daripada caj bercukai, jumlahnya naik dan turun mengikut caj lain dalam bil."
      ),
      flagLevel: jumped ? "info" : "normal",
      flagReason: jumped
        ? pick(
            `Tax rose by ${formatDelta(change)} — usually because other taxable charges or one-time fees went up this month.`,
            `Cukai meningkat sebanyak ${formatDelta(change)} — biasanya kerana caj bercukai lain atau fi sekali sahaja meningkat pada bulan ini.`
          )
        : "",
      suggestedQuestion: jumped
        ? pick(
            `My tax line ("${label}") rose by ${formatDelta(change)}. Will it drop back automatically if the charges I am querying are credited?`,
            `Baris cukai saya ("${label}") meningkat sebanyak ${formatDelta(change)}. Adakah ia akan turun semula secara automatik jika caj yang saya pertikaikan dikreditkan?`
          )
        : pick(
            `Can you confirm which charges "${label}" (${money(amount)}) was calculated on?`,
            `Boleh sahkan caj yang manakah digunakan untuk mengira "${label}" (${money(amount)})?`
          ),
      includeInBrief: false,
    };
  }

  // 9. Optional add-ons (a "security deposit" is not an add-on)
  if (RX.addOn.test(lower) && !/\bdeposit\b/.test(lower)) {
    const isPaperBill = RX.paperBill.test(lower);
    return {
      category: "add_on",
      plainTitle: isPaperBill
        ? pick("Paper Bill Fee", "Caj Bil Bercetak")
        : pick(
            "Optional Add-On or Protection Plan",
            "Tambahan (Add-On) atau Pelan Perlindungan Pilihan"
          ),
      plainExplanation: isPaperBill
        ? pick(
            "A monthly fee for posting a printed bill. Switching to e-bill usually removes it straight away.",
            "Fi bulanan untuk menghantar bil bercetak melalui pos. Bertukar kepada e-bil biasanya menghapuskan caj ini serta-merta."
          )
        : pick(
            "An optional monthly extra such as device protection, cloud storage, security or content subscriptions. People are sometimes signed up at the counter, or a free trial quietly becomes a paid subscription.",
            "Tambahan bulanan pilihan seperti perlindungan peranti, storan awan, keselamatan atau langganan kandungan. Pelanggan kadangkala didaftarkan di kaunter, atau percubaan percuma bertukar menjadi langganan berbayar tanpa disedari."
          ),
      flagLevel: "review",
      flagReason: isPaperBill
        ? pick(
            "A recurring charge you can avoid by switching to e-bill.",
            "Caj berulang yang boleh dielakkan dengan bertukar kepada e-bil."
          )
        : pick(
            "Optional and recurring — check that you chose it and still use it.",
            "Pilihan dan berulang — pastikan anda memang memilihnya dan masih menggunakannya."
          ),
      suggestedQuestion: isPaperBill
        ? pick(
            `Please switch my account to e-bill so the ${money(amount)} "${label}" stops from the next bill, and check whether this month's fee can be credited.`,
            `Sila tukar akaun saya kepada e-bil supaya caj ${money(amount)} "${label}" dihentikan mulai bil seterusnya, dan semak sama ada caj bulan ini boleh dikreditkan.`
          )
        : pick(
            `I am being charged ${money(amount)} a month for "${label}". When and how was it added? If I did not ask for it or no longer need it, please remove it and tell me whether a refund or pro-rated credit applies.`,
            `Saya dicaj ${money(amount)} sebulan untuk "${label}". Bilakah dan bagaimanakah ia ditambah? Jika saya tidak memohonnya atau tidak lagi memerlukannya, sila batalkannya dan maklumkan sama ada bayaran balik atau kredit prorata boleh diberikan.`
          ),
      includeInBrief: true,
    };
  }

  // 10. Equipment rental and device instalments
  if (RX.equipment.test(lower)) {
    const isRental = !RX.instalment.test(lower);
    return {
      category: "equipment",
      plainTitle: isRental
        ? pick(
            "Monthly Equipment / Router Rental",
            "Sewaan Bulanan Peralatan / Penghala (Router)"
          )
        : pick("Device Instalment", "Ansuran Peranti"),
      plainExplanation: isRental
        ? pick(
            "A recurring fee for hardware supplied by the provider, such as a modem, router or mesh Wi-Fi unit. If your plan allows your own compatible equipment, buying it can work out cheaper over time.",
            "Fi berulang untuk perkakasan yang dibekalkan oleh penyedia, seperti modem, penghala (router) atau unit mesh Wi-Fi. Jika pelan anda membenarkan peralatan sendiri yang serasi, membelinya boleh menjimatkan kos dalam jangka panjang."
          )
        : pick(
            "A fixed monthly payment towards a phone or device, normally over 12 to 36 months. Once it is fully paid, this line should disappear from your bill.",
            "Bayaran bulanan tetap untuk telefon atau peranti, lazimnya selama 12 hingga 36 bulan. Selepas selesai dibayar, baris ini sepatutnya tidak lagi muncul dalam bil."
          ),
      flagLevel: isRental ? "review" : "normal",
      flagReason: isRental
        ? pick(
            "An ongoing rental — check whether you can use your own equipment or whether the fee should have been waived.",
            "Sewaan berterusan — semak sama ada anda boleh menggunakan peralatan sendiri atau sama ada fi ini sepatutnya dikecualikan."
          )
        : "",
      suggestedQuestion: isRental
        ? pick(
            `I am paying ${money(amount)} a month for "${label}". Can I return this equipment and use my own compatible device without changing my plan price?`,
            `Saya membayar ${money(amount)} sebulan untuk "${label}". Bolehkah saya memulangkan peralatan ini dan menggunakan peranti sendiri yang serasi tanpa mengubah harga pelan saya?`
          )
        : pick(
            `How many payments are left on "${label}" (${money(amount)} a month), and are any related device rebates still active?`,
            `Berapakah baki bayaran untuk "${label}" (${money(amount)} sebulan), dan adakah rebat peranti yang berkaitan masih aktif?`
          ),
      includeInBrief: isRental,
    };
  }

  // 11. The plan itself
  if (RX.basePlan.test(lower)) {
    return {
      category: "base_plan",
      plainTitle: pick("Monthly Plan Charge", "Caj Pelan Bulanan"),
      plainExplanation: pick(
        "Your core monthly subscription — the mobile line(s) or home internet package itself, before discounts, add-ons and tax.",
        "Langganan bulanan teras anda — talian mudah alih atau pakej internet rumah itu sendiri, sebelum diskaun, tambahan dan cukai."
      ),
      flagLevel: increased ? "high_attention" : "normal",
      flagReason: increased
        ? pick(
            `Your plan charge went up by ${formatDelta(change)} since last month.`,
            `Caj pelan anda meningkat sebanyak ${formatDelta(change)} berbanding bulan lepas.`
          )
        : "",
      suggestedQuestion: increased
        ? pick(
            `My plan charge "${label}" went from ${money(before)} to ${money(amount)} (${formatDelta(change)}). Was there a price increase or a plan change, and is there a better-value plan for my usage?`,
            `Caj pelan saya "${label}" meningkat daripada ${money(before)} kepada ${money(amount)} (${formatDelta(change)}). Adakah terdapat kenaikan harga atau pertukaran pelan, dan adakah terdapat pelan yang lebih berbaloi untuk penggunaan saya?`
          )
        : pick(
            `Can you confirm my regular charge for "${label}" stays at ${money(amount)} a month, with no price changes scheduled?`,
            `Boleh sahkan caj tetap saya untuk "${label}" kekal ${money(amount)} sebulan, tanpa perubahan harga yang dijadualkan?`
          ),
      includeInBrief: increased,
    };
  }

  // 12. Anything else
  const isNew = prior === 0 && amount > 0;
  const needsReview = isNew || increased || amount >= 1000;
  return {
    category: "other",
    plainTitle: pick("Unrecognised Bill Line", "Baris Bil Tidak Dikenal Pasti"),
    plainExplanation: pick(
      "This line uses wording that does not match a common telecom charge. Ask support to explain it in plain language.",
      "Baris ini menggunakan istilah yang tidak sepadan dengan caj telekom yang biasa. Minta khidmat pelanggan menerangkannya dalam bahasa mudah."
    ),
    flagLevel: needsReview ? "review" : "info",
    flagReason: isNew
      ? pick(
          `A new ${money(amount)} charge that was not on your previous bill.`,
          `Caj baharu ${money(amount)} yang tiada pada bil terdahulu.`
        )
      : increased
        ? pick(
            `Up by ${formatDelta(change)} since last month.`,
            `Meningkat sebanyak ${formatDelta(change)} berbanding bulan lepas.`
          )
        : pick(
            "Unclear wording — check what it covers and whether it repeats.",
            "Istilah kurang jelas — semak apa yang dirangkumi dan sama ada ia berulang."
          ),
    suggestedQuestion: pick(
      `Could you explain in plain terms what "${label}" (${money(amount)}) is for, whether it is one-time or monthly, and whether it is optional?`,
      `Boleh terangkan dalam bahasa mudah apakah caj "${label}" (${money(amount)}), sama ada ia sekali sahaja atau bulanan, dan sama ada ia pilihan?`
    ),
    includeInBrief: needsReview,
  };
}

/* -------------------------------------------------------------------------- */
/* Presenting a stored line                                                   */
/* -------------------------------------------------------------------------- */

export interface PresentedLineItem extends BillLineItemRow {
  /** True when the user wrote their own question for this line. */
  questionIsCustom: boolean;
}

/**
 * Turns a stored bill line into what the screens show. The category,
 * explanation, flag and suggested question are always worked out fresh from
 * the line's wording and figures, so they follow the active language, the
 * current rules and any edits to the amounts. Only a question the user wrote
 * themselves is taken from storage. Call this once per stored row.
 */
export function presentLineItem(
  item: BillLineItemRow,
  lang: Language
): PresentedLineItem {
  const analysis = analyzeLineItem(
    {
      rawLabel: item.rawLabel,
      amountCents: item.amountCents,
      priorAmountCents: item.priorAmountCents,
      sectionName: item.sectionName,
    },
    lang
  );
  const ownQuestion = item.suggestedQuestion.trim();
  return {
    ...item,
    category: analysis.category,
    plainTitle: analysis.plainTitle,
    plainExplanation: analysis.plainExplanation,
    flagLevel: analysis.flagLevel,
    flagReason: analysis.flagReason,
    suggestedQuestion: ownQuestion || analysis.suggestedQuestion,
    questionIsCustom: ownQuestion.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Pasted bill text parser                                                    */
/* -------------------------------------------------------------------------- */

export interface ParsedBillResult {
  items: Array<{
    rawLabel: string;
    sectionName: string;
    amountCents: number;
    priorAmountCents: number | null;
    analysis: AnalyzedLineResult;
  }>;
  detectedPreviousTotalCents: number | null;
  detectedCurrentTotalCents: number | null;
  skippedLines: number;
  /**
   * Currency markers other than RM / MYR found next to amounts (e.g. "$").
   * Those figures are still read, as ringgit, with no conversion — the UI
   * warns the user when this list is not empty.
   */
  foreignCurrencyMarkers: string[];
}

// An amount at the end of a free-text line: "RM65.00", "-RM10.00", "(RM10.00)", "14.99 CR"
const LINE_AMOUNT_RE = new RegExp(
  String.raw`(?:^|[\s,|:])(\(?[-−]?(?:(?:${CURRENCY_MARKERS})\s?)?[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?(?:\s?CR)?)\s*$`,
  "i"
);

const NON_SECTION_RE =
  /^(account|statement|page|thank you|due date|bill date|billing period|akaun|penyata|tarikh)/i;
const PREVIOUS_TOTAL_RE =
  /^(previous|prior|last\s+month'?s?|baki\s+(terdahulu|sebelum\w*|bulan\s+lepas)|bil\s+(terdahulu|sebelum\w*|bulan\s+lepas)|jumlah\s+bil\s+(terdahulu|lepas))\b/i;
const NOT_A_CHARGE_RE =
  /^(payments?\s+(received|made)|bayaran\s+(diterima|dibuat)|thank\s*you|terima\s+kasih|(outstanding|overdue|unpaid)\s+(balance|amount)|tunggakan|baki\s+tertunggak|sub\s*-?\s*total|jumlah\s+kecil)\b/i;
const TOTAL_RE =
  /^(grand\s+total|total|amount\s+due|amount\s+payable|balance\s+due|current\s+charges|new\s+charges|jumlah)\b/i;
const CSV_HEADER_CELL_RE =
  /^(amount|amaun|jumlah|total|this bill|bil ini|current|semasa|prior|previous|last bill|bil lepas|sebelum\w*|rm|myr)\b/i;

function splitColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((part) => part.trim());

  // A comma inside a money figure (RM1,234.50) is a thousands separator, not a
  // column break.
  const normalised = line.replace(
    /(^|[^\d.])(\d{1,3})((?:,\d{3})+)(?=\.\d{2}(?!\d))/g,
    (_match, lead: string, head: string, groups: string) =>
      lead + head + groups.replace(/,/g, "")
  );

  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < normalised.length; i++) {
    const ch = normalised[i];
    if (ch === '"') {
      if (inQuotes && normalised[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

/**
 * Parses pasted bill text (free text, CSV or tab-separated) into classified
 * line items. Previous-balance, payment and total lines are recognised and
 * left out so nothing is counted twice.
 */
export function parseRawBillText(rawText: string): ParsedBillResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedBillResult["items"] = [];
  const foreign = new Set<string>();
  let currentSection = "Bill Charges";
  let detectedPreviousTotalCents: number | null = null;
  let detectedCurrentTotalCents: number | null = null;
  let skippedLines = 0;

  const noteMarker = (token: MoneyToken) => {
    if (token.marker && token.marker !== "RM" && token.marker !== "MYR") {
      foreign.add(token.marker);
    }
  };

  for (const line of lines) {
    const cols = splitColumns(line);
    let label = "";
    let amount: MoneyToken | null = null;
    let prior: MoneyToken | null = null;

    // CSV / TSV: Label, Amount [, Prior amount]
    if (cols.length === 3) {
      const a = parseMoneyToken(cols[1]);
      const p = parseMoneyToken(cols[2]);
      if (a && p) {
        label = cols[0];
        amount = a;
        prior = p;
      }
    }
    if (!amount && cols.length === 2) {
      const a = parseMoneyToken(cols[1]);
      if (a && cols[0].length > 1) {
        label = cols[0];
        amount = a;
      }
    }

    // Free text: the amount is the last thing on the line
    if (!amount) {
      const match = LINE_AMOUNT_RE.exec(line);
      const token = match ? parseMoneyToken(match[1]) : null;
      if (match && token) {
        amount = token;
        label = line
          .slice(0, line.length - match[0].length)
          .replace(/[\s.:|\-–—]+$/, "")
          .trim();
      }
    }

    if (!amount) {
      const isCsvHeader =
        cols.length >= 2 &&
        cols.length <= 3 &&
        cols.slice(1).every((cell) => CSV_HEADER_CELL_RE.test(cell));
      if (
        !isCsvHeader &&
        line.length >= 3 &&
        line.length <= 55 &&
        !/\d{4,}/.test(line) &&
        !NON_SECTION_RE.test(line)
      ) {
        // A short line without an amount is treated as a section heading
        currentSection = line.replace(/[:\-=]+$/, "").trim();
      } else {
        skippedLines++;
      }
      continue;
    }

    label = label.replace(/^'(.*)'$/, "$1").trim();
    if (label.length < 2) {
      skippedLines++;
      continue;
    }

    noteMarker(amount);
    if (prior) noteMarker(prior);

    if (PREVIOUS_TOTAL_RE.test(label)) {
      detectedPreviousTotalCents = amount.cents;
      skippedLines++;
      continue;
    }
    if (NOT_A_CHARGE_RE.test(label)) {
      skippedLines++;
      continue;
    }
    if (TOTAL_RE.test(label)) {
      detectedCurrentTotalCents = amount.cents;
      skippedLines++;
      continue;
    }

    const priorAmountCents = prior ? prior.cents : null;
    items.push({
      rawLabel: label,
      sectionName: currentSection,
      amountCents: amount.cents,
      priorAmountCents,
      analysis: analyzeLineItem({
        rawLabel: label,
        amountCents: amount.cents,
        priorAmountCents,
        sectionName: currentSection,
      }),
    });
  }

  return {
    items,
    detectedPreviousTotalCents,
    detectedCurrentTotalCents,
    skippedLines,
    foreignCurrencyMarkers: [...foreign],
  };
}

/* -------------------------------------------------------------------------- */
/* Bill summary                                                               */
/* -------------------------------------------------------------------------- */

export interface CategorySummaryBucket {
  category: LineItemCategory;
  label: string;
  shortLabel: string;
  color: string;
  totalCents: number;
  count: number;
  sharePercent: number;
}

export interface KeyFinding {
  id: string;
  tone: "alert" | "warn" | "info" | "positive";
  headline: string;
  detail: string;
}

export interface AuditSummary {
  currentTotalCents: number;
  previousTotalCents: number;
  netDeltaCents: number;
  deltaPercent: number | null;
  grossPositiveCents: number;
  totalCreditsCents: number;
  carrierSurchargesCents: number;
  govTaxesCents: number;
  estimatedAdjustableCents: number;
  flaggedCount: number;
  briefItemCount: number;
  categoryBuckets: CategorySummaryBucket[];
  topDrivers: Array<{
    itemId: string;
    label: string;
    deltaCents: number;
    category: LineItemCategory;
  }>;
  findings: KeyFinding[];
}

/**
 * Summarises a bill. `items` must already be presented for `lang`
 * (see presentLineItem) so categories and titles match what is on screen.
 */
export function computeAuditSummary(
  audit: Pick<BillAuditRow, "previousTotalCents" | "currency">,
  items: BillLineItemRow[],
  lang: Language = "en"
): AuditSummary {
  const ms = lang === "ms";

  const currentTotalCents = items.reduce(
    (sum, item) => sum + item.amountCents,
    0
  );
  const previousTotalCents = audit.previousTotalCents;
  const netDeltaCents = currentTotalCents - previousTotalCents;
  const deltaPercent =
    previousTotalCents > 0
      ? Math.round((netDeltaCents / previousTotalCents) * 1000) / 10
      : null;

  let grossPositiveCents = 0;
  let totalCreditsCents = 0;
  let carrierSurchargesCents = 0;
  let govTaxesCents = 0;
  let estimatedAdjustableCents = 0;
  let flaggedCount = 0;
  let briefItemCount = 0;

  const bucketMap = new Map<
    LineItemCategory,
    { totalCents: number; count: number }
  >();

  const topDrivers: AuditSummary["topDrivers"] = [];

  for (const item of items) {
    if (item.amountCents >= 0) {
      grossPositiveCents += item.amountCents;
    } else {
      totalCreditsCents += item.amountCents;
    }

    if (item.category === "carrier_surcharge") {
      carrierSurchargesCents += item.amountCents;
    }
    if (item.category === "gov_tax") {
      govTaxesCents += item.amountCents;
    }

    if (item.flagLevel === "high_attention" || item.flagLevel === "review") {
      flaggedCount++;
      // A deliberately simple estimate of what is worth asking about
      if (item.amountCents > 0) {
        if (
          item.category === "usage_overage" ||
          item.category === "one_time_fee" ||
          item.category === "add_on"
        ) {
          estimatedAdjustableCents += item.amountCents;
        } else if (
          item.priorAmountCents !== null &&
          item.amountCents > item.priorAmountCents
        ) {
          estimatedAdjustableCents += item.amountCents - item.priorAmountCents;
        }
      } else if (
        item.amountCents === 0 &&
        item.priorAmountCents !== null &&
        item.priorAmountCents < 0
      ) {
        // A credit that disappeared
        estimatedAdjustableCents += Math.abs(item.priorAmountCents);
      }
    }

    if (item.includeInBrief) {
      briefItemCount++;
    }

    const existing = bucketMap.get(item.category) ?? {
      totalCents: 0,
      count: 0,
    };
    bucketMap.set(item.category, {
      totalCents: existing.totalCents + item.amountCents,
      count: existing.count + 1,
    });

    if (item.priorAmountCents !== null) {
      const itemDelta = item.amountCents - item.priorAmountCents;
      if (itemDelta > 0) {
        topDrivers.push({
          itemId: item.id,
          label: item.plainTitle,
          deltaCents: itemDelta,
          category: item.category,
        });
      }
    } else if (
      item.amountCents > 0 &&
      (item.flagLevel === "high_attention" ||
        item.category === "one_time_fee" ||
        item.category === "usage_overage")
    ) {
      topDrivers.push({
        itemId: item.id,
        label: item.plainTitle,
        deltaCents: item.amountCents,
        category: item.category,
      });
    }
  }

  topDrivers.sort((a, b) => b.deltaCents - a.deltaCents);

  const orderedCategories: LineItemCategory[] = [
    "base_plan",
    "usage_overage",
    "one_time_fee",
    "add_on",
    "equipment",
    "carrier_surcharge",
    "gov_tax",
    "other",
    "promo_credit",
  ];

  const positiveDenominator = Math.max(grossPositiveCents, 1);

  const categoryBuckets: CategorySummaryBucket[] = orderedCategories
    .map((cat) => {
      const data = bucketMap.get(cat);
      if (!data || (data.totalCents === 0 && data.count === 0)) return null;
      const meta = getCategoryLabel(cat, lang);
      return {
        category: cat,
        label: meta.displayLabel,
        shortLabel: meta.displayShortLabel,
        color: meta.color,
        totalCents: data.totalCents,
        count: data.count,
        sharePercent:
          data.totalCents > 0
            ? Math.round((data.totalCents / positiveDenominator) * 1000) / 10
            : 0,
      };
    })
    .filter((b): b is CategorySummaryBucket => b !== null);

  const findings: KeyFinding[] = [];
  const cur = audit.currency;

  if (netDeltaCents > 0 && previousTotalCents > 0) {
    const top3 = topDrivers.slice(0, 3);
    const explainedCents = top3.reduce((s, d) => s + d.deltaCents, 0);
    const pctExplained = Math.min(
      100,
      Math.round((explainedCents / Math.max(netDeltaCents, 1)) * 100)
    );
    const pctText = deltaPercent !== null ? ` (+${deltaPercent}%)` : "";
    if (top3.length > 0) {
      const names = top3.map((d) => d.label).join(", ");
      findings.push({
        id: "delta-drivers",
        tone: "alert",
        headline: ms
          ? `Bil anda meningkat sebanyak ${formatMoney(netDeltaCents, cur)}${pctText}`
          : `Your bill increased by ${formatMoney(netDeltaCents, cur)}${pctText}`,
        detail: ms
          ? `${top3.length} perubahan terbesar (${names}) menyumbang kira-kira ${pctExplained}% daripada kenaikan berbanding bil terdahulu sebanyak ${formatMoney(previousTotalCents, cur)}.`
          : `The ${top3.length === 1 ? "biggest change" : `${top3.length} biggest changes`} (${names}) ${top3.length === 1 ? "accounts" : "account"} for about ${pctExplained}% of the jump from your previous bill of ${formatMoney(previousTotalCents, cur)}.`,
      });
    } else {
      findings.push({
        id: "delta-general",
        tone: "warn",
        headline: ms
          ? `Bil ini ${formatMoney(netDeltaCents, cur)} lebih tinggi daripada kitaran lepas`
          : `This bill is ${formatMoney(netDeltaCents, cur)} higher than your previous cycle`,
        detail: ms
          ? "Masukkan amaun bulan lepas pada setiap baris untuk mengenal pasti caj yang meningkat."
          : "Add last month's amount to each line to pinpoint exactly which charges rose.",
      });
    }
  } else if (netDeltaCents < 0 && previousTotalCents > 0) {
    findings.push({
      id: "delta-down",
      tone: "positive",
      headline: ms
        ? `Bil anda ${formatMoney(Math.abs(netDeltaCents), cur)} lebih rendah daripada kitaran lepas`
        : `Your bill is ${formatMoney(Math.abs(netDeltaCents), cur)} lower than your previous cycle`,
      detail: ms
        ? "Semak tambahan berulang atau fi syarikat di bawah untuk melihat potensi penjimatan lanjut."
        : "Review the recurring add-ons and carrier fees below to see whether more can be saved.",
    });
  }

  if (carrierSurchargesCents > 0) {
    findings.push({
      id: "carrier-vs-tax",
      tone: "info",
      headline: ms
        ? `${formatMoney(carrierSurchargesCents, cur)} fi syarikat lwn. ${formatMoney(govTaxesCents, cur)} cukai kerajaan (SST)`
        : `${formatMoney(carrierSurchargesCents, cur)} in carrier-set fees vs. ${formatMoney(govTaxesCents, cur)} in government tax (SST)`,
      detail: ms
        ? "Fi pentadbiran dan pemulihan kos ditetapkan oleh syarikat telekom, bukan kerajaan. Mengasingkannya memudahkan perbandingan kos sebenar."
        : "Admin and recovery fees are set by the provider, not the government. Keeping them apart makes the true all-in cost easier to compare.",
    });
  }

  const optionalItems = items.filter(
    (i) =>
      i.category === "add_on" ||
      (i.category === "equipment" && i.flagLevel === "review")
  );
  if (optionalItems.length > 0) {
    const optionalMonthly = optionalItems.reduce(
      (s, i) => s + Math.max(0, i.amountCents),
      0
    );
    const names = optionalItems.map((i) => i.rawLabel).join(", ");
    findings.push({
      id: "optional-recurring",
      tone: "warn",
      headline: ms
        ? `${formatMoney(optionalMonthly, cur)} sebulan untuk tambahan pilihan atau perkakasan sewaan`
        : `${formatMoney(optionalMonthly, cur)} a month in optional add-ons or rented hardware`,
      detail: ms
        ? `Membuang tambahan yang tidak diperlukan (${names}) boleh menjimatkan kira-kira ${formatMoney(optionalMonthly * 12, cur)} setahun (anggaran).`
        : `Dropping any you do not need (${names}) could save roughly ${formatMoney(optionalMonthly * 12, cur)} a year (estimate).`,
    });
  }

  return {
    currentTotalCents,
    previousTotalCents,
    netDeltaCents,
    deltaPercent,
    grossPositiveCents,
    totalCreditsCents,
    carrierSurchargesCents,
    govTaxesCents,
    estimatedAdjustableCents,
    flaggedCount,
    briefItemCount,
    categoryBuckets,
    topDrivers,
    findings,
  };
}

/* -------------------------------------------------------------------------- */
/* Before-you-call checklist                                                  */
/* -------------------------------------------------------------------------- */

export interface ChecklistItemDef {
  id: string;
  label: string;
  hint: string;
}

export function getChecklistForAudit(
  items: BillLineItemRow[],
  lang: Language = "en"
): ChecklistItemDef[] {
  const ms = lang === "ms";
  const list: ChecklistItemDef[] = [
    {
      id: "account_pin",
      label: ms
        ? "Nombor akaun dan butiran pengenalan berdaftar (cth. MyKad / pasport) sedia"
        : "Account number and registered ID details (e.g. MyKad / passport) ready",
      hint: ms
        ? "Mempercepat pengesahan pada permulaan panggilan atau sembang. Jangan masukkan butiran ini ke dalam alat ini."
        : "Speeds up verification at the start of a call or chat. Keep these out of this tool.",
    },
    {
      id: "prior_statement",
      label: ms
        ? "Bil bulan lepas dibuka untuk perbandingan sebelah-menyebelah"
        : "Last month's bill open for a side-by-side comparison",
      hint: ms
        ? "Membantu merujuk perbezaan tepat setiap baris jika ditanya oleh ejen."
        : "Lets you quote exact line-by-line differences if the agent asks.",
    },
    {
      id: "capture_ref",
      label: ms
        ? "Minta nombor rujukan kes / tiket sebelum menamatkan perbualan"
        : "Ask for a case / ticket reference number before you finish",
      hint: ms
        ? "Rekodkannya dalam log hasil di bawah sekiranya kredit yang dijanjikan tidak muncul."
        : "Record it in the outcome log below in case a promised credit does not appear.",
    },
  ];

  const hasPromoIssue = items.some(
    (i) =>
      i.category === "promo_credit" &&
      (i.flagLevel === "high_attention" || i.flagLevel === "review")
  );
  if (hasPromoIssue) {
    list.push({
      id: "promo_confirmation",
      label: ms
        ? "Cari e-mel atau SMS pengesahan asal promosi / auto-debit"
        : "Find the original promotion / auto-debit confirmation email or SMS",
      hint: ms
        ? "Bukti berguna jika diskaun ditamatkan lebih awal atau tidak pernah dimasukkan."
        : "Useful proof if a discount ended early or was never applied.",
    });
  }

  const hasRoaming = items.some(
    (i) => i.category === "usage_overage" && RX.roaming.test(i.rawLabel.toLowerCase())
  );
  if (hasRoaming) {
    list.push({
      id: "roaming_settings",
      label: ms
        ? "Semak tetapan Perayauan Data telefon dan tarikh perjalanan anda"
        : "Check your phone's Data Roaming setting and your travel dates",
      hint: ms
        ? "Sahkan sama ada data latar belakang atau menara di sempadan mencetuskan caj tanpa sengaja."
        : "Confirm whether background data or a border tower triggered the charge by accident.",
    });
  }

  const hasProration = items.some(
    (i) => i.category === "one_time_fee" && RX.proration.test(i.rawLabel.toLowerCase())
  );
  if (hasProration) {
    list.push({
      id: "plan_change_date",
      label: ms
        ? "Catat tarikh tepat anda menukar atau mengaktifkan pelan"
        : "Note the exact date you changed or activated your plan",
      hint: ms
        ? "Diperlukan untuk menyemak bilangan hari dalam kiraan prorata."
        : "Needed to double-check the day count behind a pro-rated charge.",
    });
  }

  return list;
}

/* -------------------------------------------------------------------------- */
/* Support brief                                                              */
/* -------------------------------------------------------------------------- */

export interface SupportBriefOutput {
  openingScript: string;
  creditRequests: Array<{ item: BillLineItemRow; question: string }>;
  clarifications: Array<{ item: BillLineItemRow; question: string }>;
  cancelOrReview: Array<{ item: BillLineItemRow; question: string }>;
  customQuestions: CustomQuestion[];
  plainTextExport: string;
  markdownExport: string;
}

/**
 * Builds the support brief. `items` must already be presented for `lang`
 * (see presentLineItem).
 */
export function buildSupportBrief(
  audit: BillAuditRow,
  items: BillLineItemRow[],
  summary: AuditSummary,
  lang: Language = "en"
): SupportBriefOutput {
  const ms = lang === "ms";
  const cur = audit.currency;
  const selected = items.filter((i) => i.includeInBrief);

  const creditRequests: Array<{ item: BillLineItemRow; question: string }> = [];
  const clarifications: Array<{ item: BillLineItemRow; question: string }> = [];
  const cancelOrReview: Array<{ item: BillLineItemRow; question: string }> = [];

  for (const item of selected) {
    const notePrefix = ms ? "Nota" : "Note";
    const q = item.userNote.trim()
      ? `${item.suggestedQuestion} (${notePrefix}: ${item.userNote.trim()})`
      : item.suggestedQuestion;

    if (
      item.category === "add_on" ||
      (item.category === "equipment" && item.flagLevel === "review")
    ) {
      cancelOrReview.push({ item, question: q });
    } else if (
      item.category === "promo_credit" ||
      item.category === "usage_overage" ||
      (item.category === "one_time_fee" &&
        !RX.proration.test(item.rawLabel.toLowerCase()))
    ) {
      creditRequests.push({ item, question: q });
    } else {
      clarifications.push({ item, question: q });
    }
  }

  const cycle = formatDateRange(
    audit.billingPeriodStart,
    audit.billingPeriodEnd,
    lang
  );
  const totalQ = selected.length + audit.customQuestions.length;
  const hasIncrease =
    summary.previousTotalCents > 0 && summary.netDeltaCents > 0;

  const serviceNameMs =
    audit.serviceType === "mobile"
      ? "mudah alih"
      : audit.serviceType === "broadband"
        ? "jalur lebar"
        : "pakej gabungan";

  const openingScript = ms
    ? `Hai, saya menghubungi berkenaan bil ${serviceNameMs} saya bagi tempoh ${cycle}. Jumlah bil saya ${
        hasIncrease
          ? `ialah ${formatMoney(summary.currentTotalCents, cur)}, iaitu ${formatMoney(summary.netDeltaCents, cur)} lebih tinggi daripada bil terdahulu sebanyak ${formatMoney(summary.previousTotalCents, cur)}`
          : `ialah ${formatMoney(summary.currentTotalCents, cur)}`
      }. Saya telah menyemak setiap baris caj dan mempunyai ${totalQ} soalan khusus untuk mendapatkan penjelasan serta memastikan bil saya yang seterusnya tepat.`
    : `Hi, I'm contacting you about my ${audit.serviceType} bill for ${cycle}. My bill total ${
        hasIncrease
          ? `is ${formatMoney(summary.currentTotalCents, cur)}, which is ${formatMoney(summary.netDeltaCents, cur)} higher than my previous bill of ${formatMoney(summary.previousTotalCents, cur)}`
          : `came to ${formatMoney(summary.currentTotalCents, cur)}`
      }. I have gone through the line items and have ${totalQ} specific question${totalQ === 1 ? "" : "s"} so we can clear up these charges and make sure my next bill is accurate.`;

  const provenanceLine =
    audit.dataSource === "simulated_sample"
      ? ms
        ? "[SENARIO SAMPEL SIMULASI — UNTUK TUJUAN DEMONSTRASI SAHAJA · MI4, INC. | kdmirah lab]"
        : "[SIMULATED SAMPLE SCENARIO — FOR DEMONSTRATION ONLY · MI4, INC. | kdmirah lab]"
      : ms
        ? "[RINGKASAN BIL PENGGUNA — ANGGARAN PENDIDIKAN SAHAJA, BUKAN DATA RASMI SYARIKAT TELEKOM]"
        : "[USER-ENTERED BILL SUMMARY — ESTIMATES ONLY, NOT OFFICIAL CARRIER DATA]";

  const rule = "------------------------------------------------------------";

  const lines: string[] = [
    ms
      ? "MI4, INC. · kdmirah lab — RINGKASAN PERSEDIAAN SOKONGAN BILLCLARITY"
      : "MI4, INC. · kdmirah lab — BILLCLARITY CUSTOMER SUPPORT PREP BRIEF",
    provenanceLine,
    "============================================================",
    `${ms ? "Bil" : "Bill"}: ${audit.title}`,
    `${ms ? "Pembekal" : "Provider"}: ${audit.providerLabel} (${audit.serviceType.toUpperCase()})`,
    `${ms ? "Tempoh Pengebilan" : "Billing Period"}: ${cycle}`,
    `${ms ? "Jumlah Semasa" : "Current Total"}: ${formatMoney(summary.currentTotalCents, cur)}${
      summary.previousTotalCents > 0
        ? ` | ${ms ? "Bil Terdahulu" : "Previous Bill"}: ${formatMoney(summary.previousTotalCents, cur)} | ${ms ? "Perubahan" : "Change"}: ${formatDelta(summary.netDeltaCents, cur)}`
        : ""
    }`,
    `${ms ? "Amaun yang Wajar Ditanya (ANGGARAN)" : "Amount Worth Asking About (ESTIMATE)"}: ${formatMoney(summary.estimatedAdjustableCents, cur)}`,
    ms
      ? "Semua amaun dalam Ringgit Malaysia (RM)."
      : "All amounts are in Malaysian Ringgit (RM).",
    "",
    ms
      ? "1. SKRIP PEMBUKAAN (PANGGILAN TELEFON ATAU SEMBANG LANGSUNG)"
      : "1. OPENING STATEMENT (PHONE OR LIVE CHAT)",
    rule,
    openingScript,
    "",
  ];

  const appendGroup = (
    heading: string,
    group: Array<{ item: BillLineItemRow; question: string }>
  ) => {
    if (group.length === 0) return;
    lines.push(heading);
    lines.push(rule);
    group.forEach(({ item, question }, idx) => {
      const priorText =
        item.priorAmountCents !== null
          ? ` (${ms ? "Sebelum" : "Previous"}: ${formatMoney(item.priorAmountCents, cur)})`
          : "";
      lines.push(
        `${idx + 1}. ${item.rawLabel} — ${formatMoney(item.amountCents, cur)}${priorText}`
      );
      lines.push(`   ${ms ? "Tanya" : "Ask"}: ${question}`);
      lines.push("");
    });
  };

  appendGroup(
    ms
      ? "2. CAJ UNTUK DIPERSOALKAN ATAU MOHON KREDIT IHSAN"
      : "2. CHARGES TO QUESTION OR REQUEST A COURTESY CREDIT",
    creditRequests
  );
  appendGroup(
    ms
      ? "3. CAJ UNTUK PENJELASAN PENGIRAAN"
      : "3. CHARGES TO CLARIFY THE CALCULATION",
    clarifications
  );
  appendGroup(
    ms
      ? "4. TAMBAHAN PILIHAN ATAU PERKAKASAN UNTUK DISEMAK / DIBATALKAN"
      : "4. OPTIONAL ADD-ONS OR HARDWARE TO REVIEW / CANCEL",
    cancelOrReview
  );

  if (audit.customQuestions.length > 0) {
    lines.push(ms ? "5. SOALAN TAMBAHAN" : "5. ADDITIONAL QUESTIONS");
    lines.push(rule);
    audit.customQuestions.forEach((cq, idx) => {
      lines.push(`${idx + 1}. [${cq.intent.toUpperCase()}] ${cq.text}`);
    });
    lines.push("");
  }

  lines.push(ms ? "LOG PANGGILAN SOKONGAN" : "SUPPORT CALL LOG");
  lines.push(rule);
  lines.push(
    `${ms ? "No. Rujukan / Tiket" : "Reference / Ticket No."}: ${
      audit.supportRefNumber ||
      (ms ? "[Rekod semasa panggilan]" : "[Record during the call]")
    }`
  );
  lines.push(
    `${ms ? "Kredit Dijanjikan" : "Promised Credit"}: ${
      audit.promisedCreditCents > 0
        ? formatMoney(audit.promisedCreditCents, cur)
        : ms
          ? "[Belum direkodkan]"
          : "[None recorded yet]"
    }`
  );
  if (audit.supportNotes.trim()) {
    lines.push(`${ms ? "Nota" : "Notes"}: ${audit.supportNotes.trim()}`);
  }
  lines.push("");
  lines.push(
    ms
      ? "Penafian: Dijana oleh BillClarity (MI4, INC. · kdmirah lab) daripada data bil yang dimasukkan pengguna atau data simulasi. Klasifikasi dan anggaran ialah panduan pendidikan, bukan jaminan kredit daripada syarikat telekom."
      : "Disclaimer: Generated by BillClarity (MI4, INC. · kdmirah lab) from user-entered or simulated bill data. Classifications and estimates are educational guidance, not a guarantee of any credit from the provider."
  );

  const plainTextExport = lines.join("\n");

  const md: string[] = [
    ms
      ? "# BillClarity (MI4, INC. · kdmirah lab) — Ringkasan Persediaan Sokongan"
      : "# BillClarity (MI4, INC. · kdmirah lab) — Support Preparation Brief",
    `> **${ms ? "Notis Data" : "Data Notice"}:** ${provenanceLine}`,
    "",
    `- **${ms ? "Bil" : "Bill"}:** ${audit.title}`,
    `- **${ms ? "Pembekal" : "Provider"}:** ${audit.providerLabel} (${audit.serviceType})`,
    `- **${ms ? "Tempoh Pengebilan" : "Billing Period"}:** ${cycle}`,
    `- **${ms ? "Jumlah Semasa" : "Current Total"}:** ${formatMoney(summary.currentTotalCents, cur)}`,
  ];
  if (summary.previousTotalCents > 0) {
    md.push(
      `- **${ms ? "Bil Terdahulu" : "Previous Bill"}:** ${formatMoney(summary.previousTotalCents, cur)} (${formatDelta(summary.netDeltaCents, cur)})`
    );
  }
  md.push(
    `- **${ms ? "Amaun yang Wajar Ditanya (anggaran)" : "Amount Worth Asking About (estimate)"}:** ${formatMoney(summary.estimatedAdjustableCents, cur)}`,
    `- ${ms ? "Semua amaun dalam Ringgit Malaysia (RM)." : "All amounts are in Malaysian Ringgit (RM)."}`,
    "",
    `## ${ms ? "Skrip Pembukaan" : "Opening Script"}`,
    `> ${openingScript}`,
    ""
  );

  const appendMdGroup = (
    heading: string,
    group: Array<{ item: BillLineItemRow; question: string }>
  ) => {
    if (group.length === 0) return;
    md.push(`## ${heading}`);
    group.forEach(({ item, question }) => {
      md.push(
        `- **${item.rawLabel}** (${formatMoney(item.amountCents, cur)}): ${question}`
      );
    });
    md.push("");
  };

  appendMdGroup(
    ms ? "Persoalkan / Mohon Kredit Ihsan" : "Question / Request a Credit",
    creditRequests
  );
  appendMdGroup(
    ms ? "Penjelasan Pengiraan" : "Clarify the Calculation",
    clarifications
  );
  appendMdGroup(
    ms ? "Tambahan Pilihan & Perkakasan" : "Optional Add-Ons & Hardware",
    cancelOrReview
  );

  if (audit.customQuestions.length > 0) {
    md.push(`## ${ms ? "Soalan Tambahan" : "Additional Questions"}`);
    audit.customQuestions.forEach((cq) => {
      md.push(`- **[${cq.intent}]** ${cq.text}`);
    });
    md.push("");
  }

  return {
    openingScript,
    creditRequests,
    clarifications,
    cancelOrReview,
    customQuestions: audit.customQuestions,
    plainTextExport,
    markdownExport: md.join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/* Proration estimator                                                        */
/* -------------------------------------------------------------------------- */

export interface ProrationInput {
  /** Monthly price of the old plan, in ringgit (0 for a brand-new line). */
  oldMonthlyRate: number;
  /** Monthly price of the new plan, in ringgit. */
  newMonthlyRate: number;
  cycleDays: number;
  daysOnNewPlan: number;
  /** Pro-rated amount shown on the bill, in ringgit. */
  billedProration: number;
}

export interface ProrationResult {
  oldDailyRate: number;
  newDailyRate: number;
  expectedDifference: number;
  expectedPartialNewPlan: number;
  varianceFromDiff: number;
  varianceFromPartial: number;
  likelyMethod: "net_difference" | "partial_new_plan" | "mismatch";
  explanation: string;
}

/**
 * Sanity-check for a mid-cycle plan change. An ESTIMATE only: providers differ
 * on day counts, rounding and whether tax is included.
 */
export function calculateProrationEstimate(
  input: ProrationInput,
  lang: Language = "en"
): ProrationResult {
  const ms = lang === "ms";
  const safeDays = Math.max(1, Math.min(31, input.cycleDays));
  const clampedNewDays = Math.max(0, Math.min(safeDays, input.daysOnNewPlan));

  const oldDailyRate = input.oldMonthlyRate / safeDays;
  const newDailyRate = input.newMonthlyRate / safeDays;

  const expectedDifference =
    Math.round((newDailyRate - oldDailyRate) * clampedNewDays * 100) / 100;
  const expectedPartialNewPlan =
    Math.round(newDailyRate * clampedNewDays * 100) / 100;

  const varianceFromDiff =
    Math.round((input.billedProration - expectedDifference) * 100) / 100;
  const varianceFromPartial =
    Math.round((input.billedProration - expectedPartialNewPlan) * 100) / 100;

  let likelyMethod: ProrationResult["likelyMethod"];
  let explanation: string;

  if (Math.abs(varianceFromDiff) <= 1.25) {
    likelyMethod = "net_difference";
    explanation = ms
      ? `Sepadan dengan anggaran perbezaan bersih naik taraf (${clampedNewDays}/${safeDays} hari × perbezaan kadar harian). Ini biasanya pelarasan sekali sahaja yang tidak berulang pada kitaran seterusnya.`
      : `Matches an estimated net upgrade difference (${clampedNewDays}/${safeDays} days × the daily rate difference). This is normally a one-time adjustment that does not repeat next cycle.`;
  } else if (Math.abs(varianceFromPartial) <= 1.5) {
    likelyMethod = "partial_new_plan";
    explanation = ms
      ? `Sepadan dengan caj separa bulan berasingan untuk ${clampedNewDays} hari pada pelan baharu. Pastikan bil anda turut menunjukkan kredit prorata bagi hari yang tidak digunakan pada pelan lama.`
      : `Matches a stand-alone part-month charge for ${clampedNewDays} days on the new plan. Check that your bill also shows a pro-rated credit for the unused days on your old plan.`;
  } else {
    likelyMethod = "mismatch";
    explanation = ms
      ? `Amaun yang dicaj (${formatAmount(input.billedProration)}) berbeza daripada kedua-dua kaedah prorata yang biasa (${formatAmount(expectedDifference)} perbezaan bersih atau ${formatAmount(expectedPartialNewPlan)} separa pelan baharu). Minta khidmat pelanggan mengesahkan bilangan hari yang tepat dan sama ada pengebilan pendahuluan turut disertakan.`
      : `The amount charged (${formatAmount(input.billedProration)}) differs from both common proration methods (${formatAmount(expectedDifference)} net difference or ${formatAmount(expectedPartialNewPlan)} part-month on the new plan). Ask support for the exact day count and whether advance billing is included.`;
  }

  return {
    oldDailyRate,
    newDailyRate,
    expectedDifference,
    expectedPartialNewPlan,
    varianceFromDiff,
    varianceFromPartial,
    likelyMethod,
    explanation,
  };
}
