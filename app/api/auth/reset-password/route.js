import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { resetPasswordSchema } from "@/lib/validators";
import { resetPassword } from "@/services/auth";

export const POST = withApi(
  async ({ request }) => {
    const data = parse(resetPasswordSchema, await readJson(request));
    await resetPassword(data, request);
    return { ok: true, message: "Your password has been reset. You can now sign in." };
  },
  { auth: false, rateLimit: "passwordReset" },
);
