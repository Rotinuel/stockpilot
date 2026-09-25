"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/hooks/useApi";

export default function LogoutButton({ variant = "outline", size = "md", className }) {
  const router = useRouter();
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  return (
    <Button variant={variant} size={size} onClick={logout} icon={LogOut} className={className}>
      Sign out
    </Button>
  );
}
