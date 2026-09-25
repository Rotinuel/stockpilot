"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, message, confirmLabel, tone: "danger" })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState({ confirmLabel: "Confirm", cancelLabel: "Cancel", tone: "primary", ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.tone === "danger" ? <TriangleAlert className="h-5 w-5 text-rose-500" /> : null}
            {state?.title}
          </span>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              {state?.cancelLabel}
            </Button>
            <Button variant={state?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-600">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
