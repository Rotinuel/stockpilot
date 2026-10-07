import { Schema, baseOptions, defineModel } from "./_helpers.js";

const SubscriptionPlanSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 }, // major units (e.g. Naira)
    currency: { type: String, default: "NGN" },
    interval: { type: String, enum: ["monthly", "quarterly", "biannually", "annually"], default: "monthly" },
    isTrial: { type: Boolean, default: false },
    durationDays: { type: Number, default: 30 },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    highlight: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    paystackPlanCode: { type: String, default: "" }, // NGN monthly (legacy field)
    // Optional prices (0 = automatic / not sold). `price` is the NGN monthly price.
    yearlyPrice: { type: Number, default: 0, min: 0 }, // NGN per year (0 → 10 × monthly)
    usdPrice: { type: Number, default: 0, min: 0 }, // USD per month (0 → not sold in USD)
    usdYearlyPrice: { type: Number, default: 0, min: 0 }, // USD per year (0 → 10 × monthly)
    // Paystack plan codes per currency/cycle, e.g. { NGN_annually: "PLN_…", USD_monthly: "PLN_…" }
    paystackPlanCodes: { type: Schema.Types.Mixed, default: {} },
    featureList: { type: [String], default: [] },
    // -1 means unlimited
    limits: {
      products: { type: Number, default: -1 },
      staffUsers: { type: Number, default: -1 },
      locations: { type: Number, default: 1 },
      monthlyTransactions: { type: Number, default: -1 },
    },
    features: {
      expenses: { type: Boolean, default: false },
      advancedReports: { type: Boolean, default: false },
      profitAnalysis: { type: Boolean, default: false },
      lowStockAlerts: { type: Boolean, default: false },
      customerBalances: { type: Boolean, default: false },
      supplierBalances: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      multiLocation: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
  },
  baseOptions,
);

SubscriptionPlanSchema.index({ code: 1 }, { unique: true });
SubscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export default defineModel("SubscriptionPlan", SubscriptionPlanSchema);
