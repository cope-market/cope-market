"use client";

import {useCallback, useMemo, useState} from "react";
import Link from "next/link";
import {useApi} from "@/lib/api/provider";
import {useAssets} from "@/lib/api/assets";
import {useSession} from "@/lib/auth/session";
import {useMarket, useProtocolParams, useWallet} from "@/lib/chain/hooks";
import {explorerTxUrl} from "@/lib/chain/arc";
import {confidenceBps, quoteOpen} from "@/lib/trade/quote";
import {notionalUsd} from "@/lib/trade/quote";
import {useTrade} from "@/lib/trade/send";
import {formatBps, formatPrice, formatUsdc6, formatWad, parseUsdc6} from "@/lib/format";
import {AmountInput} from "./AmountInput";
import {QuoteCountdown} from "./QuoteCountdown";
import {Sheet} from "./Sheet";
import {Button, Card, Pill, Row} from "./ui";

/// Opening a position.
///
/// The preview while the user types is computed with the same arithmetic the server quotes with —
/// `lib/trade/quote.ts` is vendored from the backend precisely so these cannot disagree. It is
/// still labelled an estimate, because the price it is computed against is a few seconds old and
/// the server's intent is the number that settles.

export interface TradeSheetProps {
  open: boolean;
  onClose: () => void;
  feedId: string;
  isLong: boolean;
  onSideChange?: (isLong: boolean) => void;
  /// Attaches the position to a thesis that has already been written.
  thesisId?: string | null;
  /// The origin position when this is a copy. The contract pays its author a share of any profit.
  copiedFromTokenId?: string | null;
  /// The origin thesis, when the copy is made from one.
  ///
  /// Copying is two separate acts and both have to happen: `copiedFromTokenId` carries the on-chain
  /// attribution that pays the author, and this carries the social lineage. Without it the copy
  /// never appears in the copier's feed or profile and the copy graph has a hole in it, which is
  /// the thing the whole feature exists to show.
  copyOf?: {
    thesisId: string;
    title: string;
    stance: "bullish" | "bearish";
    tweetUrl: string | null;
  } | null;
  /// The origin's entry price, shown against the current one. A copy fills at the current price,
  /// and presenting it as an identical fill would be a lie.
  copiedFromEntryPrice?: bigint | null;
}

export function TradeSheet(props: TradeSheetProps) {
  const {open, onClose, feedId, isLong, onSideChange} = props;
  const {symbolFor} = useAssets();
  const {address, authenticated} = useSession();
  const {data: market} = useMarket(feedId);
  const wallet = useWallet(address);
  const api = useApi();
  const {data: params} = useProtocolParams();
  const {progress, reset, requestIntent, signAndConfirm} = useTrade();
  const [postingCopy, setPostingCopy] = useState(false);

  const [amount, setAmount] = useState("");
  const collateral = parseUsdc6(amount);

  const preview = useMemo(() => {
    if (!market || collateral === null || collateral === 0n) return null;
    try {
      return quoteOpen({
        price: market.mark.price,
        conf: market.mark.conf,
        collateral,
        openFeeBps: market.config.openFeeBps,
        isLong,
      });
    } catch {
      // Confidence wider than the price itself. The contract would reject it too.
      return null;
    }
  }, [market, collateral, isLong]);

  const overCap =
    preview !== null && market
      ? notionalUsd(preview.netCollateral) > market.config.maxPositionUsd
      : false;
  const confTooWide = market
    ? confidenceBps(market.mark.price, market.mark.conf) > BigInt(market.config.maxConfBps)
    : false;

  const busy = ["approving", "quoting", "awaiting-signature", "confirming"].includes(
    progress.stage,
  );

  const close = useCallback(() => {
    if (busy) return;
    reset();
    setAmount("");
    onClose();
  }, [busy, reset, onClose]);

  const symbol = symbolFor(feedId);

  return (
    <Sheet open={open} onClose={close} dismissible={!busy} title={symbol}>
      {progress.stage === "done" ? (
        <Result progress={progress} onClose={close} />
      ) : progress.intent && progress.stage !== "failed" ? (
        <Confirm
          intent={progress.intent}
          symbol={symbol}
          busy={busy}
          stage={progress.stage}
          onSign={() => void signAndConfirm(progress.intent!, address)}
          onExpire={reset}
          onBack={reset}
        />
      ) : (
        <Compose
          {...props}
          symbol={symbol}
          market={market}
          amount={amount}
          setAmount={setAmount}
          collateral={collateral}
          preview={preview}
          overCap={overCap}
          confTooWide={confTooWide}
          balance={wallet.data?.usdc}
          authorFeeBps={params?.authorFeeBps ?? null}
          authenticated={authenticated}
          error={progress.error}
          busy={busy || postingCopy}
          onSubmit={() => {
            if (collateral === null) return;
            void (async () => {
              // The lineage thesis is written here rather than when the sheet opens, so backing
              // out does not leave a post with no position behind it.
              let thesisId = props.thesisId ?? null;
              if (props.copyOf) {
                setPostingCopy(true);
                try {
                  const {thesis} = await api.createThesis({
                    body: {
                      feedId,
                      stance: props.copyOf.stance,
                      title: `Copying: ${props.copyOf.title}`,
                      body: "",
                      tweetUrl: props.copyOf.tweetUrl,
                      copiedFromThesisId: props.copyOf.thesisId,
                    },
                  });
                  thesisId = thesis.id;
                } catch {
                  // The trade is still worth making, and the contract still pays the author. Only
                  // the social half is lost, so it is not worth blocking on.
                } finally {
                  setPostingCopy(false);
                }
              }

              await requestIntent({
                feedId,
                isLong,
                collateral,
                thesisId,
                copiedFromTokenId: props.copiedFromTokenId ?? null,
              });
            })();
          }}
          onSideChange={onSideChange}
        />
      )}
    </Sheet>
  );
}

type Market = ReturnType<typeof useMarket>["data"];
type Preview = ReturnType<typeof quoteOpen> | null;

function Compose({
  symbol,
  market,
  isLong,
  onSideChange,
  amount,
  setAmount,
  collateral,
  preview,
  overCap,
  confTooWide,
  balance,
  authorFeeBps,
  authenticated,
  error,
  busy,
  onSubmit,
  copiedFromTokenId,
  copiedFromEntryPrice,
  copyOf,
}: TradeSheetProps & {
  symbol: string;
  market: Market;
  amount: string;
  setAmount: (next: string) => void;
  collateral: bigint | null;
  preview: Preview;
  overCap: boolean;
  confTooWide: boolean;
  balance: bigint | undefined;
  /// From the chain. Null until it has been read; the copy says "a share" until then rather than
  /// naming a number it has not confirmed.
  authorFeeBps: number | null;
  authenticated: boolean;
  error: {title: string; detail: string} | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  const tradeable = market?.market.tradeable ?? false;
  const enough =
    collateral !== null && collateral > 0n && (balance === undefined || collateral <= balance);
  const canSubmit =
    authenticated && tradeable && enough && !overCap && !confTooWide && !busy && preview !== null;

  return (
    <div className="pb-5">
      {onSideChange ? (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-raised p-1">
          {[true, false].map((side) => (
            <button
              key={String(side)}
              onClick={() => onSideChange(side)}
              className={`h-9 rounded-lg text-[0.875rem] font-semibold transition ${
                isLong === side
                  ? side
                    ? "bg-long-soft text-long"
                    : "bg-short-soft text-short"
                  : "text-muted hover:text-ink"
              }`}
            >
              {side ? "Long" : "Short"}
            </button>
          ))}
        </div>
      ) : null}

      {!tradeable && market ? (
        <Card className="mb-4 p-3.5">
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {market.market.reason} The contract rejects a trade on a stale price, so this is refused
            before you sign rather than after.
          </p>
        </Card>
      ) : null}

      {confTooWide && market ? (
        <Card className="mb-4 p-3.5">
          <p className="text-[0.8125rem] leading-relaxed text-warn">
            The oracle&apos;s confidence interval is wider than this market allows (
            {formatBps(confidenceBps(market.mark.price, market.mark.conf))} against a{" "}
            {formatBps(market.config.maxConfBps)} limit). The contract would reject the trade.
          </p>
        </Card>
      ) : null}

      <AmountInput value={amount} onChange={setAmount} balance={balance} disabled={!tradeable} />

      {copiedFromTokenId ? (
        <Card className="mt-4 p-3.5">
          <div className="flex items-center justify-between">
            <Pill tone="accent">Copying #{copiedFromTokenId}</Pill>
          </div>
          <dl className="mt-2.5 space-y-0.5">
            {copiedFromEntryPrice ? (
              <Row label="Their entry" value={formatPrice(copiedFromEntryPrice)} />
            ) : null}
            <Row label="Your entry" value={preview ? formatPrice(preview.entryPrice) : "—"} />
          </dl>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-dim">
            A copy opens at the current price, not at theirs.{" "}
            {authorFeeBps === null
              ? "A share of any profit goes"
              : `${formatBps(authorFeeBps)} of any profit goes`}{" "}
            to the author when you close; a loss costs them nothing.
            {copyOf ? " This also posts to your feed, crediting the thesis you copied." : ""}
          </p>
        </Card>
      ) : null}

      {preview && market ? (
        <div className="mt-4 space-y-0.5 border-t border-line pt-3">
          <Row label="Mark" value={formatPrice(market.mark.price)} />
          <Row
            label="Your entry"
            value={formatPrice(preview.entryPrice)}
            hint={isLong ? "above mid" : "below mid"}
          />
          <Row
            label={`Open fee (${formatBps(market.config.openFeeBps)})`}
            value={`${formatUsdc6(preview.openFee, {min: 2, max: 6})} USDC`}
          />
          <Row label="Collateral at risk" value={`${formatUsdc6(preview.netCollateral)} USDC`} />
          <Row label="Units" value={formatWad(preview.units, {min: 2, max: 8})} />
          <p className="pt-1.5 text-[0.6875rem] leading-relaxed text-dim">
            The entry price is the mark moved against you by the oracle&apos;s confidence interval.
            That is how the protocol absorbs the time between the price and the block, and it is
            what you will actually fill at. This preview uses a price a few seconds old; the quote
            you sign comes from the server.
          </p>
        </div>
      ) : null}

      {overCap && market ? (
        <p className="mt-3 text-[0.75rem] text-short">
          Above the per-position cap of {formatWad(market.config.maxPositionUsd, {min: 0, max: 0})}{" "}
          USD.
        </p>
      ) : null}

      {error ? (
        <Card className="mt-4 p-3.5">
          <p className="text-[0.875rem] font-medium text-short">{error.title}</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{error.detail}</p>
        </Card>
      ) : null}

      <div className="mt-5">
        {authenticated ? (
          <Button
            onClick={onSubmit}
            disabled={!canSubmit}
            tone={isLong ? "long" : "short"}
            className="w-full"
          >
            {busy ? "Getting a quote…" : `${isLong ? "Long" : "Short"} ${symbol}`}
          </Button>
        ) : (
          <Link href="/login" className="block">
            <Button className="w-full">Sign in to trade</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Confirm({
  intent,
  symbol,
  busy,
  stage,
  onSign,
  onExpire,
  onBack,
}: {
  intent: NonNullable<ReturnType<typeof useTrade>["progress"]["intent"]>;
  symbol: string;
  busy: boolean;
  stage: string;
  onSign: () => void;
  onExpire: () => void;
  onBack: () => void;
}) {
  const {quote} = intent;
  const closing = intent.action === "close";

  const label = {
    approving: "Approving USDC…",
    "awaiting-signature": "Waiting for your signature…",
    confirming: "Confirming on-chain…",
  }[stage];

  return (
    <div className="pb-5">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.9375rem] font-semibold">
            {closing ? "Close" : quote.isLong ? "Long" : "Short"} {symbol}
          </span>
          <QuoteCountdown expiresAt={intent.expiresAt} onExpire={onExpire} />
        </div>

        <dl className="mt-3 space-y-0.5 border-t border-line pt-3">
          <Row label="Mark" value={formatPrice(BigInt(quote.markPrice))} />
          <Row
            label={closing ? "Exit price" : "Entry price"}
            value={formatPrice(BigInt(quote.entryPrice))}
            hint="quoted"
          />
          <Row label="You pay" value={`${formatUsdc6(BigInt(quote.collateral))} USDC`} />
          <Row
            label={`Fee (${formatBps(quote.openFeeBps)})`}
            value={`${formatUsdc6(BigInt(quote.openFee), {min: 2, max: 6})} USDC`}
          />
          <Row label="Units" value={formatWad(BigInt(quote.units), {min: 2, max: 8})} />
        </dl>
      </Card>

      <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
        This is the server&apos;s quote and the transaction it built. Signing sends it; the server
        then reads the receipt off the chain and attaches the position.
      </p>

      <div className="mt-4 space-y-2">
        <Button onClick={onSign} disabled={busy} className="w-full">
          {busy ? (label ?? "Working…") : "Sign and send"}
        </Button>
        <Button onClick={onBack} disabled={busy} tone="quiet" className="w-full">
          Back
        </Button>
      </div>
    </div>
  );
}

function Result({
  progress,
  onClose,
}: {
  progress: ReturnType<typeof useTrade>["progress"];
  onClose: () => void;
}) {
  return (
    <div className="pb-5 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-long-soft">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#29d391"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <p className="mt-3 text-[1rem] font-semibold">
        {progress.intent?.action === "close" ? "Position closed" : "Position opened"}
      </p>
      {progress.tokenId ? (
        <p className="num mt-1 text-[0.8125rem] text-muted">#{progress.tokenId}</p>
      ) : null}

      {progress.txHash ? (
        <a
          href={explorerTxUrl(progress.txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-[0.8125rem] font-medium text-accent"
        >
          View on Arcscan →
        </a>
      ) : null}

      <Button onClick={onClose} tone="quiet" className="mt-5 w-full">
        Done
      </Button>
    </div>
  );
}
