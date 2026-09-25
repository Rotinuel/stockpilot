import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { inviteSchema } from "@/lib/validators";
import { listStaff, inviteStaff } from "@/services/staff";

export const GET = withApi(async ({ ctx }) => listStaff(ctx), { permission: "staff:view" });

// POST /api/staff → invite a staff member
export const POST = withApi(async ({ request, ctx }) => inviteStaff(ctx, parse(inviteSchema, await readJson(request)), request), {
  permission: "staff:manage",
  write: true,
});
