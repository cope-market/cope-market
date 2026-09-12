import {BPS, USDC_SCALE, WAD_DECIMALS} from "../format";

/// Mirrors `SyntheticVault._quoteClose` and the settlement that follows it, to the wei.
///
/// This is what shows a user their live P&L and what a close will pay them, and it must agree with
/// the contract exactly. Every serious bug in a system like this lives in the gap between the
/// contract's arithmetic and the interface's, so the arithmetic here is transcribed from
/// `src/SyntheticVault.sol` rather than reconstructed from prose, and it is asserted against
/// figures read back off the deployed contract in pnl.test.ts.
///
/// Note for anyone comparing against ARCHITECTURE.md §2.5: that document says the close fee is
/// charged on `|pnl + notional|`. The deployed contract charges it on the exit notional. The
/// contract is what settles, so the contract is what this follows.

export const WAD = 10n ** BigInt(WAD_DECIMALS);
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/// The exit price the contract will use. Confidence moves against the trader on the way out just
/// as it did on the way in: a long exits below mid, a short above.
export function exitPrice(priceWad: bigint, confWad: bigint, isLong: boolean): bigint {
  return isLong ? priceWad - confWad : priceWad + confWad;
}

export interface ClosePositionInput {
  isLong: boolean;
  /// 1e18. Quantity of the synthetic asset.
  units: bigint;
  /// 1e18, already skewed against the trader at open.
  entryPrice: bigint;
  /// USDC base units, 6 decimals, net of the open fee.
  collateral: bigint;
  /// From `assetConfig(feedId)`.
  closeFeeBps: number;
  /// Zero address for an original position; an address means the copy pays its author on profit.
  copyAuthor?: string;
  /// Snapshotted on the position at open, not read live.
  authorFeeBps?: number;
}

export interface CloseQuote {
  /// 1e18, signed. The trader's mark-to-market before fees.
  pnlWad: bigint;
  /// 1e18. Charged on the exit notional.
  closeFeeWad: bigint;
  /// USDC base units. Paid to the position's author, only out of profit.
  authorFee: bigint;
  /// USDC base units. What the holder receives. Never negative.
  payout: bigint;
  /// USDC base units, signed. payout - collateral: what the position actually made or lost,
  /// which is the number a user means by "how am I doing".
  netUsdc6: bigint;
}

/// Prices a close at a given exit price. Pure, and the same function whether the close is
/// hypothetical (a position card's live P&L) or imminent (the confirmation in the close sheet).
export function quoteClose(input: ClosePositionInput, exit: bigint): CloseQuote {
  const exitNotionalWad = (input.units * exit) / WAD;
  const closeFeeWad = (exitNotionalWad * BigInt(input.closeFeeBps)) / BPS;

  const delta = input.isLong ? exit - input.entryPrice : input.entryPrice - exit;
  const pnlWad = (input.units * delta) / WAD;

  const grossWad = input.collateral * USDC_SCALE + pnlWad - closeFeeWad;
  // A trader can be wiped out but never owes more than their collateral. The shortfall is the
  // liquidity pool's risk, which is what liquidation exists to bound.
  let payout = grossWad > 0n ? grossWad / USDC_SCALE : 0n;

  // The author earns only when the copy earns. No profit, no fee.
  let authorFee = 0n;
  if (input.copyAuthor && input.copyAuthor !== ZERO_ADDRESS && pnlWad > 0n) {
    authorFee = (pnlWad * BigInt(input.authorFeeBps ?? 0)) / BPS / USDC_SCALE;
    // Unreachable under the current caps, and kept for the same reason the contract keeps it: a
    // future cap change must not be able to make a settlement negative.
    if (authorFee > payout) authorFee = payout;
    payout -= authorFee;
  }

  return {pnlWad, closeFeeWad, authorFee, payout, netUsdc6: payout - input.collateral};
}

/// Prices a close at the current oracle reading, deriving the exit price the way the contract will.
export function quoteCloseAtMark(
  input: ClosePositionInput,
  mark: {price: bigint; conf: bigint},
): CloseQuote {
  return quoteClose(input, exitPrice(mark.price, mark.conf, input.isLong));
}

/// The notional a position is carrying now, in USD wad. Used for sizing displays, not settlement.
export function currentNotionalWad(units: bigint, priceWad: bigint): bigint {
  return (units * priceWad) / WAD;
}
