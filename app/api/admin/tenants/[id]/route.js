import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { adminTenantActionSchema } from "@/lib/validators";
import { getTenantDetail, tenantAction } from "@/services/admin";

export const GET = withApi(async ({ params }) => getTenantDetail(params.id), { superAdmin: true });

// PATCH { action: "suspend" | "activate" | "extend_trial" | "set_plan", ... }
export const PATCH = withApi(
  async ({ request, params, session }) => tenantAction(session.user, params.id, parse(adminTenantActionSchema, await readJson(request)), request),
  { superAdmin: true },
);
