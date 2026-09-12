"use client";

import {useEffect} from "react";
import type {ReactNode} from "react";

/// A bottom sheet. Dismissing it is deliberately not possible mid-transaction — the caller
/// controls `dismissible`, and while something is signing or confirming there is nothing useful a
/// dismissal could do except hide the outcome.

export function Sheet({
  open,
  onClose,
  title,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  dismissible?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="relative w-full max-w-lg rounded-t-3xl border-t border-line-strong bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
          {dismissible ? (
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 rounded-lg p-1.5 text-dim hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="max-h-[78dvh] overflow-y-auto px-5">{children}</div>
      </div>
    </div>
  );
}
