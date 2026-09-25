import { withApi } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { saveAsset } from "@/services/assets";

export const POST = withApi(
  async ({ request, ctx }) => {
    const form = await request.formData();
    const kind = String(form.get("kind") || "product");
    if (!["logo", "product", "avatar"].includes(kind)) throw badRequest("Invalid upload type.");
    return saveAsset({ tenantId: ctx.tenantId, userId: ctx.userId, kind, file: form.get("file") });
  },
  { rateLimit: { limit: 60, windowMs: 10 * 60 * 1000 } },
);
