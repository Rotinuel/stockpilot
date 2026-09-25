"use client";

import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function UserToggle({ user }) {
  const confirm = useConfirm();
  const { run, loading } = useAction();
  if (user.role === "super_admin") return null;
  const toggle = async () => {
    const ok = await confirm({ title: user.isActive ? `Deactivate ${user.email}?` : `Activate ${user.email}?`, message: user.isActive ? "They will be signed out immediately." : "They will be able to sign in again.", confirmLabel: user.isActive ? "Deactivate" : "Activate", tone: user.isActive ? "danger" : "primary" });
    if (ok) await run(() => apiFetch(`/api/admin/users/${user._id}`, { method: "PATCH", body: { isActive: !user.isActive } }), { success: "User updated", refresh: true });
  };
  return (
    <Button size="xs" variant={user.isActive ? "danger-outline" : "outline"} loading={loading} onClick={toggle}>
      {user.isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
