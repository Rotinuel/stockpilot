import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  Truck,
  Users,
  Factory,
  Wallet,
  ChartColumn,
  UserCog,
  MapPin,
  CreditCard,
  Settings,
  History,
} from "lucide-react";

// Sidebar definition. `permission` is checked against the permissions list the
// server computed for this user; the server enforces the same rules on every API.
export const NAV_SECTIONS = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/pos", label: "POS", icon: ShoppingCart, permission: "pos:use" },
      { href: "/sales", label: "Sales", icon: Receipt, permission: "sales:view" },
      { href: "/products", label: "Products", icon: Package, permission: "products:view" },
      { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory:view", badgeKey: "lowStock" },
      { href: "/purchases", label: "Purchases", icon: Truck, permission: "purchases:view" },
    ],
  },
  {
    label: "People & money",
    items: [
      { href: "/customers", label: "Customers", icon: Users, permission: "customers:view" },
      { href: "/suppliers", label: "Suppliers", icon: Factory, permission: "suppliers:view" },
      { href: "/expenses", label: "Expenses", icon: Wallet, permission: "expenses:view", feature: "expenses" },
      { href: "/reports", label: "Reports", icon: ChartColumn, permission: "reports:view" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/staff", label: "Staff", icon: UserCog, permission: "staff:view" },
      { href: "/locations", label: "Locations", icon: MapPin, permission: "locations:view" },
      { href: "/audit-logs", label: "Audit logs", icon: History, permission: "audit:view", feature: "auditLogs" },
      { href: "/billing", label: "Billing", icon: CreditCard, permission: "billing:view" },
      { href: "/settings", label: "Settings", icon: Settings, permission: null },
    ],
  },
];
