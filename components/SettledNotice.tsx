"use client";

import {useAssets} from "@/lib/api/assets";
import type {IndexedPosition} from "@/lib/graph/cope";
import {formatUsdc6} from "@/lib/format";
import {Card, Pill} from "./ui";

/// Positions the contract no longer has, which the indexer has not caught up with yet.
///
/// This exists because a position can now be closed by someone other than its owner: a keeper
/// watches for underwater positions and calls `liquidate`. Without this the card would simply
/// disappear on the next poll, which is an alarming way to learn that something happened to your
/// money.
///
/// It does not claim to know which it was. The contract only tells us the token is gone; whether
/// it was closed or liquidated comes from the indexer, a moment later, on the profile.

export function SettledNotice({positions}: {positions: readonly IndexedPosition[]}) {
  const {symbolFor} = useAssets();
  if (positions.length === 0) return null;

  return (
    <Card className="mb-2 p-3.5">
      <div className="flex items-center gap-2">
        <Pill tone="warn">Just settled</Pill>
      </div>
      <ul className="mt-2 space-y-1">
        {positions.map((position) => (
          <li key={String(position.tokenId)} className="num text-[0.8125rem] text-ink">
            #{String(position.tokenId)} {symbolFor(position.asset.id)} ·{" "}
            {formatUsdc6(position.collateral)} USDC
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted">
        {positions.length === 1 ? "This is" : "These are"} no longer open — closed, or liquidated by
        a keeper. The result appears under Closed once the indexer catches up, in a block or two.
      </p>
    </Card>
  );
}
