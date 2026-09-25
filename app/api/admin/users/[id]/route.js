import { withApi } from "@/lib/api";
import { readJson } from "@/lib/request";
import { badRequest } from "@/lib/errors";
import { setUserActive } from "@/services/admin";

export const PATCH = withApi(
  async ({ request, params, session }) => {
    const body = await readJson(request);
    if (typeof body.isActive !== "boolean") throw badRequest("isActive must be true or false.");
    return { user: await setUserActive(session.user, params.id, body.isActive, request) };
  },
  { superAdmin: true },
);
