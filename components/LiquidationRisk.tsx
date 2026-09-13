"use client";

import {liquidationExitPrice, liquidationProgress} from "@/lib/trade/liquidation";
import type {LiquidationInput} from "@/lib/trade/liquidation";
import {formatPrice} from "@/lib/format";

/// How close a position is to being liquidated.
///
/// A keeper now watches for underwater positions and calls `liquidate`, so a position can close
/// without its owner acting. That makes this the difference between a user understanding what
/// happened and a position simply vanishing.
///
/// The bar is deliberately quiet until it matters. At 1x leverage a long has to fall by most of
/// its value to get here, so for most positions this is reassurance rather than a warning, and
/// something that shouts at 3% of the way to a threshold nobody will reach trains people to ignore
/// it.

export function LiquidationRisk({
  input,
  pnlWad,
}: {
  input: LiquidationInput;
  /// The raw signed P&L, which is what the contract compares against the threshold.
  pnlWad: bigint;
}) {
  const progress = liquidationProgress(pnlWad, input.collateral, input.thresholdBps);
  const price = liquidationExitPrice(input);

  if (price === null) {
    return (
      <p className="mt-3 border-t border-line pt-3 text-[0.6875rem] leading-relaxed text-dim">
        This position cannot be liquidated by price alone — it would have to fall below zero first.
      </p>
    );
  }

  const near = progress >= 0.6;
  const tone = progress >= 0.85 ? "bg-short" : near ? "bg-warn" : "bg-line-strong";

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-baseline justify-between text-[0.6875rem]">
        <span className={near ? "text-warn" : "text-dim"}>
          {near ? "Close to liquidation" : "Liquidation"}
        </span>
        <span className="num text-dim">
          at {formatPrice(price)} · {Math.round(progress * 100)}% of the way
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{width: `${Math.max(progress * 100, progress > 0 ? 2 : 0)}%`}}
        />
      </div>
      {near ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-warn">
          Once {input.thresholdBps / 100}% of the collateral is lost, anyone can close this position
          and take a share of what is left. Closing it yourself first avoids that.
        </p>
      ) : null}
    </div>
  );
}
