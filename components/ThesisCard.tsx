"use client";

import Link from "next/link";
import {useAssets} from "@/lib/api/assets";
import type {Thesis} from "@/lib/api/schema/entities";
import type {z} from "zod";
import {useLivePnl} from "@/lib/chain/thesis-pnl";
import {formatAge, formatPrice} from "@/lib/format";
import {Avatar} from "./Avatar";
import {PnlBadge} from "./PnlBadge";
import {Card, Pill} from "./ui";
import {CommentIcon, CopyIcon, HeartIcon} from "./StatIcons";
import {TweetEmbed} from "./TweetEmbed";

export type ThesisData = z.infer<typeof Thesis>;

/// One thesis in the feed.
///
/// The P&L on the card is read from the chain with the thesis's `tokenId`. The API never mirrors
/// it, so there is one source of truth for what a position is worth and it is the contract.

export function ThesisCard({thesis, embed = false}: {thesis: ThesisData; embed?: boolean}) {
  const {symbolFor} = useAssets();
  const live = useLivePnl(thesis.tokenId);
  const age = Math.floor((Date.now() - Date.parse(thesis.createdAt)) / 1000);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <Link href={`/u/${thesis.author.handle}`} aria-label={`${thesis.author.name}'s profile`}>
          <Avatar src={thesis.author.avatarUrl} name={thesis.author.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${thesis.author.handle}`} className="block truncate">
            <span className="text-[0.875rem] font-medium">{thesis.author.name}</span>
            <span className="ml-1.5 text-[0.8125rem] text-dim">@{thesis.author.handle}</span>
          </Link>
        </div>
        <span className="shrink-0 text-[0.75rem] text-dim">{formatAge(age)}</span>
      </div>

      <Link href={`/p/${thesis.id}`} className="mt-3 block">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={thesis.stance === "bullish" ? "long" : "short"}>
            {thesis.stance === "bullish" ? "Bullish" : "Bearish"}
          </Pill>
          <Pill>{symbolFor(thesis.feedId)}</Pill>
          {thesis.copiedFromThesisId ? <Pill tone="accent">Copy</Pill> : null}
          {thesis.tokenId === null ? <Pill tone="warn">No position</Pill> : null}
        </div>

        <h2 className="mt-2 text-[1rem] font-semibold leading-snug">{thesis.title}</h2>
        {thesis.body ? (
          <p className="mt-1 line-clamp-3 text-[0.875rem] leading-relaxed text-muted">
            {thesis.body}
          </p>
        ) : null}
      </Link>

      {embed && thesis.event ? (
        <div className="mt-3">
          <TweetEmbed html={thesis.event.html} authorHandle={thesis.event.authorHandle} />
        </div>
      ) : null}

      {live.quote && live.position ? (
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <div>
            <p className="text-[0.6875rem] text-dim">Live P&amp;L</p>
            <PnlBadge
              netUsdc6={live.quote.netUsdc6}
              collateral={live.position.collateral}
              size="sm"
            />
          </div>
          <p className="num text-[0.6875rem] text-dim">
            entry {formatPrice(live.position.entryPrice)}
            {live.market ? ` · mark ${formatPrice(live.market.mark.price)}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-4 text-[0.75rem] text-dim">
        <span className="inline-flex items-center gap-1.5">
          <HeartIcon filled={thesis.viewerHasLiked === true} />
          {thesis.likeCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CommentIcon />
          {thesis.commentCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CopyIcon />
          {thesis.copyCount}
        </span>
        <Link href={`/p/${thesis.id}`} className="ml-auto font-medium text-accent">
          Read →
        </Link>
      </div>
    </Card>
  );
}
