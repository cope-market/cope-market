"use client";

import type {ReactNode} from "react";

/// The small pieces every screen is built from. Kept in one file because they are each a few
/// lines and scattering them makes the visual language harder to hold in one's head.

export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[0.8125rem] text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

export function Card({children, className = ""}: {children: ReactNode; className?: string}) {
  return (
    <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function Row({label, value, hint}: {label: ReactNode; value: ReactNode; hint?: ReactNode}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <span className="text-right">
        <span className="num text-[0.9375rem] text-ink">{value}</span>
        {hint ? <span className="ml-2 text-[0.75rem] text-dim">{hint}</span> : null}
      </span>
    </div>
  );
}

type Tone = "neutral" | "long" | "short" | "warn" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-raised text-muted",
  long: "bg-long-soft text-long",
  short: "bg-short-soft text-short",
  warn: "bg-warn/15 text-warn",
  accent: "bg-accent/15 text-accent",
};

export function Pill({tone = "neutral", children}: {tone?: Tone; children: ReactNode}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[0.1875rem] text-[0.6875rem] font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  tone = "accent",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "long" | "short" | "quiet";
  type?: "button" | "submit";
  className?: string;
}) {
  const tones = {
    accent: "bg-accent text-accent-ink hover:brightness-110",
    long: "bg-long text-accent-ink hover:brightness-110",
    short: "bg-short text-accent-ink hover:brightness-110",
    quiet: "border border-line-strong bg-raised text-ink hover:bg-overlay",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-11 rounded-xl px-4 text-[0.9375rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Skeleton({className = ""}: {className?: string}) {
  return <div className={`animate-pulse rounded-lg bg-raised ${className}`} />;
}

/// A failure the user can do something about, or at least understand. Never a bare "error".
export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-5 text-center">
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-muted">{detail}</p>
      {onRetry ? (
        <Button tone="quiet" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function Empty({title, detail}: {title: string; detail: string}) {
  return (
    <div className="py-14 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-muted">{detail}</p>
    </div>
  );
}

/// Figures that come from a block or an indexer are qualified with when they were true. Nothing
/// in this interface says "currently" about a number it read from somewhere that lags.
export function AsOf({children}: {children: ReactNode}) {
  return <p className="mt-3 text-[0.6875rem] text-dim">{children}</p>;
}
