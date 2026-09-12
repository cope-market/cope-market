import {Pill} from "./ui";
import type {Market} from "@/lib/chain/market";
import {formatAge} from "@/lib/format";

/// A market's tradeability, said plainly. A closed FX market at the weekend is the protocol
/// working, not failing, and the badge has to read that way.

export function MarketBadge({market}: {market: Market}) {
  if (market.status === "open") {
    return (
      <Pill tone="long">
        <span className="inline-block size-1.5 rounded-full bg-long" />
        Live
      </Pill>
    );
  }

  if (market.status === "disabled") return <Pill tone="warn">Paused</Pill>;
  if (market.status === "no-price") return <Pill tone="neutral">No price</Pill>;

  return (
    <Pill tone="neutral">
      Closed{market.ageSeconds === null ? "" : ` · ${formatAge(market.ageSeconds)}`}
    </Pill>
  );
}
