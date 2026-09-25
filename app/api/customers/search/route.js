import { withApi } from "@/lib/api";
import { searchCustomers } from "@/services/customers";
import { str } from "@/lib/query";

export const GET = withApi(async ({ ctx, searchParams }) => ({ items: await searchCustomers(ctx, str(searchParams, "q", 60)) }), { permission: "customers:view" });
