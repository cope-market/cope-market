"use client";

import {use} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {useAssets} from "@/lib/api/assets";
import {positionByTokenId} from "@/lib/graph/cope";
import {useLivePnl} from "@/lib/chain/thesis-pnl";
import {PnlBadge} from "@/components/PnlBadge";
import {AsOf, Card, Empty, ErrorState, Pill, Row, Screen, Skeleton} from "@/components/ui";
import {explorerAddressUrl} from "@/lib/chain/arc";
import {formatPnlWad, formatPrice, formatUsdc6, shortAddress} from "@/lib/format";

/// A position looked up by its token id.
///
/// Copy lineage is recorded on-chain as a token id, not as a thesis, so a copied position can
/// point at an origin that was opened directly against the contract and has no thesis at all. This
/// is where that link lands.
///
/// The position's own facts come from the subgraph, because a closed one no longer exists on the
/// contract to be read. Live P&L, for one still open, comes from the chain.

export default function PositionPage({params}: {params: Promise<{tokenId: string}>}) {
  const {tokenId} = use(params);
  const {symbolFor} = useAssets();

  const {data, isLoading, isError, refetch} = useQuery({
    queryKey: ["graph", "position", tokenId],
    queryFn: () => positionByTokenId(BigInt(tokenId)),
  });

  const live = useLivePnl(data?.status === "OPEN" ? tokenId : null);

  if (isLoading) {
    return (
      <Screen title={`Position #${tokenId}`}>
        <Skeleton className="h-48" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen title={`Position #${tokenId}`}>
        <ErrorState
          title="Cannot reach the subgraph"
          detail="A position's history is indexed rather than stored on the contract, so there is nothing to show without it."
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen title={`Position #${tokenId}`}>
        <Empty
          title="No such position"
          detail="Nothing with this token id has been indexed. It may never have existed."
        />
      </Screen>
    );
  }

  const closed = data.status !== "OPEN";

  return (
    <Screen title={symbolFor(data.asset.id)} subtitle={`Position #${tokenId}`}>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={data.isLong ? "long" : "short"}>{data.isLong ? "Long" : "Short"}</Pill>
            {data.status === "LIQUIDATED" ? (
              <Pill tone="warn">Liquidated</Pill>
            ) : data.status === "CLOSED" ? (
              <Pill>Closed</Pill>
            ) : (
              <Pill tone="long">Open</Pill>
            )}
            {data.copiedFrom ? <Pill tone="accent">Copy</Pill> : null}
          </div>

          <div className="text-right">
            {closed ? (
              <span
                className={`num text-[1rem] font-semibold ${
                  (data.realizedPnlWad ?? 0n) > 0n
                    ? "text-long"
                    : (data.realizedPnlWad ?? 0n) < 0n
                      ? "text-short"
                      : "text-muted"
                }`}
              >
                {formatPnlWad(data.realizedPnlWad ?? 0n)}
              </span>
            ) : live.quote ? (
              <PnlBadge netUsdc6={live.quote.netUsdc6} collateral={data.collateral} />
            ) : (
              <Skeleton className="h-5 w-16" />
            )}
            <p className="text-[0.6875rem] text-dim">
              {closed ? "realised" : "live, from the contract"}
            </p>
          </div>
        </div>

        <dl className="mt-3 space-y-0.5 border-t border-line pt-3">
          <Row label="Collateral" value={`${formatUsdc6(data.collateral)} USDC`} />
          <Row label="Entry" value={formatPrice(data.entryPrice)} />
          {data.exitPrice !== null ? (
            <Row label="Exit" value={formatPrice(data.exitPrice)} />
          ) : live.market ? (
            <Row label="Mark" value={formatPrice(live.market.mark.price)} />
          ) : null}
          {data.payout !== null ? (
            <Row label="Paid out" value={`${formatUsdc6(data.payout)} USDC`} />
          ) : null}
          {data.authorFeePaid !== null && data.authorFeePaid > 0n ? (
            <Row
              label="Author's cut"
              value={`${formatUsdc6(data.authorFeePaid, {min: 2, max: 6})} USDC`}
            />
          ) : null}
          {data.liquidationReward !== null && data.liquidationReward > 0n ? (
            <Row
              label="Liquidator's cut"
              value={`${formatUsdc6(data.liquidationReward, {min: 2, max: 6})} USDC`}
            />
          ) : null}
        </dl>
      </Card>

      <Card className="mt-3 p-4">
        <h2 className="text-[0.875rem] font-semibold">Who</h2>
        <dl className="mt-2 space-y-0.5">
          <Row
            label="Author"
            value={
              <a
                href={explorerAddressUrl(data.author.id)}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                {shortAddress(data.author.id)}
              </a>
            }
            hint="opened it"
          />
          {data.owner.id.toLowerCase() !== data.author.id.toLowerCase() ? (
            <Row label="Owner" value={shortAddress(data.owner.id)} hint="holds it now" />
          ) : null}
          {data.status === "LIQUIDATED" && data.closedBy ? (
            <Row label="Liquidated by" value={shortAddress(data.closedBy)} />
          ) : null}
        </dl>
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
          A position is an NFT and can be sold. The payout follows whoever holds it; the author fee
          does not, and results are attributed to the author, who never changes.
        </p>
      </Card>

      {data.copiedFrom ? (
        <p className="mt-3 text-[0.8125rem] text-muted">
          Copied from{" "}
          <Link href={`/p/token/${data.copiedFrom.tokenId}`} className="text-accent">
            #{String(data.copiedFrom.tokenId)}
          </Link>{" "}
          by {shortAddress(data.copiedFrom.author.id)}.
        </p>
      ) : null}

      {data.copyCount > 0 ? (
        <p className="mt-2 text-[0.8125rem] text-muted">
          Copied {data.copyCount} {data.copyCount === 1 ? "time" : "times"}.
        </p>
      ) : null}

      <AsOf>
        Position history comes from the subgraph, as of its last indexed block.
        {closed ? "" : " The live figure above is read from the contract."}
      </AsOf>
    </Screen>
  );
}
