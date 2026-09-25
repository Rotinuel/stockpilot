import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { planSchema } from "@/lib/validators";
import { updatePlan, deactivatePlan } from "@/services/admin";

export const PATCH = withApi(async ({ request, params, session }) => updatePlan(session.user, params.id, parse(planSchema.partial(), await readJson(request)), request), { superAdmin: true });

export const DELETE = withApi(async ({ request, params, session }) => deactivatePlan(session.user, params.id, request), { superAdmin: true });
