import { withApi } from "@/lib/api";
import { listPayments } from "@/services/admin";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(async ({ searchParams }) => listPayments({ ...pageParams(searchParams, 25), status: str(searchParams, "status"), search: str(searchParams, "q") }), { superAdmin: true });
