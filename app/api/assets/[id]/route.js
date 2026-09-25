import { withApi } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { readAsset } from "@/services/assets";

// Images are only served to users of the tenant that owns them (or super admins).
export const GET = withApi(
  async ({ params, session }) => {
    const asset = await readAsset(params.id);
    if (!session.isSuperAdmin && String(asset.tenantId) !== String(session.tenant?._id)) throw notFound();
    const data = asset.data?.buffer ? Buffer.from(asset.data.buffer) : Buffer.from(asset.data);
    return new Response(data, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  },
  { anyUser: true },
);
