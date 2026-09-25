import { withApi } from "@/lib/api";
import { listPlatformAudit } from "@/services/admin";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(async ({ searchParams }) => listPlatformAudit({ ...pageParams(searchParams, 30), action: str(searchParams, "action", 40), tenantId: str(searchParams, "tenant") }), { superAdmin: true });
