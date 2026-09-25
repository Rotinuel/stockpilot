import { withApi } from "@/lib/api";
import { listSubscriptions } from "@/services/admin";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(async ({ searchParams }) => listSubscriptions({ ...pageParams(searchParams, 25), status: str(searchParams, "status") }), { superAdmin: true });
