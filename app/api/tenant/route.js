import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { businessSettingsSchema } from "@/lib/validators";
import { getBusiness, updateBusiness } from "@/services/tenant";

export const GET = withApi(async ({ ctx }) => ({ tenant: await getBusiness(ctx) }), { permission: "settings:business" });

export const PATCH = withApi(
  async ({ request, ctx }) => {
    const data = parse(businessSettingsSchema, await readJson(request));
    return { tenant: await updateBusiness(ctx, data, request) };
  },
  { permission: "settings:business" },
);
