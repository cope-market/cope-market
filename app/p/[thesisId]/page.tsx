"use client";

import {use, useState} from "react";
import Link from "next/link";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {describeApiError} from "@/lib/api/errors";
import {useAssets} from "@/lib/api/assets";
import {useSession} from "@/lib/auth/session";
import {useLivePnl} from "@/lib/chain/thesis-pnl";
import {useCopiesOf} from "@/lib/graph/hooks";
import {Avatar} from "@/components/Avatar";
import {PnlBadge} from "@/components/PnlBadge";
import {TweetEmbed} from "@/components/TweetEmbed";
import {TradeSheet} from "@/components/lazy";
import {CommentIcon, HeartIcon} from "@/components/StatIcons";
import {AsOf, Button, Card, ErrorState, Pill, Row, Screen, Skeleton} from "@/components/ui";
import {formatAge, formatPrice, formatUsdc6} from "@/lib/format";

/// A thesis, its backing position, and the people who copied it.

export default function ThesisPage({params}: {params: Promise<{thesisId: string}>}) {
  const {thesisId} = use(params);
  const api = useApi();
  const queryClient = useQueryClient();
  const {authenticated} = useSession();
  const {symbolFor} = useAssets();
  const [copying, setCopying] = useState(false);

  const {data, isLoading, isError, error, refetch} = useQuery({
    queryKey: ["thesis", thesisId],
    queryFn: async () => (await api.getThesis({params: {thesisId}})).thesis,
  });

  const live = useLivePnl(data?.tokenId ?? null);
  const copies = useCopiesOf(data?.tokenId ? BigInt(data.tokenId) : undefined);

  const like = useMutation({
    mutationFn: async (liked: boolean) =>
      liked
        ? await api.unlikeThesis({params: {thesisId}})
        : await api.likeThesis({params: {thesisId}, body: {}}),
    onSuccess: () => void queryClient.invalidateQueries({queryKey: ["thesis", thesisId]}),
  });

  if (isLoading) {
    return (
      <Screen title="Thesis">
        <Skeleton className="h-64" />
      </Screen>
    );
  }

  if (isError || !data) {
    const copy = describeApiError(error);
    return (
      <Screen title="Thesis">
        <ErrorState title={copy.title} detail={copy.detail} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const age = Math.floor((Date.now() - Date.parse(data.createdAt)) / 1000);
  const copiesProfitable =
    copies.data?.filter((copy) => (copy.realizedPnlWad ?? 0n) > 0n).length ?? 0;
  const copiesClosed = copies.data?.filter((copy) => copy.status !== "OPEN").length ?? 0;

  return (
    <Screen title={symbolFor(data.feedId)} subtitle={`Posted ${formatAge(age)}`}>
      <Card className="p-4">
        <div className="flex items-center gap-2.5">
          <Link href={`/u/${data.author.handle}`} aria-label={`${data.author.name}'s profile`}>
            <Avatar src={data.author.avatarUrl} name={data.author.name} size={40} />
          </Link>
          <div className="min-w-0">
            <Link href={`/u/${data.author.handle}`} className="block truncate">
              <span className="text-[0.9375rem] font-medium">{data.author.name}</span>
              <span className="ml-1.5 text-[0.8125rem] text-dim">@{data.author.handle}</span>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Pill tone={data.stance === "bullish" ? "long" : "short"}>
            {data.stance === "bullish" ? "Bullish" : "Bearish"}
          </Pill>
          <Pill>{symbolFor(data.feedId)}</Pill>
          {data.copiedFromThesisId ? (
            <Link href={`/p/${data.copiedFromThesisId}`}>
              <Pill tone="accent">Copied from another thesis</Pill>
            </Link>
          ) : null}
        </div>

        <h1 className="mt-2.5 text-[1.25rem] font-semibold leading-snug">{data.title}</h1>
        {data.body ? (
          <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-muted">
            {data.body}
          </p>
        ) : null}

        {data.event ? (
          <div className="mt-3">
            <TweetEmbed html={data.event.html} authorHandle={data.event.authorHandle} />
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <button
            onClick={() => authenticated && like.mutate(data.viewerHasLiked === true)}
            disabled={!authenticated || like.isPending}
            className={`inline-flex items-center gap-1.5 text-[0.8125rem] transition ${
              data.viewerHasLiked ? "text-short" : "text-muted hover:text-ink"
            } disabled:opacity-50`}
          >
            <HeartIcon filled={data.viewerHasLiked === true} />
            {data.likeCount}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted">
            <CommentIcon />
            {data.commentCount}
          </span>
        </div>
      </Card>

      {data.tokenId === null ? (
        <Card className="mt-3 p-4">
          <p className="text-[0.875rem] font-medium text-warn">No position behind this yet</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            A thesis is written before its trade is signed. This one either has not been backed or
            its trade did not confirm, so there is nothing to copy.
          </p>
        </Card>
      ) : (
        <Card className="mt-3 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.75rem] text-dim">Backing position</p>
              <p className="num mt-0.5 text-[0.875rem]">#{data.tokenId}</p>
            </div>
            {live.quote && live.position ? (
              <div className="text-right">
                <PnlBadge netUsdc6={live.quote.netUsdc6} collateral={live.position.collateral} />
                <p className="text-[0.6875rem] text-dim">live, from the contract</p>
              </div>
            ) : live.settled ? (
              <Pill>Closed</Pill>
            ) : (
              <Skeleton className="h-6 w-20" />
            )}
          </div>

          {live.position ? (
            <dl className="mt-3 space-y-0.5 border-t border-line pt-3">
              <Row label="Side" value={live.position.isLong ? "Long" : "Short"} />
              <Row label="Entry" value={formatPrice(live.position.entryPrice)} />
              <Row label="Mark" value={live.market ? formatPrice(live.market.mark.price) : "—"} />
              <Row label="Collateral" value={`${formatUsdc6(live.position.collateral)} USDC`} />
            </dl>
          ) : null}

          {live.position ? (
            <Button onClick={() => setCopying(true)} className="mt-4 w-full">
              Copy this position
            </Button>
          ) : null}
        </Card>
      )}

      {copies.data && copies.data.length > 0 ? (
        <Card className="mt-3 p-4">
          <h2 className="text-[0.875rem] font-semibold">
            Copied {copies.data.length} {copies.data.length === 1 ? "time" : "times"}
          </h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            {copiesClosed === 0
              ? "None of them have closed yet, so there is no record of how copying this has paid."
              : `${copiesProfitable} of the ${copiesClosed} that closed made money. That is a different question from how the author did, and it is the one that matters if you are thinking of copying.`}
          </p>
          <AsOf>From the subgraph, as of its last indexed block.</AsOf>
        </Card>
      ) : null}

      {live.position ? (
        <TradeSheet
          open={copying}
          onClose={() => setCopying(false)}
          feedId={data.feedId}
          isLong={live.position.isLong}
          thesisId={null}
          copiedFromTokenId={data.tokenId}
          copiedFromEntryPrice={live.position.entryPrice}
        />
      ) : null}

      <Comments thesisId={thesisId} />
    </Screen>
  );
}

function Comments({thesisId}: {thesisId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {authenticated} = useSession();
  const [body, setBody] = useState("");

  const comments = useQuery({
    queryKey: ["comments", thesisId],
    queryFn: async () => await api.listComments({params: {thesisId}, query: {limit: 50}}),
  });

  const post = useMutation({
    mutationFn: async () => await api.createComment({params: {thesisId}, body: {body}}),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({queryKey: ["comments", thesisId]});
      void queryClient.invalidateQueries({queryKey: ["thesis", thesisId]});
    },
  });

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[0.875rem] font-semibold">Comments</h2>

      {authenticated ? (
        <div className="mb-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Say why they are wrong."
            className="w-full resize-none rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[0.875rem] outline-none placeholder:text-dim focus:border-line-strong"
          />
          <Button
            onClick={() => post.mutate()}
            disabled={body.trim() === "" || post.isPending}
            className="mt-2 h-9 w-full text-[0.8125rem]"
          >
            {post.isPending ? "Posting…" : "Comment"}
          </Button>
          {post.isError ? (
            <p className="mt-2 text-[0.75rem] text-short">{describeApiError(post.error).detail}</p>
          ) : null}
        </div>
      ) : null}

      {comments.isLoading ? (
        <Skeleton className="h-20" />
      ) : comments.data?.data.length === 0 ? (
        <p className="py-6 text-center text-[0.8125rem] text-dim">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.data?.data.map((comment) => (
            <li key={comment.id}>
              <Card className="p-3.5">
                <div className="flex items-center gap-2">
                  <Avatar src={comment.author.avatarUrl} name={comment.author.name} size={24} />
                  <Link
                    href={`/u/${comment.author.handle}`}
                    className="text-[0.8125rem] font-medium"
                  >
                    {comment.author.name}
                  </Link>
                  <span className="ml-auto text-[0.6875rem] text-dim">
                    {formatAge(Math.floor((Date.now() - Date.parse(comment.createdAt)) / 1000))}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-muted">
                  {comment.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
