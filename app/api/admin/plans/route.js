import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { planSchema } from "@/lib/validators";
import { listPlansWithCounts, createPlan } from "@/services/admin";

export const GET = withApi(async () => ({ plans: await listPlansWithCounts() }), { superAdmin: true });

export const POST = withApi(async ({ request, session }) => ({ plan: await createPlan(session.user, parse(planSchema, await readJson(request)), request) }), { superAdmin: true });
