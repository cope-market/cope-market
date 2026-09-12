"use client";

import Link from "next/link";
import {ASSET_CLASS_LABEL, useAssets} from "@/lib/api/assets";
import {useMarkets, useOpenInterest} from "@/lib/chain/hooks";
import {MarketBadge} from "@/components/MarketBadge";
import {AsOf, Card, ErrorState, Screen, Skeleton} from "@/components/ui";
import {formatPrice, formatWad} from "@/lib/format";

/// Every tradeable market, its last price, and whether it can be traded right now.
///
/// The list itself comes from `enabledFeeds()` rather than from a constant: the owner can enable
/// or disable an asset without a deploy, and a hard-coded list would show a market that is not
/// there or hide one that is.

export default function MarketsPage() {
  const {data, isLoading, isError, refetch} = useMarkets();
  const {data: openInterest} = useOpenInterest(data?.rows);
  const {lookup, symbolFor} = useAssets();

  const anyOpen = data?.rows.some((row) => row.market.tradeable) ?? false;

  return (
    <Screen
      title="Markets"
      subtitle={
        data && !anyOpen
          ? "Every market is closed. Prices resume when their sessions do."
          : "Synthetic exposure, priced by the oracle, settled against the pool."
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[4.5rem]" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title="Cannot reach the chain"
          detail="The Arc RPC did not answer. Markets, prices and positions all read from it directly."
          onRetry={() => void refetch()}
        />
      ) : null}

      <ul className="space-y-2">
        {data?.rows.map((row, index) => {
          const asset = lookup(row.feedId);
          const oi = openInterest?.[index];

          return (
            <li key={row.feedId}>
              <Link href={`/markets/${row.feedId}`} className="block">
                <Card className="px-4 py-3 transition hover:border-line-strong">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[0.9375rem] font-semibold">
                          {symbolFor(row.feedId)}
                        </span>
                        {asset ? (
                          <span className="shrink-0 text-[0.6875rem] text-dim">
                            {ASSET_CLASS_LABEL[asset.assetClass]}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.75rem] text-muted">
                        {asset?.name ?? "Unknown asset"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="num text-[1.0625rem] font-semibold tracking-tight">
                        {formatPrice(row.mark.price)}
                      </p>
                      <p className="num mt-0.5 text-[0.6875rem] text-dim">
                        ± {formatPrice(row.mark.conf)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <MarketBadge market={row.market} />
                    {oi && (oi.long > 0n || oi.short > 0n) ? (
                      <span className="num text-[0.6875rem] text-dim">
                        OI {formatWad(oi.long, {min: 0, max: 2})} long ·{" "}
                        {formatWad(oi.short, {min: 0, max: 2})} short
                      </span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {data ? (
        <AsOf>
          Prices and open interest read from the contracts at block time{" "}
          {String(data.blockTimestamp)}. A market is tradeable while its price is within the
          asset&apos;s staleness bound.
        </AsOf>
      ) : null}
    </Screen>
  );
}
