import {BPS, USDC_SCALE} from "../format";
import {WAD} from "./pnl";

/// How close a position is to being liquidated, and the price at which it would be.
///
/// Transcribed from `SyntheticVault.liquidate`, which is worth reading closely because two details
/// are easy to get wrong:
///
///   - the threshold is measured against the position's raw P&L, *not* against the payout. The
///     close fee is deducted from what the owner receives but does not count toward liquidation.
///   - the reward is a share of the whole collateral, not of the loss, and it comes out of the
///     payout the owner would otherwise have received.
///
/// At 1x leverage a long has to fall by most of its value before any of this applies. Liquidation
/// exists mainly for shorts, whose loss is unbounded.

export interface LiquidationInput {
  isLong: boolean;
  /// 1e18
  units: bigint;
  /// 1e18
  entryPrice: bigint;
  /// USDC base units
  collateral: bigint;
  /// `liquidationThresholdBps()` — 9000 on testnet, meaning 90% of collateral lost.
  thresholdBps: number;
}

/// The loss, in USD wad, at which the position becomes liquidatable.
export function thresholdWad(collateral: bigint, thresholdBps: number): bigint {
  return (collateral * USDC_SCALE * BigInt(thresholdBps)) / BPS;
}

/// The exit price at which the position becomes liquidatable, or null when there is nothing to
/// solve for. This is the exit price the contract computes — the mark moved against the trader by
/// the oracle's confidence — not the mark itself.
export function liquidationExitPrice(input: LiquidationInput): bigint | null {
  if (input.units === 0n) return null;

  const move = (thresholdWad(input.collateral, input.thresholdBps) * WAD) / input.units;
  const price = input.isLong ? input.entryPrice - move : input.entryPrice + move;

  // A long whose threshold move exceeds its entry price cannot reach liquidation by price alone:
  // the price would have to go negative first. Say so rather than showing a nonsense number.
  return price <= 0n ? null : price;
}

/// How far the position has travelled toward liquidation, from 0 to 1. A position in profit is 0.
///
/// `pnlWad` is the raw signed P&L, as `quoteClose` returns it.
export function liquidationProgress(
  pnlWad: bigint,
  collateral: bigint,
  thresholdBps: number,
): number {
  const threshold = thresholdWad(collateral, thresholdBps);
  if (threshold === 0n || pnlWad >= 0n) return 0;

  const loss = -pnlWad;
  if (loss >= threshold) return 1;
  // Basis points first, so the division happens while both sides are still bigints.
  // eslint-disable-next-line no-restricted-globals
  return Number((loss * 10_000n) / threshold) / 10_000;
}

export function isLiquidatable(pnlWad: bigint, collateral: bigint, thresholdBps: number): boolean {
  return pnlWad < 0n && -pnlWad >= thresholdWad(collateral, thresholdBps);
}

/// What the liquidator is paid, in USDC base units. Taken out of the owner's payout.
export function liquidatorReward(collateral: bigint, rewardBps: number): bigint {
  return (collateral * BigInt(rewardBps)) / BPS;
}
