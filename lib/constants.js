// Shared constants. Safe to import from both server and client code.

export const APP_NAME = "StockPilot";
export const TRIAL_DAYS = 3; // Business rule: the free trial is exactly 3 days.
// Trial reminders: sent when this many days (or fewer) are left.
export const TRIAL_REMINDER_DAYS = [2, 1];
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

// Countries for sign-up/settings: shop currency + phone dial code. Nigeria first, then by region.
export const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", dial: "234" },
  { code: "GH", name: "Ghana", currency: "GHS", dial: "233" },
  { code: "KE", name: "Kenya", currency: "KES", dial: "254" },
  { code: "ZA", name: "South Africa", currency: "ZAR", dial: "27" },
  { code: "EG", name: "Egypt", currency: "EGP", dial: "20" },
  { code: "MA", name: "Morocco", currency: "MAD", dial: "212" },
  { code: "TZ", name: "Tanzania", currency: "TZS", dial: "255" },
  { code: "UG", name: "Uganda", currency: "UGX", dial: "256" },
  { code: "RW", name: "Rwanda", currency: "RWF", dial: "250" },
  { code: "ET", name: "Ethiopia", currency: "ETB", dial: "251" },
  { code: "CM", name: "Cameroon", currency: "XAF", dial: "237" },
  { code: "SN", name: "Senegal", currency: "XOF", dial: "221" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", dial: "225" },
  { code: "BJ", name: "Benin", currency: "XOF", dial: "229" },
  { code: "TG", name: "Togo", currency: "XOF", dial: "228" },
  { code: "BF", name: "Burkina Faso", currency: "XOF", dial: "226" },
  { code: "ML", name: "Mali", currency: "XOF", dial: "223" },
  { code: "NE", name: "Niger", currency: "XOF", dial: "227" },
  { code: "LR", name: "Liberia", currency: "LRD", dial: "231" },
  { code: "SL", name: "Sierra Leone", currency: "SLE", dial: "232" },
  { code: "GM", name: "Gambia", currency: "GMD", dial: "220" },
  { code: "ZM", name: "Zambia", currency: "ZMW", dial: "260" },
  { code: "ZW", name: "Zimbabwe", currency: "USD", dial: "263" },
  { code: "BW", name: "Botswana", currency: "BWP", dial: "267" },
  { code: "NA", name: "Namibia", currency: "NAD", dial: "264" },
  { code: "MW", name: "Malawi", currency: "MWK", dial: "265" },
  { code: "MZ", name: "Mozambique", currency: "MZN", dial: "258" },
  { code: "AO", name: "Angola", currency: "AOA", dial: "244" },
  { code: "US", name: "United States", currency: "USD", dial: "1" },
  { code: "CA", name: "Canada", currency: "CAD", dial: "1" },
  { code: "MX", name: "Mexico", currency: "MXN", dial: "52" },
  { code: "BR", name: "Brazil", currency: "BRL", dial: "55" },
  { code: "AR", name: "Argentina", currency: "ARS", dial: "54" },
  { code: "CO", name: "Colombia", currency: "COP", dial: "57" },
  { code: "CL", name: "Chile", currency: "CLP", dial: "56" },
  { code: "PE", name: "Peru", currency: "PEN", dial: "51" },
  { code: "JM", name: "Jamaica", currency: "JMD", dial: "1" },
  { code: "TT", name: "Trinidad and Tobago", currency: "TTD", dial: "1" },
  { code: "GB", name: "United Kingdom", currency: "GBP", dial: "44" },
  { code: "IE", name: "Ireland", currency: "EUR", dial: "353" },
  { code: "DE", name: "Germany", currency: "EUR", dial: "49" },
  { code: "FR", name: "France", currency: "EUR", dial: "33" },
  { code: "NL", name: "Netherlands", currency: "EUR", dial: "31" },
  { code: "BE", name: "Belgium", currency: "EUR", dial: "32" },
  { code: "ES", name: "Spain", currency: "EUR", dial: "34" },
  { code: "PT", name: "Portugal", currency: "EUR", dial: "351" },
  { code: "IT", name: "Italy", currency: "EUR", dial: "39" },
  { code: "AT", name: "Austria", currency: "EUR", dial: "43" },
  { code: "FI", name: "Finland", currency: "EUR", dial: "358" },
  { code: "CH", name: "Switzerland", currency: "CHF", dial: "41" },
  { code: "SE", name: "Sweden", currency: "SEK", dial: "46" },
  { code: "NO", name: "Norway", currency: "NOK", dial: "47" },
  { code: "DK", name: "Denmark", currency: "DKK", dial: "45" },
  { code: "PL", name: "Poland", currency: "PLN", dial: "48" },
  { code: "TR", name: "Türkiye", currency: "TRY", dial: "90" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", dial: "971" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", dial: "966" },
  { code: "QA", name: "Qatar", currency: "QAR", dial: "974" },
  { code: "KW", name: "Kuwait", currency: "KWD", dial: "965" },
  { code: "IL", name: "Israel", currency: "ILS", dial: "972" },
  { code: "IN", name: "India", currency: "INR", dial: "91" },
  { code: "PK", name: "Pakistan", currency: "PKR", dial: "92" },
  { code: "BD", name: "Bangladesh", currency: "BDT", dial: "880" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", dial: "94" },
  { code: "NP", name: "Nepal", currency: "NPR", dial: "977" },
  { code: "PH", name: "Philippines", currency: "PHP", dial: "63" },
  { code: "MY", name: "Malaysia", currency: "MYR", dial: "60" },
  { code: "SG", name: "Singapore", currency: "SGD", dial: "65" },
  { code: "ID", name: "Indonesia", currency: "IDR", dial: "62" },
  { code: "TH", name: "Thailand", currency: "THB", dial: "66" },
  { code: "VN", name: "Vietnam", currency: "VND", dial: "84" },
  { code: "CN", name: "China", currency: "CNY", dial: "86" },
  { code: "HK", name: "Hong Kong", currency: "HKD", dial: "852" },
  { code: "JP", name: "Japan", currency: "JPY", dial: "81" },
  { code: "KR", name: "South Korea", currency: "KRW", dial: "82" },
  { code: "AU", name: "Australia", currency: "AUD", dial: "61" },
  { code: "NZ", name: "New Zealand", currency: "NZD", dial: "64" },
  { code: "OTHER", name: "Other country", currency: "USD", dial: "" },
];

// Currencies a shop can sell in.
export const CURRENCIES = [
  { code: "NGN", label: "Nigerian Naira (₦)" },
  { code: "GHS", label: "Ghanaian Cedi (GH₵)" },
  { code: "KES", label: "Kenyan Shilling (KSh)" },
  { code: "ZAR", label: "South African Rand (R)" },
  { code: "EGP", label: "Egyptian Pound" },
  { code: "MAD", label: "Moroccan Dirham" },
  { code: "TZS", label: "Tanzanian Shilling" },
  { code: "UGX", label: "Ugandan Shilling" },
  { code: "RWF", label: "Rwandan Franc" },
  { code: "ETB", label: "Ethiopian Birr" },
  { code: "XAF", label: "Central African CFA (FCFA)" },
  { code: "XOF", label: "West African CFA (CFA)" },
  { code: "LRD", label: "Liberian Dollar" },
  { code: "SLE", label: "Sierra Leonean Leone" },
  { code: "GMD", label: "Gambian Dalasi" },
  { code: "ZMW", label: "Zambian Kwacha" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "BWP", label: "Botswana Pula" },
  { code: "NAD", label: "Namibian Dollar" },
  { code: "MWK", label: "Malawian Kwacha" },
  { code: "MZN", label: "Mozambican Metical" },
  { code: "AOA", label: "Angolan Kwanza" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "ARS", label: "Argentine Peso" },
  { code: "COP", label: "Colombian Peso" },
  { code: "CLP", label: "Chilean Peso" },
  { code: "PEN", label: "Peruvian Sol" },
  { code: "JMD", label: "Jamaican Dollar" },
  { code: "TTD", label: "Trinidad and Tobago Dollar" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "SEK", label: "Swedish Krona" },
  { code: "NOK", label: "Norwegian Krone" },
  { code: "DKK", label: "Danish Krone" },
  { code: "PLN", label: "Polish Złoty" },
  { code: "TRY", label: "Turkish Lira" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "QAR", label: "Qatari Riyal" },
  { code: "KWD", label: "Kuwaiti Dinar" },
  { code: "ILS", label: "Israeli Shekel" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "PKR", label: "Pakistani Rupee" },
  { code: "BDT", label: "Bangladeshi Taka" },
  { code: "LKR", label: "Sri Lankan Rupee" },
  { code: "NPR", label: "Nepalese Rupee" },
  { code: "PHP", label: "Philippine Peso" },
  { code: "MYR", label: "Malaysian Ringgit" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "IDR", label: "Indonesian Rupiah" },
  { code: "THB", label: "Thai Baht" },
  { code: "VND", label: "Vietnamese Dong" },
  { code: "CNY", label: "Chinese Yuan" },
  { code: "HKD", label: "Hong Kong Dollar" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "KRW", label: "South Korean Won" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "NZD", label: "New Zealand Dollar" },
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
  "renewal_due",
  "subscription_cancelled",
  "subscription_changed",
  "staff_invitation",
  "announcement",
  "referral",
  "system",
];

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
