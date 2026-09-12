"use client";

import {useState} from "react";
import Link from "next/link";
import {useInfiniteQuery} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {useSession} from "@/lib/auth/session";
import {describeApiError} from "@/lib/api/errors";
import {ThesisCard} from "@/components/ThesisCard";
import {InstallPrompt} from "@/components/InstallPrompt";
import {Button, Card, Empty, ErrorState, Screen, Skeleton} from "@/components/ui";
import type {FeedTab} from "@/lib/api/schema/entities";
import type {z} from "zod";

type Tab = z.infer<typeof FeedTab>;

const TABS: {id: Tab; label: string; empty: string}[] = [
  {id: "latest", label: "Latest", empty: "Nobody has posted yet. Be the first."},
  {id: "top", label: "Top", empty: "Nothing has been ranked yet."},
  {id: "following", label: "Following", empty: "Follow someone and their theses appear here."},
];

export default function FeedPage() {
  const api = useApi();
  const {authenticated} = useSession();
  const [tab, setTab] = useState<Tab>("latest");

  const feed = useInfiniteQuery({
    queryKey: ["feed", tab],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({pageParam}) => await api.getFeed({query: {tab, limit: 20, cursor: pageParam}}),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const theses = feed.data?.pages.flatMap((page) => page.data) ?? [];
  const active = TABS.find((candidate) => candidate.id === tab);

  return (
    <Screen
      title="Cope Market"
      subtitle="Theses backed by real positions."
      action={
        <Link href="/post/new">
          <Button className="h-9 px-3 text-[0.8125rem]">Post</Button>
        </Link>
      }
    >
      <InstallPrompt signedIn={authenticated} />

      <div className="mb-3 flex gap-1 rounded-xl bg-surface p-1">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => setTab(candidate.id)}
            aria-pressed={tab === candidate.id}
            className={`h-8 flex-1 rounded-lg text-[0.8125rem] font-medium transition ${
              tab === candidate.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {tab === "following" && !authenticated ? (
        <Card className="p-5 text-center">
          <p className="text-[0.9375rem] font-semibold">Sign in to follow people</p>
          <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-muted">
            This tab shows theses from the accounts you follow.
          </p>
          <Link href="/login" className="mt-4 inline-block">
            <Button>Continue with X</Button>
          </Link>
        </Card>
      ) : feed.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : feed.isError ? (
        <ErrorState
          title={describeApiError(feed.error).title}
          detail={describeApiError(feed.error).detail}
          onRetry={() => void feed.refetch()}
        />
      ) : theses.length === 0 ? (
        <Empty title="Nothing here yet" detail={active?.empty ?? ""} />
      ) : (
        <>
          <ul className="space-y-2">
            {theses.map((thesis) => (
              <li key={thesis.id}>
                <ThesisCard thesis={thesis} />
              </li>
            ))}
          </ul>

          {feed.hasNextPage ? (
            <Button
              tone="quiet"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              className="mt-3 w-full"
            >
              {feed.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </>
      )}
    </Screen>
  );
}
