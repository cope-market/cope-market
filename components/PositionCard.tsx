"use client";

import Link from "next/link";
import {useAssets} from "@/lib/api/assets";
import type {LivePosition} from "@/lib/chain/position";
import {formatBps, formatPrice, formatUsdc6, formatWad} from "@/lib/format";
import {Card, Pill} from "./ui";
import {PnlBadge} from "./PnlBadge";
import {LiquidationRisk} from "./LiquidationRisk";
import {useProtocolParams} from "@/lib/chain/hooks";

/// One open position, valued against the current mark.

export function PositionCard({
  live,
  onClose,
  closing,
}: {
  live: LivePosition;
  onClose?: (tokenId: bigint) => void;
  closing?: boolean;
}) {
  const {position, market, quote} = live;
  const {symbolFor} = useAssets();
  const {data: params} = useProtocolParams();
  const isCopy = position.copiedFromId > 0n;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.9375rem] font-semibold">{symbolFor(position.feedId)}</span>
            <Pill tone={position.isLong ? "long" : "short"}>
              {position.isLong ? "Long" : "Short"}
            </Pill>
            {isCopy ? <Pill tone="accent">Copy</Pill> : null}
          </div>
          <p className="num mt-1 text-[0.75rem] text-dim">
            #{String(position.tokenId)} · {formatUsdc6(position.collateral)} USDC at risk
          </p>
        </div>

        <div className="text-right">
          {quote ? (
            <PnlBadge netUsdc6={quote.netUsdc6} collateral={position.collateral} />
          ) : (
            <span className="text-[0.8125rem] text-dim">No price</span>
          )}
          <p className="num mt-0.5 text-[0.6875rem] text-dim">
            {quote ? `${formatUsdc6(quote.payout)} USDC on close` : "—"}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[0.75rem]">
        <div>
          <dt className="text-dim">Entry</dt>
          <dd className="num mt-0.5 text-ink">{formatPrice(position.entryPrice)}</dd>
        </div>
        <div>
          <dt className="text-dim">Mark</dt>
          <dd className="num mt-0.5 text-ink">{market ? formatPrice(market.mark.price) : "—"}</dd>
        </div>
        <div>
          <dt className="text-dim">Units</dt>
          <dd className="num mt-0.5 text-ink">{formatWad(position.units, {min: 2, max: 6})}</dd>
        </div>
      </dl>

      {quote && params ? (
        <LiquidationRisk
          input={{
            isLong: position.isLong,
            units: position.units,
            entryPrice: position.entryPrice,
            collateral: position.collateral,
            thresholdBps: params.liquidationThresholdBps,
          }}
          pnlWad={quote.pnlWad}
        />
      ) : null}

      {isCopy ? (
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
          Copied from{" "}
          <Link href={`/p/token/${position.copiedFromId}`} className="text-accent">
            #{String(position.copiedFromId)}
          </Link>
          . {params ? formatBps(params.authorFeeBps) : "A share"} of any profit goes to its author
          on close; a loss costs them nothing.
        </p>
      ) : null}

      {onClose ? (
        <div className="mt-3">
          <button
            onClick={() => onClose(position.tokenId)}
            disabled={closing || !market?.market.tradeable}
            className="h-10 w-full rounded-xl border border-line-strong bg-raised text-[0.875rem] font-semibold text-ink transition hover:bg-overlay disabled:opacity-40"
          >
            {closing
              ? "Closing…"
              : market?.market.tradeable
                ? "Close position"
                : "Market closed — cannot close yet"}
          </button>
          {market && !market.market.tradeable ? (
            <p className="mt-2 text-center text-[0.6875rem] text-dim">
              Closing needs a fresh price, the same as opening does. This reopens when the market
              does.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
