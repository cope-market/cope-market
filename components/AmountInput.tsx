"use client";

import {formatUsdc6, parseUsdc6} from "@/lib/format";

/// Amounts are typed as USDC and held as 6-decimal base units. The input refuses precision USDC
/// cannot hold rather than truncating it silently, which is what `parseUsdc6` returning null for
/// "1.0000001" means.

const FRACTIONS = [
  {label: "25%", numerator: 1n, denominator: 4n},
  {label: "50%", numerator: 1n, denominator: 2n},
  {label: "Max", numerator: 1n, denominator: 1n},
] as const;

export function AmountInput({
  value,
  onChange,
  balance,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  /// USDC base units available to spend, if known.
  balance: bigint | undefined;
  disabled?: boolean;
}) {
  const parsed = parseUsdc6(value);
  const tooMuch = parsed !== null && balance !== undefined && parsed > balance;

  return (
    <div>
      <div
        className={`flex items-baseline gap-2 rounded-xl border bg-raised px-4 py-3 ${
          tooMuch ? "border-short" : "border-line"
        }`}
      >
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          aria-label="Collateral in USDC"
          className="num min-w-0 flex-1 bg-transparent text-[1.75rem] font-semibold tracking-tight outline-none placeholder:text-dim disabled:opacity-50"
        />
        <span className="text-[0.875rem] font-medium text-muted">USDC</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[0.75rem] text-dim">
          {balance === undefined ? "Balance unknown" : `${formatUsdc6(balance)} available`}
        </span>
        <div className="flex gap-1.5">
          {FRACTIONS.map((fraction) => (
            <button
              key={fraction.label}
              disabled={disabled || balance === undefined}
              onClick={() => {
                if (balance === undefined) return;
                const amount = (balance * fraction.numerator) / fraction.denominator;
                onChange(formatUsdc6(amount, {min: 0, max: 6, grouping: false}));
              }}
              className="rounded-lg border border-line px-2 py-1 text-[0.6875rem] font-medium text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40"
            >
              {fraction.label}
            </button>
          ))}
        </div>
      </div>

      {tooMuch ? (
        <p className="mt-2 text-[0.75rem] text-short">
          That is more than the balance. The vault would refuse to pull it.
        </p>
      ) : null}
      {value !== "" && parsed === null ? (
        <p className="mt-2 text-[0.75rem] text-short">
          Enter an amount with at most six decimal places — that is all USDC holds.
        </p>
      ) : null}
    </div>
  );
}
