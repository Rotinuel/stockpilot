import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { staffUpdateSchema } from "@/lib/validators";
import { updateStaff } from "@/services/staff";

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ user: await updateStaff(ctx, params.id, parse(staffUpdateSchema, await readJson(request)), request) }),
  { permission: "staff:manage" },
);
