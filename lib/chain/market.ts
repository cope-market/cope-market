/// Whether an asset can be traded right now.
///
/// FX, metals and equities stop publishing when their market closes; crypto does not. When a feed
/// is stale the contract reverts `StalePrice` on both open and close, which is correct behaviour
/// rather than a fault, so the interface has to say "market closed" and refuse to build a trade
/// instead of letting the user sign something that cannot succeed.
///
/// Freshness is measured against the chain's clock, not the browser's. The price pusher stamps
/// publish times against block time, and a browser whose clock is a minute fast would otherwise
/// declare a live market closed.

export type MarketStatus = "open" | "closed" | "disabled" | "no-price";

export interface MarketInput {
  /// `assetConfig(feedId).enabled`
  enabled: boolean;
  /// `assetConfig(feedId).maxAgeSec`
  maxAgeSec: number;
  /// `PushOracle.lastPublishTime(feedId)`; 0 when the feed has never been written.
  lastPublishTime: bigint;
  /// The timestamp of the block the reads were made against.
  blockTimestamp: bigint;
}

export interface Market {
  status: MarketStatus;
  /// How stale the price is, in seconds. Null when there has never been one.
  ageSeconds: number | null;
  tradeable: boolean;
  /// What to tell the user. Null when the market is open and there is nothing to explain.
  reason: string | null;
}

export function marketStatus(input: MarketInput): Market {
  if (input.lastPublishTime === 0n) {
    return {
      status: "no-price",
      ageSeconds: null,
      tradeable: false,
      reason: "No price has been published for this market yet.",
    };
  }

  // Safe to leave bigint here: this is an age in seconds, bounded by how long a market has been
  // shut, and nothing downstream treats it as money. Every other conversion in this codebase is
  // the bug the rule exists to catch.
  // eslint-disable-next-line no-restricted-globals
  const age = Number(input.blockTimestamp - input.lastPublishTime);

  if (!input.enabled) {
    return {
      status: "disabled",
      ageSeconds: age,
      tradeable: false,
      // Closing is deliberately still possible: disabling an asset blocks new positions and never
      // traps an open one.
      reason: "This market is not open for new positions. Existing positions can still be closed.",
    };
  }

  if (age > input.maxAgeSec) {
    return {
      status: "closed",
      ageSeconds: age,
      tradeable: false,
      reason: "Market closed — prices have stopped publishing.",
    };
  }

  return {status: "open", ageSeconds: age, tradeable: true, reason: null};
}
