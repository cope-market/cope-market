"use client";

import {useCallback, useEffect} from "react";
import {useAssets} from "@/lib/api/assets";
import {useSession} from "@/lib/auth/session";
import {useProtocolParams} from "@/lib/chain/hooks";
import type {LivePosition} from "@/lib/chain/position";
import {explorerTxUrl} from "@/lib/chain/arc";
import {useTrade} from "@/lib/trade/send";
import {isBusy} from "@/lib/trade/stages";
import {formatBps, formatPrice, formatUsdc6} from "@/lib/format";
import {PnlBadge} from "./PnlBadge";
import {QuoteCountdown} from "./QuoteCountdown";
import {Sheet} from "./Sheet";
import {Button, Card, Row} from "./ui";

/// Closing a position.
///
/// The estimate shown before the intent arrives is computed by `lib/trade/pnl.ts`, which mirrors
/// `SyntheticVault._quoteClose` exactly, so it agrees with what the contract will settle. The
/// server's intent still supersedes it — the price moves between the two.
///
/// Two outcomes are not failures and the copy says so: a market that has closed cannot be exited
/// until it reopens, and a pool that cannot fund a winning payout leaves the position open to be
/// closed later.

export function ClosePositionSheet({
  live,
  open,
  onDone,
}: {
  live: LivePosition | null;
  open: boolean;
  onDone: () => void;
}) {
  const {symbolFor} = useAssets();
  const {address} = useSession();
  const {data: params} = useProtocolParams();
  const {progress, reset, requestCloseIntent, signAndConfirm} = useTrade();

  const tokenId = live?.position.tokenId;

  useEffect(() => {
    if (open && tokenId !== undefined && progress.stage === "idle") {
      void requestCloseIntent(tokenId);
    }
  }, [open, tokenId, progress.stage, requestCloseIntent]);

  const busy = isBusy(progress.stage);

  const dismiss = useCallback(() => {
    if (busy) return;
    reset();
    onDone();
  }, [busy, reset, onDone]);

  if (!live) return null;

  const {position, market, quote} = live;
  const symbol = symbolFor(position.feedId);
  const intent = progress.intent;

  return (
    <Sheet open={open} onClose={dismiss} dismissible={!busy} title={`Close ${symbol}`}>
      <div className="pb-5">
        {progress.stage === "done" ? (
          <div className="text-center">
            <p className="text-[1rem] font-semibold">Position closed</p>
            {progress.txHash ? (
              <a
                href={explorerTxUrl(progress.txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[0.8125rem] font-medium text-accent"
              >
                View on Arcscan →
              </a>
            ) : null}
            <Button onClick={dismiss} tone="quiet" className="mt-5 w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[0.75rem] text-dim">
                    #{String(position.tokenId)} · {position.isLong ? "Long" : "Short"}
                  </p>
                  <p className="num mt-0.5 text-[0.875rem]">
                    {formatUsdc6(position.collateral)} USDC at risk
                  </p>
                </div>
                {quote ? (
                  <PnlBadge netUsdc6={quote.netUsdc6} collateral={position.collateral} />
                ) : null}
              </div>

              <dl className="mt-3 space-y-0.5 border-t border-line pt-3">
                <Row label="Entry" value={formatPrice(position.entryPrice)} />
                <Row
                  label="Exit"
                  value={
                    intent
                      ? formatPrice(BigInt(intent.quote.entryPrice))
                      : market
                        ? formatPrice(
                            market.mark.price -
                              (position.isLong ? market.mark.conf : -market.mark.conf),
                          )
                        : "—"
                  }
                  hint={intent ? "quoted" : "estimate"}
                />
                {market ? (
                  <Row
                    label={`Close fee (${formatBps(market.config.closeFeeBps)})`}
                    value={
                      quote
                        ? `${formatUsdc6(quote.closeFeeWad / 10n ** 12n, {min: 2, max: 6})} USDC`
                        : "—"
                    }
                    hint="of exit notional"
                  />
                ) : null}
                {quote && quote.authorFee > 0n ? (
                  <Row
                    label="To the author"
                    value={`${formatUsdc6(quote.authorFee, {min: 2, max: 6})} USDC`}
                    hint={
                      params ? `${formatBps(params.authorFeeBps)} of the profit` : "of the profit"
                    }
                  />
                ) : null}
                <Row
                  label="You receive"
                  value={quote ? `${formatUsdc6(quote.payout)} USDC` : "—"}
                />
              </dl>

              {intent ? (
                <div className="mt-3 border-t border-line pt-3">
                  <QuoteCountdown expiresAt={intent.expiresAt} onExpire={reset} />
                </div>
              ) : null}
            </Card>

            {progress.error ? (
              <Card className="mt-3 p-3.5">
                <p className="text-[0.875rem] font-medium text-short">{progress.error.title}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                  {progress.error.detail}
                </p>
              </Card>
            ) : null}

            <div className="mt-4 space-y-2">
              <Button
                onClick={() => intent && void signAndConfirm(intent, address)}
                disabled={busy || !intent}
                className="w-full"
              >
                {progress.stage === "quoting"
                  ? "Getting a quote…"
                  : progress.stage === "awaiting-signature" && progress.txHash === null && busy
                    ? "Waiting for your signature…"
                    : progress.stage === "confirming"
                      ? "Confirming on-chain…"
                      : "Sign and close"}
              </Button>
              <Button onClick={dismiss} disabled={busy} tone="quiet" className="w-full">
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
