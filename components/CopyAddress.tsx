"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {shortAddress} from "@/lib/format";

/// The embedded wallet's address, shortened to fit, with the whole of it one tap away.
///
/// What is shown and what is copied are deliberately different: a handle-sized line has no room
/// for forty-two characters, but a transfer needs every one of them. Sending to a truncated
/// address loses the funds, so the clipboard always gets the full string and never what is on
/// screen.
///
/// Copying can fail — permission refused, or a context the Clipboard API will not run in. Rather
/// than report failure and leave the user stuck, the full address is revealed for them to select
/// by hand, which is the thing they were trying to get at anyway.

type State = "idle" | "copied" | "manual";

export function CopyAddress({address, className = ""}: {address: string; className?: string}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    void (async () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        await navigator.clipboard.writeText(address);
        setState("copied");
        timer.current = setTimeout(() => setState("idle"), 2_000);
      } catch {
        // No clipboard to write to. Show the address instead of an apology.
        setState("manual");
      }
    })();
  }, [address]);

  if (state === "manual") {
    return (
      <span className={`block ${className}`}>
        <span className="num select-all break-all text-[0.75rem] text-muted">{address}</span>
        <span className="mt-0.5 block text-[0.6875rem] text-dim">
          Copying is blocked here — select the address above.
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy wallet address ${address}`}
      title={address}
      className={`group flex w-fit items-center gap-1.5 text-[0.75rem] text-dim hover:text-muted ${className}`}
    >
      <span className="num">{state === "copied" ? "Address copied" : shortAddress(address)}</span>
      <span aria-hidden="true" className="text-[0.6875rem] text-accent">
        {state === "copied" ? "✓" : "Copy"}
      </span>
    </button>
  );
}
