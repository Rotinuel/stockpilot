import { withApi } from "@/lib/api";
import { listUsers } from "@/services/admin";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(async ({ searchParams }) => listUsers({ ...pageParams(searchParams, 25), search: str(searchParams, "q"), role: str(searchParams, "role") }), { superAdmin: true });
