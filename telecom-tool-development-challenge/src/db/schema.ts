import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export type ServiceType = "mobile" | "broadband" | "bundle";
export type DataSourceType = "simulated_sample" | "user_pasted" | "user_manual";
export type AuditStatus = "in_review" | "ready_for_support" | "resolved";

export type LineItemCategory =
  | "base_plan"
  | "usage_overage"
  | "add_on"
  | "equipment"
  | "carrier_surcharge"
  | "gov_tax"
  | "promo_credit"
  | "one_time_fee"
  | "other";

export type FlagLevel = "normal" | "info" | "review" | "high_attention";

export type ResolutionStatus =
  | "open"
  | "to_ask"
  | "credit_promised"
  | "explained"
  | "cancelled";

export interface CustomQuestion {
  id: string;
  text: string;
  intent: "clarify" | "credit" | "cancel";
}

export const billAudits = pgTable("bill_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  providerLabel: text("provider_label").notNull(),
  serviceType: text("service_type").$type<ServiceType>().notNull().default("mobile"),
  dataSource: text("data_source")
    .$type<DataSourceType>()
    .notNull()
    .default("user_manual"),
  sampleSlug: text("sample_slug"),
  billingPeriodStart: text("billing_period_start").notNull(),
  billingPeriodEnd: text("billing_period_end").notNull(),
  previousTotalCents: integer("previous_total_cents").notNull().default(0),
  currentTotalCents: integer("current_total_cents").notNull().default(0),
  // The tool works in Malaysian Ringgit only. Amounts are integer sen and are
  // never converted between currencies.
  currency: text("currency").notNull().default("MYR"),
  customerContext: text("customer_context").notNull().default(""),
  rawBillText: text("raw_bill_text").notNull().default(""),
  supportRefNumber: text("support_ref_number").notNull().default(""),
  supportNotes: text("support_notes").notNull().default(""),
  promisedCreditCents: integer("promised_credit_cents").notNull().default(0),
  checklistState: jsonb("checklist_state")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  customQuestions: jsonb("custom_questions")
    .$type<CustomQuestion[]>()
    .notNull()
    .default([]),
  status: text("status").$type<AuditStatus>().notNull().default("in_review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billLineItems = pgTable("bill_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditId: uuid("audit_id")
    .notNull()
    .references(() => billAudits.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  rawLabel: text("raw_label").notNull(),
  sectionName: text("section_name").notNull().default("General Charges"),
  amountCents: integer("amount_cents").notNull().default(0),
  priorAmountCents: integer("prior_amount_cents"),
  category: text("category")
    .$type<LineItemCategory>()
    .notNull()
    .default("other"),
  plainTitle: text("plain_title").notNull(),
  plainExplanation: text("plain_explanation").notNull(),
  flagLevel: text("flag_level").$type<FlagLevel>().notNull().default("normal"),
  flagReason: text("flag_reason").notNull().default(""),
  // Empty = use the suggested wording, generated on the fly for the active
  // language and the line's current figures. Only text the user wrote
  // themselves is stored here.
  suggestedQuestion: text("suggested_question").notNull().default(""),
  includeInBrief: boolean("include_in_brief").notNull().default(false),
  userNote: text("user_note").notNull().default(""),
  resolutionStatus: text("resolution_status")
    .$type<ResolutionStatus>()
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BillAuditRow = typeof billAudits.$inferSelect;
export type NewBillAuditRow = typeof billAudits.$inferInsert;
export type BillLineItemRow = typeof billLineItems.$inferSelect;
export type NewBillLineItemRow = typeof billLineItems.$inferInsert;
