import { withApi } from "@/lib/api";
import { listTenants } from "@/services/admin";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(
  async ({ searchParams }) =>
    listTenants({ ...pageParams(searchParams), search: str(searchParams, "q"), subscriptionStatus: str(searchParams, "subscription"), status: str(searchParams, "status"), planId: str(searchParams, "plan") }),
  { superAdmin: true },
);
