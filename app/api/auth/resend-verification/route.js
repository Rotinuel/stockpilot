import { withApi } from "@/lib/api";
import { resendVerification } from "@/services/auth";

export const POST = withApi(async ({ session }) => resendVerification(session.user._id), { rateLimit: "passwordReset", anyUser: true });
