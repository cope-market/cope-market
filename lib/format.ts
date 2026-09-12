/// Display helpers for on-chain amounts.
///
/// Every value the protocol produces is a bigint at one of two scales, and confusing them is the
/// bug this module exists to prevent. There is deliberately no function here that takes an
/// unlabelled amount: a caller has to say `formatUsdc6` or `formatWad`, which means the scale is
/// visible at the call site rather than three files away.
///
///   USDC amounts — collateral, payout, LP assets, balances .......... 6 decimals
///   Prices, confidence, P&L, liability, open interest, units, shares . 18 decimals (wad)
///
/// Arc's native balance is an 18-decimal view of the same USDC the 6-decimal ERC-20 reports. It
/// pays gas and nothing else, so it has its own formatter and its own name.

export const USDC_DECIMALS = 6;
export const WAD_DECIMALS = 18;
export const BPS = 10_000n;

/// 1e18 / 1e6. The only legal bridge between the two scales.
export const USDC_SCALE = 10n ** 12n;

export function wadFromUsdc6(amount6: bigint): bigint {
  return amount6 * USDC_SCALE;
}

/// Truncating, matching the contract's `Wad.fromWad`. A payout of 1.9999999 USDC pays 1.999999.
export function usdc6FromWad(wad: bigint): bigint {
  return wad / USDC_SCALE;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/// Half-up away from zero, so 0.5 rounds to 1 and -0.5 to -1.
function divRound(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  const remainder = value % divisor;
  if (abs(remainder) * 2n < divisor) return quotient;
  return value < 0n ? quotient - 1n : quotient + 1n;
}

export interface FixedOptions {
  /// Decimal places always shown, padded with zeros.
  min?: number;
  /// Decimal places at most; the value is rounded to this.
  max?: number;
  /// Thousands separators on the integer part.
  grouping?: boolean;
  /// Force a leading "+" on values above zero. Negatives always carry "-"; exactly zero carries
  /// neither, because a flat result is not a gain.
  sign?: boolean;
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/// The core. Everything else is this with a scale and a house style.
export function formatFixed(value: bigint, decimals: number, options: FixedOptions = {}): string {
  const {min = 2, grouping = true, sign = false} = options;
  const max = Math.max(options.max ?? min, min);

  const scaled =
    decimals > max
      ? divRound(value, 10n ** BigInt(decimals - max))
      : value * 10n ** BigInt(max - decimals);

  const negative = scaled < 0n;
  const magnitude = abs(scaled);
  const unit = 10n ** BigInt(max);

  const whole = (magnitude / unit).toString();
  let fraction = (magnitude % unit).toString().padStart(max, "0");
  // Trim the digits the caller asked to be optional, and only those.
  while (fraction.length > min && fraction.endsWith("0")) fraction = fraction.slice(0, -1);

  const prefix = negative ? "-" : sign && scaled > 0n ? "+" : "";
  const body = grouping ? group(whole) : whole;
  return fraction.length > 0 ? `${prefix}${body}.${fraction}` : `${prefix}${body}`;
}

/// A USDC amount in base units. `formatUsdc6(2000000n)` is "2.00".
export function formatUsdc6(amount6: bigint, options: FixedOptions = {}): string {
  return formatFixed(amount6, USDC_DECIMALS, options);
}

/// An 18-decimal value: a price, a P&L figure, open interest, a quantity of units.
export function formatWad(wad: bigint, options: FixedOptions = {}): string {
  return formatFixed(wad, WAD_DECIMALS, options);
}

/// Arc's native balance, which is the same USDC at 18 decimals and pays gas. Named separately so
/// nobody reaches for it when they mean the spendable balance.
export function formatGasBalance(native18: bigint): string {
  return formatFixed(native18, WAD_DECIMALS, {min: 2, max: 4});
}

/// Price precision follows the instrument. EUR/USD at 1.15985 needs five places where BTC at
/// 77,291.45 needs two, and padding either to the other's precision reads as a different quote.
export function formatPrice(priceWad: bigint): string {
  const magnitude = abs(priceWad);
  if (magnitude >= 100n * 10n ** 18n) return formatWad(priceWad, {min: 2, max: 2});
  if (magnitude >= 10n ** 18n) return formatWad(priceWad, {min: 5, max: 5});
  return formatWad(priceWad, {min: 6, max: 6});
}

/// A P&L figure in USDC, always signed, down to a hundredth of a cent. At the sizes this demo
/// trades, two decimal places would render every result as zero.
export function formatPnlUsdc6(amount6: bigint): string {
  return formatUsdc6(amount6, {min: 2, max: 4, sign: true});
}

/// A P&L figure that arrives as a wad, from the subgraph or from the close preview.
export function formatPnlWad(wad: bigint): string {
  return formatWad(wad, {min: 2, max: 4, sign: true});
}

/// A return as a percentage, from a signed numerator and a positive denominator at the same scale.
/// Returns null when there is nothing to divide by — which is not the same as zero, and the
/// interface has to show it differently.
export function formatReturnPercent(numerator: bigint, denominator: bigint): string | null {
  if (denominator === 0n) return null;
  // Carry four extra digits so a two-decimal percentage is rounded rather than truncated.
  const scaled = (numerator * 1_000_000n) / denominator;
  return `${formatFixed(scaled, 4, {min: 2, max: 2, sign: true, grouping: false})}%`;
}

export function formatBps(bps: number | bigint): string {
  return `${formatFixed(BigInt(bps), 2, {min: 2, max: 2, grouping: false})}%`;
}

/// Parses what a person typed into USDC base units. Returns null for anything that is not a
/// non-negative decimal, including the empty string, so a caller cannot mistake bad input for 0.
export function parseUsdc6(input: string): bigint | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  // More precision than USDC holds is a typo, not an amount. Refuse it rather than truncate.
  if (fraction.length > USDC_DECIMALS) return null;
  return (
    BigInt(whole || "0") * 10n ** BigInt(USDC_DECIMALS) +
    BigInt(fraction.padEnd(USDC_DECIMALS, "0") || "0")
  );
}

/// A ratio as a percentage, for a progress bar or a utilization figure.
///
/// This is the one sanctioned place a money-shaped bigint becomes a JavaScript number, and it is
/// safe because the division happens first: what crosses over is a percentage in the low hundreds,
/// not a uint256. Returns null when there is nothing to divide by — a pool with no assets has no
/// utilization, which is not the same as being 0% utilized.
export function percentOf(numerator: bigint, denominator: bigint): number | null {
  if (denominator === 0n) return null;
  // Two extra digits so the result keeps a hundredth of a percent.
  // eslint-disable-next-line no-restricted-globals
  return Number((numerator * 10_000n) / denominator) / 100;
}

/// Parses a decimal string from the subgraph — a BigDecimal such as a share price — into a number
/// for plotting. Safe in a way a token amount is not: these are ratios near 1, and a chart is
/// pixels, not settlement. Never use this on an amount.
/* eslint-disable no-restricted-globals -- parsing a ratio for plotting, not an amount */
export function decimalForChart(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
/* eslint-enable no-restricted-globals */

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Ages are shown as ages, because the figures they qualify come from a block or an indexer and
/// "now" would be a claim neither can support.
export function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
