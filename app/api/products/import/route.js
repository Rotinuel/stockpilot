import { withApi } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { importProducts } from "@/services/products";

// Accepts multipart/form-data (file) or text/csv body.
export const POST = withApi(
  async ({ request, ctx }) => {
    let text = "";
    const type = request.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file.text !== "function") throw badRequest("Attach a CSV file.");
      if (file.size > 3_000_000) throw badRequest("CSV file is too large (max 3 MB).");
      text = await file.text();
    } else {
      text = await request.text();
      if (text.length > 3_000_000) throw badRequest("CSV file is too large (max 3 MB).");
    }
    return importProducts(ctx, text, request);
  },
  { permission: "products:import", write: true },
);
