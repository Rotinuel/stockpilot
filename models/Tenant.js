import { SUBSCRIPTION_STATUSES, DEFAULT_CURRENCY } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel } from "./_helpers.js";

const TenantSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    ownerId: { type: ObjectId, ref: "User", index: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    // E.164 number that receives WhatsApp alerts (owner's number from registration).
    whatsappNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, maxlength: 300 },
    country: { type: String, default: "NG" },
    currency: { type: String, default: DEFAULT_CURRENCY },
    timezone: { type: String, default: "Africa/Lagos" },
    businessType: { type: String, trim: true },
    logo: { type: String, default: "" },

    // Platform status (super admin). Independent of the billing status.
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    suspendedReason: String,
    suspendedAt: Date,

    // Subscription (denormalised current state — source of truth is server-side only)
    subscriptionPlan: { type: ObjectId, ref: "SubscriptionPlan" },
    subscriptionPlanCode: { type: String, default: "trial" },
    subscriptionStatus: { type: String, enum: SUBSCRIPTION_STATUSES, default: "trialing", index: true },
    trialStartedAt: Date,
    trialEndsAt: { type: Date, index: true },
    paystackCustomerCode: String,
    paystackSubscriptionCode: { type: String, index: true, sparse: true },
    paystackEmailToken: { type: String, select: false },
    paystackAuthorizationCode: { type: String, select: false },
    cardLast4: String,
    cardBrand: String,
    subscriptionStartDate: Date,
    subscriptionEndDate: Date,
    nextBillingDate: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: Date,
    pastDueSince: Date,
    graceEndsAt: Date,
    pendingPlanChange: {
      planId: { type: ObjectId, ref: "SubscriptionPlan" },
      planCode: String,
      effectiveAt: Date,
      requestedAt: Date,
      scheduledOnPaystack: { type: Boolean, default: false },
    },

    settings: {
      taxRate: { type: Number, default: 0, min: 0, max: 100 },
      taxLabel: { type: String, default: "VAT" },
      invoicePrefix: { type: String, default: "INV" },
      purchasePrefix: { type: String, default: "PO" },
      receiptHeader: { type: String, default: "" },
      receiptFooter: { type: String, default: "Thank you for your patronage!" },
      showLogoOnReceipt: { type: Boolean, default: true },
      // Printer paper for receipts: thermal 80mm / 58mm rolls, or a normal A4 printer.
      receiptPaper: { type: String, enum: ["80mm", "58mm", "a4"], default: "80mm" },
      lowStockNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      whatsappNotifications: { type: Boolean, default: true },
      allowCashierReports: { type: Boolean, default: false },
    },

    onboarding: {
      completed: { type: Boolean, default: false },
      step: { type: Number, default: 1 },
      completedAt: Date,
    },

    // Referral programme
    referralCode: { type: String, trim: true, uppercase: true },
    referredBy: { type: ObjectId, ref: "Tenant", default: null },
    referralCreditDays: { type: Number, default: 0, min: 0 }, // free days waiting for the next paid period
    referralPayout: {
      bankName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      accountName: { type: String, trim: true, default: "" },
    },
    // Old Paystack subscription we disabled ourselves (e.g. to move the next charge date);
    // its "subscription.disable" webhook must not be treated as a cancellation.
    paystackRescheduledFrom: { type: String, default: "" },

    remindersSent: { type: [String], default: [] },
    lastLowStockAlertAt: Date,
  },
  baseOptions,
);

TenantSchema.index({ slug: 1 }, { unique: true });
TenantSchema.index({ subscriptionStatus: 1, trialEndsAt: 1 });
TenantSchema.index({ subscriptionStatus: 1, subscriptionEndDate: 1 });
TenantSchema.index({ createdAt: -1 });
TenantSchema.index({ businessName: 1 });
TenantSchema.index({ referralCode: 1 }, { unique: true, partialFilterExpression: { referralCode: { $type: "string" } } });
TenantSchema.index({ referredBy: 1 }, { sparse: true });

export default defineModel("Tenant", TenantSchema);
