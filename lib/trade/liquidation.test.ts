import {describe, expect, it} from "vitest";
import {
  isLiquidatable,
  liquidationExitPrice,
  liquidationProgress,
  liquidatorReward,
  thresholdWad,
} from "./liquidation";
import {quoteClose} from "./pnl";

// The live parameters on Arc testnet, read from the vault.
const THRESHOLD_BPS = 9000;
const REWARD_BPS = 100;

const WAD = 10n ** 18n;

describe("the liquidation threshold", () => {
  it("is a share of collateral in wad, matching Wad.toWad(collateral) * bps / BPS", () => {
    // 100 USDC of collateral, 90% threshold: liquidatable once 90 USD is lost.
    expect(thresholdWad(100_000_000n, THRESHOLD_BPS)).toBe(90n * WAD);
  });

  it("measures the raw P&L, not the payout — the close fee does not count toward it", () => {
    const position = {
      isLong: false,
      units: WAD,
      entryPrice: 100n * WAD,
      collateral: 100_000_000n,
      closeFeeBps: 10,
    };
    // A short at 100 with the price at 190: the loss is exactly 90, the threshold.
    const quote = quoteClose(position, 190n * WAD);
    expect(quote.pnlWad).toBe(-90n * WAD);
    expect(isLiquidatable(quote.pnlWad, position.collateral, THRESHOLD_BPS)).toBe(true);

    // The payout is smaller still once the close fee comes out, but that is not what the contract
    // compares against, and using it here would liquidate positions early.
    expect(quote.payout).toBeLessThan(10_000_000n);
  });

  it("is not reached one wei short of it", () => {
    expect(isLiquidatable(-(90n * WAD) + 1n, 100_000_000n, THRESHOLD_BPS)).toBe(false);
    expect(isLiquidatable(-(90n * WAD), 100_000_000n, THRESHOLD_BPS)).toBe(true);
  });
});

describe("liquidationExitPrice", () => {
  const base = {
    units: WAD,
    entryPrice: 100n * WAD,
    collateral: 100_000_000n,
    thresholdBps: THRESHOLD_BPS,
  };

  it("is the price at which a short has lost the threshold", () => {
    const price = liquidationExitPrice({...base, isLong: false});
    expect(price).toBe(190n * WAD);

    // Confirm against the settlement maths rather than trusting the algebra.
    const quote = quoteClose({...base, isLong: false, closeFeeBps: 10}, price as bigint);
    expect(isLiquidatable(quote.pnlWad, base.collateral, THRESHOLD_BPS)).toBe(true);
  });

  it("is the price at which a long has lost the threshold", () => {
    const price = liquidationExitPrice({...base, isLong: true});
    expect(price).toBe(10n * WAD);
  });

  it("is null for a long that cannot reach it before the price turns negative", () => {
    // Units bought far below the threshold move: the price would have to go below zero.
    expect(liquidationExitPrice({...base, isLong: true, units: WAD / 2n})).toBeNull();
  });

  it("is null for a position with no units", () => {
    expect(liquidationExitPrice({...base, isLong: true, units: 0n})).toBeNull();
  });
});

describe("liquidationProgress", () => {
  const collateral = 100_000_000n;

  it("is zero while the position is in profit", () => {
    expect(liquidationProgress(5n * WAD, collateral, THRESHOLD_BPS)).toBe(0);
    expect(liquidationProgress(0n, collateral, THRESHOLD_BPS)).toBe(0);
  });

  it("is the fraction of the threshold lost so far", () => {
    expect(liquidationProgress(-45n * WAD, collateral, THRESHOLD_BPS)).toBeCloseTo(0.5, 4);
    expect(liquidationProgress(-9n * WAD, collateral, THRESHOLD_BPS)).toBeCloseTo(0.1, 4);
  });

  it("caps at one rather than running past it", () => {
    expect(liquidationProgress(-500n * WAD, collateral, THRESHOLD_BPS)).toBe(1);
  });
});

describe("liquidatorReward", () => {
  it("is a share of the whole collateral, not of the loss", () => {
    expect(liquidatorReward(100_000_000n, REWARD_BPS)).toBe(1_000_000n);
    // The live position size in this demo: 2 USDC of collateral pays 0.02.
    expect(liquidatorReward(1_998_000n, REWARD_BPS)).toBe(19_980n);
  });
});
