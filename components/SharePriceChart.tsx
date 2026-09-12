"use client";

import type {VaultSnapshot} from "@/lib/graph/vault";
import {carryForward} from "@/lib/graph/vault";
import {decimalForChart} from "@/lib/format";

/// Share price over time, drawn from the vault's daily snapshots.
///
/// Two honesties are built in. Snapshots exist only for days that had activity, so the series is
/// carried forward across gaps rather than plotted as a fall to zero — a quiet day is a day the
/// vault did not change, not a day it emptied. And a single snapshot is not a line: with one point
/// there is no return to report, and the chart says so instead of drawing a flat one that implies
/// a measured period of no change.

export function SharePriceChart({snapshots}: {snapshots: readonly VaultSnapshot[]}) {
  const series = carryForward(snapshots);

  if (series.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-line bg-raised px-6 text-center">
        <p className="text-[0.75rem] leading-relaxed text-dim">
          {series.length === 0
            ? "No snapshots yet."
            : "One snapshot so far, so there is no return to plot yet. That is n/a, not zero."}
        </p>
      </div>
    );
  }

  const prices = series.map((snapshot) => decimalForChart(snapshot.sharePrice));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const width = 320;
  const height = 96;
  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = prices[0] as number;
  const last = prices[prices.length - 1] as number;
  const rising = last >= first;
  const stroke = rising ? "var(--color-long)" : "var(--color-short)";

  return (
    <div className="rounded-xl border border-line bg-raised p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Share price over ${series.length} days, from ${first} to ${last}`}
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-dim">
        <span className="num">{first.toFixed(6)}</span>
        <span>{series.length} days</span>
        <span className="num">{last.toFixed(6)}</span>
      </div>
    </div>
  );
}
