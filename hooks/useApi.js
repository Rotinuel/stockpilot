"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export class ClientApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** fetch() wrapper for our JSON API. Throws ClientApiError with friendly messages. */
export async function apiFetch(url, { method = "GET", body, headers, signal } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      headers: body instanceof FormData ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("sp:unreachable"));
    throw new ClientApiError("Network error — check your internet connection and try again.", { status: 0, code: "NETWORK" });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const e = data?.error || {};
    throw new ClientApiError(e.message || "Something went wrong. Please try again.", { status: res.status, code: e.code, details: e.details });
  }
  return data;
}

/**
 * const { run, loading, errors } = useAction();
 * await run(() => apiFetch(...), { success: "Saved", refresh: true })
 */
export function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const run = useCallback(
    async (fn, { success, successMessage, refresh = false, onError, silent = false } = {}) => {
      setLoading(true);
      setErrors({});
      try {
        const result = await fn();
        if (success) toast.success(success, successMessage);
        if (refresh) router.refresh();
        return result;
      } catch (err) {
        if (err?.name === "AbortError") return undefined;
        if (err?.details && typeof err.details === "object") setErrors(err.details);
        if (err?.status === 401) {
          toast.error("Session expired", "Please sign in again.");
          router.push("/login");
        } else if (!silent) {
          const title = err?.code === "SUBSCRIPTION_REQUIRED" ? "Subscription required" : err?.code === "PLAN_LIMIT" || err?.code === "PLAN_FEATURE" ? "Upgrade needed" : "Couldn't complete that";
          toast.error(title, err?.message);
        }
        onError?.(err);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [toast, router],
  );

  return { run, loading, errors, setErrors };
}
