"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {useMutation} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {describeApiError} from "@/lib/api/errors";
import {ASSET_CLASS_LABEL, useAssets} from "@/lib/api/assets";
import {useMarkets} from "@/lib/chain/hooks";
import {AuthGate} from "@/components/AuthGate";
import {MarketBadge} from "@/components/MarketBadge";
import {TradeSheet} from "@/components/lazy";
import {TweetEmbed} from "@/components/TweetEmbed";
import {Button, Card, Screen} from "@/components/ui";
import {formatPrice} from "@/lib/format";

/// Writing a thesis, then backing it.
///
/// The order is not a preference, it is what the API requires: a thesis is created with a null
/// `tokenId`, and the position attaches to it when the backing trade confirms. That also makes the
/// honest thing the easy thing — the argument is written before the trade, not retrofitted to it.

export default function NewThesisPage() {
  return (
    <AuthGate>
      <Compose />
    </AuthGate>
  );
}

function Compose() {
  const api = useApi();
  const router = useRouter();
  const {assets} = useAssets();
  const markets = useMarkets();

  const [tweetUrl, setTweetUrl] = useState("");
  const [feedId, setFeedId] = useState<string | null>(null);
  const [stance, setStance] = useState<"bullish" | "bearish">("bullish");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [thesisId, setThesisId] = useState<string | null>(null);

  const resolve = useMutation({
    mutationFn: async () => (await api.resolveTweet({body: {tweetUrl}})).event,
  });

  const create = useMutation({
    mutationFn: async () => {
      const {thesis} = await api.createThesis({
        body: {
          feedId: feedId as string,
          stance,
          title: title.trim(),
          body: body.trim(),
          tweetUrl: resolve.data ? tweetUrl : null,
          copiedFromThesisId: null,
        },
      });
      return thesis;
    },
    onSuccess: (thesis) => setThesisId(thesis.id),
  });

  const market = markets.data?.rows.find(
    (row) => row.feedId.toLowerCase() === feedId?.toLowerCase(),
  );

  const ready = feedId !== null && title.trim().length > 0;

  return (
    <Screen title="New thesis" subtitle="An argument first, then the position that backs it.">
      <section>
        <h2 className="mb-2 text-[0.8125rem] font-medium text-muted">The event</h2>
        <div className="flex gap-2">
          <input
            value={tweetUrl}
            onChange={(event) => setTweetUrl(event.target.value)}
            placeholder="Paste a post URL from X"
            inputMode="url"
            className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[0.875rem] outline-none placeholder:text-dim focus:border-line-strong"
          />
          <Button
            tone="quiet"
            onClick={() => resolve.mutate()}
            disabled={tweetUrl.trim() === "" || resolve.isPending}
          >
            {resolve.isPending ? "…" : "Attach"}
          </Button>
        </div>
        {resolve.isError ? (
          <p className="mt-2 text-[0.75rem] text-short">{describeApiError(resolve.error).detail}</p>
        ) : null}
        {resolve.data ? (
          <div className="mt-3">
            <TweetEmbed html={resolve.data.html} authorHandle={resolve.data.authorHandle} />
          </div>
        ) : (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-dim">
            Optional. The post is fetched and cached by our server, because X&apos;s embed endpoint
            cannot be called from a browser.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[0.8125rem] font-medium text-muted">The market</h2>
        <ul className="grid grid-cols-2 gap-2">
          {assets.map((asset) => {
            const row = markets.data?.rows.find(
              (candidate) => candidate.feedId.toLowerCase() === asset.feedId.toLowerCase(),
            );
            const selected = feedId?.toLowerCase() === asset.feedId.toLowerCase();

            return (
              <li key={asset.feedId}>
                <button
                  onClick={() => setFeedId(asset.feedId)}
                  className={`w-full rounded-card border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[0.875rem] font-semibold">{asset.symbol}</span>
                    <span className="text-[0.625rem] text-dim">
                      {ASSET_CLASS_LABEL[asset.assetClass]}
                    </span>
                  </div>
                  <p className="num mt-0.5 text-[0.75rem] text-muted">
                    {row ? formatPrice(row.mark.price) : "—"}
                  </p>
                  {row ? (
                    <div className="mt-1.5">
                      <MarketBadge market={row.market} />
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {market && !market.market.tradeable ? (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-warn">
            You can write the thesis now, but this market cannot be traded until it reopens, so
            there will be nothing to back it with yet.
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[0.8125rem] font-medium text-muted">Your call</h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          {(["bullish", "bearish"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setStance(option)}
              className={`h-9 rounded-lg text-[0.875rem] font-semibold capitalize transition ${
                stance === option
                  ? option === "bullish"
                    ? "bg-long-soft text-long"
                    : "bg-short-soft text-short"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="One line. What is the trade?"
          className="mt-2 w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[0.9375rem] font-medium outline-none placeholder:text-dim focus:border-line-strong"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Why. What has to happen for this to work, and what would tell you it is wrong."
          className="mt-2 w-full resize-none rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[0.875rem] leading-relaxed outline-none placeholder:text-dim focus:border-line-strong"
        />
        <p className="mt-1 text-right text-[0.6875rem] text-dim">{body.length}/2000</p>
      </section>

      {create.isError ? (
        <Card className="mt-4 p-3.5">
          <p className="text-[0.875rem] font-medium text-short">
            {describeApiError(create.error).title}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {describeApiError(create.error).detail}
          </p>
        </Card>
      ) : null}

      <Button
        onClick={() => create.mutate()}
        disabled={!ready || create.isPending || thesisId !== null}
        className="mt-5 w-full"
      >
        {create.isPending ? "Posting…" : thesisId ? "Posted" : "Post thesis"}
      </Button>

      <p className="mt-2 text-center text-[0.6875rem] leading-relaxed text-dim">
        Posting publishes the argument. Backing it with a position is the next step, and it is
        optional — a thesis with no position says so on its card.
      </p>

      {thesisId && feedId ? (
        <TradeSheet
          open
          onClose={() => router.push(`/p/${thesisId}`)}
          feedId={feedId}
          isLong={stance === "bullish"}
          thesisId={thesisId}
        />
      ) : null}
    </Screen>
  );
}
