"use client";

import {use, useState} from "react";
import Link from "next/link";
import {ASSET_CLASS_LABEL, useAssets} from "@/lib/api/assets";
import {useMarket, useOpenInterest, useMarkets} from "@/lib/chain/hooks";
import {MarketBadge} from "@/components/MarketBadge";
import {TradeSheet} from "@/components/lazy";
import {AsOf, Button, Card, ErrorState, Row, Screen, Skeleton} from "@/components/ui";
import {formatAge, formatBps, formatPrice, formatWad, percentOf} from "@/lib/format";

/// One market: its price, what it costs to trade, and how full each side is.
///
/// Every risk parameter here is read from `assetConfig` rather than assumed. The owner can change
/// a cap or disable an asset without a deploy, and a number baked into the interface would then be
/// a lie the user acts on.

export default function MarketPage({params}: {params: Promise<{feedId: string}>}) {
  const {feedId} = use(params);
  const {data: market, isLoading} = useMarket(feedId);
  const markets = useMarkets();
  const {data: openInterest} = useOpenInterest(markets.data?.rows);
  const {lookup, symbolFor} = useAssets();

  const [side, setSide] = useState<boolean | null>(null);
  const asset = lookup(feedId);
  const oi = openInterest?.find((row) => row.feedId.toLowerCase() === feedId.toLowerCase());

  if (isLoading) {
    return (
      <Screen title="Market">
        <Skeleton className="h-40" />
      </Screen>
    );
  }

  if (!market) {
    return (
      <Screen title="Market">
        <ErrorState
          title="Not a live market"
          detail="This feed is not in the vault's enabled list. The list comes from the contract and can change."
        />
        <p className="mt-3">
          <Link href="/markets" className="text-[0.8125rem] text-accent">
            ← All markets
          </Link>
        </p>
      </Screen>
    );
  }

  const oiPercent = (value: bigint) => percentOf(value, market.config.maxOiUsd) ?? 0;

  return (
    <Screen
      title={symbolFor(feedId)}
      subtitle={asset ? `${asset.name} · ${ASSET_CLASS_LABEL[asset.assetClass]}` : "Unknown asset"}
      action={<MarketBadge market={market.market} />}
    >
      <Card className="p-4">
        <p className="num text-[2.25rem] font-semibold leading-none tracking-tight">
          {formatPrice(market.mark.price)}
        </p>
        <p className="num mt-1.5 text-[0.75rem] text-dim">
          ± {formatPrice(market.mark.conf)} confidence · published{" "}
          {market.market.ageSeconds === null ? "never" : formatAge(market.market.ageSeconds)}
        </p>

        {market.market.reason ? (
          <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-muted">
            {market.market.reason}
          </p>
        ) : null}
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="long" onClick={() => setSide(true)} disabled={!market.market.tradeable}>
          Long
        </Button>
        <Button tone="short" onClick={() => setSide(false)} disabled={!market.market.tradeable}>
          Short
        </Button>
      </div>

      {oi ? (
        <Card className="mt-3 p-4">
          <h2 className="text-[0.875rem] font-semibold">Open interest</h2>
          <p className="mt-0.5 text-[0.6875rem] text-dim">
            Valued at average entry, so a cap does not tighten or loosen as the market moves.
          </p>

          <div className="mt-3 space-y-3">
            {(
              [
                {label: "Long", value: oi.long, tone: "bg-long"},
                {label: "Short", value: oi.short, tone: "bg-short"},
              ] as const
            ).map((sideRow) => (
              <div key={sideRow.label}>
                <div className="flex items-baseline justify-between text-[0.75rem]">
                  <span className="text-muted">{sideRow.label}</span>
                  <span className="num text-ink">
                    {formatWad(sideRow.value, {min: 0, max: 2})} of{" "}
                    {formatWad(market.config.maxOiUsd, {min: 0, max: 0})} USD
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div
                    className={`h-full rounded-full ${sideRow.tone}`}
                    style={{
                      width: `${Math.max(oiPercent(sideRow.value), sideRow.value > 0n ? 1 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="mt-3 p-4">
        <h2 className="text-[0.875rem] font-semibold">Risk parameters</h2>
        <dl className="mt-2 space-y-0.5">
          <Row label="Open fee" value={formatBps(market.config.openFeeBps)} hint="of collateral" />
          <Row
            label="Close fee"
            value={formatBps(market.config.closeFeeBps)}
            hint="of exit notional"
          />
          <Row
            label="Max position"
            value={`${formatWad(market.config.maxPositionUsd, {min: 0, max: 0})} USD`}
          />
          <Row label="Price must be newer than" value={`${market.config.maxAgeSec}s`} />
          <Row label="Max confidence" value={formatBps(market.config.maxConfBps)} hint="of price" />
        </dl>
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
          All of these are enforced by the contract, not by this screen. A control that only exists
          in a user interface is not a control.
        </p>
      </Card>

      <AsOf>
        Read from SyntheticVault and the oracle at block time{" "}
        {markets.data ? String(markets.data.blockTimestamp) : "—"}.
      </AsOf>

      <TradeSheet
        open={side !== null}
        onClose={() => setSide(null)}
        feedId={feedId}
        isLong={side ?? true}
        onSideChange={setSide}
      />
    </Screen>
  );
}
