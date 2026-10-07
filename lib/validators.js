// Input validation schemas (zod). Every API route validates its body/query
// with these before touching the database. Strings are coerced/trimmed so
// raw objects (e.g. {"$gt": ""}) can never reach a MongoDB filter.
import { z } from "zod";
import {
  UNITS,
  PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
  PRODUCT_STATUSES,
  BUSINESS_TYPES,
  CURRENCIES,
} from "./constants.js";

const emptyToUndef = (v) => (v === "" || v === null ? undefined : v);
export const opt = (schema) => z.preprocess(emptyToUndef, schema.optional());

export const objectId = z.string().trim().regex(/^[a-f0-9]{24}$/i, "Invalid ID");
export const optionalObjectId = z.preprocess((v) => (v === "" || v === "none" ? null : v), objectId.nullable().optional());

const str = (max = 200) => z.string().trim().max(max);
// Uploaded images are served from /api/assets/<id>; external https URLs are also accepted.
const imageUrl = () =>
  str(500).refine((v) => v === "" || /^\/api\/assets\/[a-f0-9]{24}$/i.test(v) || /^https:\/\/[^\s"'<>]+$/i.test(v), "Upload a JPG, PNG or WebP image.");
const reqStr = (label, max = 200) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);
const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+0-9()\-\s]*$/, "Enter a valid phone number");
const money = z.coerce.number({ invalid_type_error: "Enter a valid amount" }).min(0, "Amount cannot be negative").max(1_000_000_000_000);
const qty = z.coerce.number({ invalid_type_error: "Enter a valid quantity" }).min(0, "Quantity cannot be negative").max(100_000_000);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .refine((s) => /[A-Za-z]/.test(s) && /[0-9]/.test(s), "Password must contain letters and numbers");

// ── Auth ────────────────────────────────────────────────────
export const registerSchema = z.object({
  businessName: reqStr("Business name", 120),
  ownerName: reqStr("Your name", 120),
  email,
  phone: phone.min(7, "Enter a valid phone number"),
  password,
  country: reqStr("Country", 60),
  businessType: reqStr("Business type", 60),
  whatsappOptIn: z.boolean().optional().default(true),
  referralCode: opt(str(16)),
  timezone: opt(str(60)),
});

// Google sign-up: identity comes from the verified Google token, not from the form.
export const googleSignupSchema = z.object({
  businessName: reqStr("Business name", 120),
  ownerName: reqStr("Your name", 120),
  phone: phone.min(7, "Enter a valid phone number"),
  country: reqStr("Country", 60),
  businessType: reqStr("Business type", 60),
  whatsappOptIn: z.boolean().optional().default(true),
  referralCode: opt(str(16)),
  timezone: opt(str(60)),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: reqStr("Name", 120),
  phone: opt(phone),
  password,
});

// ── Account ────────────────────────────────────────────────
export const accountSchema = z.object({
  name: reqStr("Name", 120),
  phone: opt(phone),
  avatar: opt(str(500)),
});
export const changeEmailSchema = z.object({ email, currentPassword: z.string().min(1).max(128) });
export const changePasswordSchema = z.object({ currentPassword: z.string().max(128).optional().default(""), newPassword: password });

// ── Tenant settings / onboarding ────────────────────────────
export const businessSettingsSchema = z.object({
  businessName: opt(reqStr("Business name", 120)),
  email: opt(email),
  phone: opt(phone),
  whatsappNumber: z.preprocess((v) => (v === null ? "" : v), phone.optional()),
  address: opt(str(300)),
  businessType: opt(str(60)),
  logo: opt(imageUrl()),
  currency: opt(z.enum(CURRENCIES.map((c) => c.code))),
  timezone: opt(str(60)),
  country: opt(str(60)),
  settings: z
    .object({
      taxRate: opt(z.coerce.number().min(0).max(100)),
      taxLabel: opt(str(20)),
      invoicePrefix: opt(z.string().trim().max(8).regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")),
      purchasePrefix: opt(z.string().trim().max(8).regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")),
      receiptHeader: opt(str(300)),
      receiptFooter: opt(str(300)),
      showLogoOnReceipt: opt(z.coerce.boolean()),
      receiptPaper: opt(z.enum(["80mm", "58mm", "a4"])),
      lowStockNotifications: opt(z.coerce.boolean()),
      emailNotifications: opt(z.coerce.boolean()),
      whatsappNotifications: opt(z.coerce.boolean()),
      allowCashierReports: opt(z.coerce.boolean()),
    })
    .partial()
    .optional(),
});

export const onboardingStepSchema = z.object({
  step: z.coerce.number().int().min(1).max(6),
  data: z.record(z.any()).optional(),
});

// ── Catalogue ──────────────────────────────────────────────
export const categorySchema = z.object({ name: reqStr("Category name", 80), description: opt(str(300)) });

export const productSchema = z
  .object({
    name: reqStr("Product name", 160),
    sku: opt(z.string().trim().max(64).regex(/^[A-Za-z0-9._\-/]+$/, "SKU may contain letters, numbers, . _ - /")),
    barcode: opt(z.string().trim().max(64).regex(/^[A-Za-z0-9\-]+$/, "Barcode may contain letters, numbers and dashes")),
    categoryId: optionalObjectId,
    categoryName: opt(str(80)),
    brand: opt(str(80)),
    description: opt(str(1000)),
    costPrice: money.default(0),
    sellingPrice: money,
    quantity: opt(qty), // opening stock (create only)
    minimumStockLevel: qty.default(0),
    unit: z.enum(UNITS).default("piece"),
    supplierId: optionalObjectId,
    image: opt(imageUrl()),
    status: z.enum(PRODUCT_STATUSES).default("active"),
  })
  .refine((d) => d.sellingPrice >= 0, { path: ["sellingPrice"], message: "Selling price is required" });

export const productUpdateSchema = z.object({
  name: opt(reqStr("Product name", 160)),
  sku: opt(z.string().trim().max(64).regex(/^[A-Za-z0-9._\-/]+$/, "SKU may contain letters, numbers, . _ - /")),
  barcode: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(64).nullable().optional()),
  categoryId: optionalObjectId,
  brand: opt(str(80)),
  description: opt(str(1000)),
  costPrice: opt(money),
  sellingPrice: opt(money),
  minimumStockLevel: opt(qty),
  unit: opt(z.enum(UNITS)),
  supplierId: optionalObjectId,
  image: z.preprocess((v) => (v === null ? "" : v), imageUrl().optional()),
  status: opt(z.enum(PRODUCT_STATUSES)),
});

// ── Inventory ──────────────────────────────────────────────
export const stockAdjustSchema = z.object({
  productId: objectId,
  action: z.enum(["add", "remove", "set", "damage", "return"]),
  quantity: qty,
  reason: opt(str(300)),
  locationId: optionalObjectId,
  unitCost: opt(money),
});

export const stockTransferSchema = z
  .object({
    productId: objectId,
    fromLocationId: objectId,
    toLocationId: objectId,
    quantity: z.coerce.number().positive("Quantity must be greater than zero").max(100_000_000),
    reason: opt(str(300)),
  })
  .refine((d) => d.fromLocationId !== d.toLocationId, { path: ["toLocationId"], message: "Choose a different destination" });

// ── Sales ──────────────────────────────────────────────────
export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.coerce.number().positive("Quantity must be greater than zero").max(1_000_000),
      }),
    )
    .min(1, "Add at least one product")
    .max(200, "Too many line items"),
  customerId: optionalObjectId,
  discountType: z.enum(["amount", "percent"]).default("amount"),
  discountValue: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  amountTendered: opt(money),
  notes: opt(str(500)),
  locationId: optionalObjectId,
  clientRequestId: opt(str(80)), // idempotency for double-clicks and offline re-sync
  occurredAt: opt(z.coerce.date()), // device time of a sale recorded offline
});

export const cancelSaleSchema = z.object({ reason: opt(str(300)) });

// ── Purchases ──────────────────────────────────────────────
export const purchaseSchema = z.object({
  supplierId: optionalObjectId,
  invoiceNumber: opt(str(64)),
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.coerce.number().positive("Quantity must be greater than zero").max(100_000_000),
        unitCost: money,
        sellingPrice: opt(money),
      }),
    )
    .min(1, "Add at least one product")
    .max(300),
  otherCharges: money.default(0),
  amountPaid: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  purchaseDate: opt(z.coerce.date()),
  notes: opt(str(500)),
  updateCostPrice: z.coerce.boolean().default(true),
  locationId: optionalObjectId,
});

// ── Parties ────────────────────────────────────────────────
export const customerSchema = z.object({
  name: reqStr("Customer name", 120),
  phone: opt(phone),
  email: opt(email),
  address: opt(str(300)),
  type: z.enum(["cash", "credit"]).default("cash"),
  creditLimit: money.default(0),
  notes: opt(str(1000)),
});

export const supplierSchema = z.object({
  name: reqStr("Supplier name", 120),
  company: opt(str(160)),
  phone: opt(phone),
  email: opt(email),
  address: opt(str(300)),
  notes: opt(str(1000)),
});

export const balancePaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1_000_000_000_000),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  note: opt(str(300)),
});

// ── Expenses ───────────────────────────────────────────────
export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: opt(str(300)),
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1_000_000_000_000),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  date: z.coerce.date().default(() => new Date()),
  reference: opt(str(64)),
  locationId: optionalObjectId,
});

// ── Staff & locations ─────────────────────────────────────
export const inviteSchema = z.object({
  email,
  name: opt(str(120)),
  role: z.enum(["admin", "manager", "cashier", "inventory_staff"]),
  locationId: optionalObjectId,
});

export const staffUpdateSchema = z.object({
  role: opt(z.enum(["admin", "manager", "cashier", "inventory_staff"])),
  isActive: opt(z.coerce.boolean()),
  defaultLocationId: optionalObjectId,
});

export const locationSchema = z.object({
  name: reqStr("Location name", 120),
  address: opt(str(300)),
  phone: opt(phone),
  managerId: optionalObjectId,
  isActive: z.coerce.boolean().default(true),
});

// ── Billing ────────────────────────────────────────────────
export const checkoutSchema = z.object({
  planId: objectId,
  autoRenew: z.boolean().optional().default(true),
  cycle: z.enum(["monthly", "annually"]).optional(),
});
export const verifyPaymentSchema = z.object({ reference: z.string().trim().min(6).max(120).regex(/^[A-Za-z0-9_\-.=]+$/) });

// ── Super admin ───────────────────────────────────────────
export const planSchema = z.object({
  code: z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, - and _ only"),
  name: reqStr("Plan name", 60),
  description: opt(str(300)),
  price: money,
  yearlyPrice: z.coerce.number().min(0).max(1e9).default(0),
  usdPrice: z.coerce.number().min(0).max(1e7).default(0),
  usdYearlyPrice: z.coerce.number().min(0).max(1e8).default(0),
  currency: z.string().trim().length(3).default("NGN"),
  interval: z.enum(["monthly", "quarterly", "biannually", "annually"]).default("monthly"),
  isTrial: z.coerce.boolean().default(false),
  durationDays: z.coerce.number().int().min(1).max(3650).default(30),
  isActive: z.coerce.boolean().default(true),
  isPublic: z.coerce.boolean().default(true),
  highlight: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  featureList: z.array(str(120)).max(30).default([]),
  limits: z.object({
    products: z.coerce.number().int().min(-1),
    staffUsers: z.coerce.number().int().min(-1),
    locations: z.coerce.number().int().min(-1),
    monthlyTransactions: z.coerce.number().int().min(-1),
  }),
  features: z.object({
    expenses: z.coerce.boolean().default(false),
    advancedReports: z.coerce.boolean().default(false),
    profitAnalysis: z.coerce.boolean().default(false),
    lowStockAlerts: z.coerce.boolean().default(false),
    customerBalances: z.coerce.boolean().default(false),
    supplierBalances: z.coerce.boolean().default(false),
    export: z.coerce.boolean().default(false),
    auditLogs: z.coerce.boolean().default(false),
    multiLocation: z.coerce.boolean().default(false),
    prioritySupport: z.coerce.boolean().default(false),
  }),
});

export const adminTenantActionSchema = z.object({
  action: z.enum(["suspend", "activate", "extend_trial", "set_plan"]),
  reason: opt(str(300)),
  days: opt(z.coerce.number().int().min(1).max(90)),
  planId: optionalObjectId,
  periodDays: opt(z.coerce.number().int().min(1).max(400)),
});

export const platformSettingsSchema = z.object({
  gracePeriodDays: opt(z.coerce.number().int().min(0).max(30)),
  allowRegistrations: opt(z.coerce.boolean()),
  supportEmail: opt(email),
  supportPhone: opt(str(32)),
  defaultCurrency: opt(z.string().trim().length(3)),
  maintenanceMode: opt(z.coerce.boolean()),
  referral: z
    .object({
      enabled: z.coerce.boolean().default(true),
      rewardType: z.enum(["days", "commission", "both"]).default("both"),
      rewardDays: z.coerce.number().int().min(0).max(365).default(30),
      commissionPercent: z.coerce.number().min(0).max(100).default(10),
    })
    .optional(),
  announcement: z
    .object({
      active: z.coerce.boolean().default(false),
      message: str(300).default(""),
      level: z.enum(["info", "warning", "success"]).default("info"),
    })
    .optional(),
});

export const referralPayoutSchema = z.object({
  bankName: reqStr("Bank name", 80),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, "Enter a valid account number (digits only)"),
  accountName: reqStr("Account name", 120),
});

export const referralAdminActionSchema = z.object({
  action: z.enum(["mark_paid", "mark_owed", "void"]),
  note: opt(str(300)),
});

export const announcementSchema = z.object({
  title: reqStr("Title", 160),
  message: reqStr("Message", 1000),
  severity: z.enum(["info", "success", "warning", "danger"]).default("info"),
});

export { BUSINESS_TYPES };
