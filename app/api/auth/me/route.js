import { withApi } from "@/lib/api";
import { clientSession } from "@/lib/session";
import { permissionsFor } from "@/lib/rbac";

export const GET = withApi(async ({ session }) => {
  const view = clientSession(session);
  return { ...view, permissions: session.isSuperAdmin ? [] : permissionsFor(session.user.role, session.tenant?.settings) };
}, { anyUser: true });
