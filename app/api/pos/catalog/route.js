import { withApi } from "@/lib/api";
import { posCatalog } from "@/services/products";
import { str } from "@/lib/query";
import { isValidObjectId } from "@/lib/db";

// Snapshot for offline POS (cached in the browser's IndexedDB).
export const GET = withApi(
  async ({ ctx, searchParams }) => {
    const loc = str(searchParams, "location");
    return posCatalog(ctx, loc && isValidObjectId(loc) ? loc : undefined);
  },
  { permission: "pos:use" },
);
