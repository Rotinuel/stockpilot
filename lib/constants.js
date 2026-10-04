// Shared constants. Safe to import from both server and client code.

export const APP_NAME = "StockPilot";
export const TRIAL_DAYS = 7; // Business rule: the free trial is exactly 7 days.
export const DEFAULT_GRACE_DAYS = 3;
export const DEFAULT_CURRENCY = "NGN";
export const SESSION_COOKIE = "sp_session";

export const TENANT_ROLES = ["owner", "admin", "manager", "cashier", "inventory_staff"];
export const SUPER_ADMIN_ROLE = "super_admin";
export const ALL_ROLES = [...TENANT_ROLES, SUPER_ADMIN_ROLE];

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  inventory_staff: "Inventory Staff",
  super_admin: "Super Admin",
};

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "expired", "cancelled", "past_due"];

export const SUBSCRIPTION_STATUS_LABELS = {
  trialing: "Free trial",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  past_due: "Past due",
};

export const UNITS = ["piece", "pack", "carton", "bottle", "kilogram", "gram", "litre", "metre", "bag", "dozen", "box", "tin", "sachet", "crate"];

export const PRODUCT_STATUSES = ["active", "inactive"];

export const PAYMENT_METHODS = ["cash", "pos", "bank_transfer", "card", "other"];
export const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  pos: "POS",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
  credit: "Credit",
};

export const EXPENSE_CATEGORIES = ["rent", "electricity", "transportation", "salary", "internet", "repairs", "marketing", "fuel", "taxes", "supplies", "other"];
export const EXPENSE_CATEGORY_LABELS = {
  rent: "Rent",
  electricity: "Electricity",
  transportation: "Transportation",
  salary: "Staff salary",
  internet: "Internet",
  repairs: "Repairs",
  marketing: "Marketing",
  fuel: "Fuel / Generator",
  taxes: "Taxes & levies",
  supplies: "Supplies",
  other: "Other",
};

export const MOVEMENT_TYPES = ["purchase", "sale", "adjustment", "return", "damage", "transfer", "opening_stock"];
export const MOVEMENT_TYPE_LABELS = {
  purchase: "Purchase",
  sale: "Sale",
  adjustment: "Adjustment",
  return: "Return",
  damage: "Damaged",
  transfer: "Transfer",
  opening_stock: "Opening stock",
};

export const BUSINESS_TYPES = [
  "Supermarket",
  "Provision store",
  "Pharmacy",
  "Boutique / Fashion",
  "Electronics",
  "Phone & accessories",
  "Cosmetics & beauty",
  "Building materials",
  "Restaurant / Food",
  "Bakery",
  "Wholesale / Distribution",
  "Hardware",
  "Bookshop / Stationery",
  "Other retail",
];

export const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "OTHER", name: "Other", currency: "USD" },
];

export const CURRENCIES = [
  { code: "NGN", label: "Nigerian Naira (₦)" },
  { code: "GHS", label: "Ghanaian Cedi (GH₵)" },
  { code: "KES", label: "Kenyan Shilling (KSh)" },
  { code: "ZAR", label: "South African Rand (R)" },
  { code: "XOF", label: "West African CFA (CFA)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "EUR", label: "Euro (€)" },
];

export const PLAN_FEATURE_LABELS = {
  expenses: "Expense tracking",
  advancedReports: "Advanced reports",
  profitAnalysis: "Profit analysis",
  lowStockAlerts: "Low-stock alerts",
  customerBalances: "Customer balances",
  supplierBalances: "Supplier balances",
  export: "Export to CSV / PDF",
  auditLogs: "Audit logs",
  multiLocation: "Multi-location support",
  prioritySupport: "Priority features & support",
};

export const PLAN_LIMIT_LABELS = {
  products: "Products",
  staffUsers: "Staff users",
  locations: "Locations",
  monthlyTransactions: "Sales per month",
};

export const NOTIFICATION_TYPES = [
  "low_stock",
  "trial_ending",
  "trial_expired",
  "payment_success",
  "payment_failed",
  "subscription_renewed",
  "subscription_cancelled",
  "subscription_changed",
  "staff_invitation",
  "announcement",
  "referral",
  "system",
];

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
