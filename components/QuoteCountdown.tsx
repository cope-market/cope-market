"use client";

import {useEffect, useState} from "react";

/// A quote is honoured for thirty seconds and the contract will reject a stale one, so the
/// remaining time is shown rather than left for the user to discover at the signature.

export function QuoteCountdown({expiresAt, onExpire}: {expiresAt: string; onExpire: () => void}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) onExpire();
    };
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const urgent = remaining <= 8;

  return (
    <span className={`num text-[0.75rem] ${urgent ? "text-warn" : "text-dim"}`}>
      {remaining > 0 ? `Quote holds for ${remaining}s` : "Quote expired"}
    </span>
  );
}
