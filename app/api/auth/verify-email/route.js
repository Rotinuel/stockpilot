import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { tokenSchema } from "@/lib/validators";
import { verifyEmail } from "@/services/auth";

export const POST = withApi(
  async ({ request }) => {
    const { token } = parse(tokenSchema, await readJson(request));
    return verifyEmail(token);
  },
  { auth: false, rateLimit: "auth" },
);
