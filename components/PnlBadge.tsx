import {formatPnlUsdc6, formatReturnPercent} from "@/lib/format";

/// A position's live result, in USDC and as a return on the collateral at risk.
///
/// The figure shown is what closing now would actually settle — collateral, price move, close fee
/// and the author's cut if the position is a copy — rather than the raw mark-to-market. Showing
/// the gross number would promise the user something the contract will not pay them.

export function PnlBadge({
  netUsdc6,
  collateral,
  size = "md",
}: {
  netUsdc6: bigint;
  collateral: bigint;
  size?: "sm" | "md" | "lg";
}) {
  const tone = netUsdc6 > 0n ? "text-long" : netUsdc6 < 0n ? "text-short" : "text-muted";
  const percent = formatReturnPercent(netUsdc6, collateral);

  const type = {
    sm: "text-[0.8125rem]",
    md: "text-[1rem]",
    lg: "text-[1.5rem]",
  }[size];

  return (
    <span className={`num inline-flex items-baseline gap-1.5 font-semibold ${tone} ${type}`}>
      {formatPnlUsdc6(netUsdc6)}
      {percent ? <span className="text-[0.75em] font-medium opacity-70">{percent}</span> : null}
    </span>
  );
}
