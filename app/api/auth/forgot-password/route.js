import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { forgotPasswordSchema } from "@/lib/validators";
import { requestPasswordReset } from "@/services/auth";

export const POST = withApi(
  async ({ request }) => {
    const { email } = parse(forgotPasswordSchema, await readJson(request));
    await requestPasswordReset(email);
    return { ok: true, message: "If an account exists for that email, we've sent a password reset link." };
  },
  { auth: false, rateLimit: "passwordReset" },
);
