"use client";

import {useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {describeApiError, isApiError} from "@/lib/api/errors";
import {Avatar} from "@/components/Avatar";
import {AsOf, Card, Empty, ErrorState, Screen, Skeleton} from "@/components/ui";
import {formatPnlWad} from "@/lib/format";
import type {LeaderboardWindow} from "@/lib/api/schema/entities";
import type {z} from "zod";

type Window = z.infer<typeof LeaderboardWindow>;

const WINDOWS: {id: Window; label: string}[] = [
  {id: "7d", label: "7 days"},
  {id: "30d", label: "30 days"},
  {id: "all", label: "All time"},
];

/// Ranked on money made.
///
/// This screen fails loudly and on purpose. When the subgraph is down the API returns INTERNAL
/// rather than a board built from whatever it still had, because a ranking assembled from missing
/// data is a wrong order presented as a right one. A profile degrades; a leaderboard must not.

export default function LeaderboardPage() {
  const api = useApi();
  const [window, setWindow] = useState<Window>("7d");

  const board = useQuery({
    queryKey: ["leaderboard", window],
    queryFn: async () => (await api.getLeaderboard({query: {window}})).entries,
    retry: 1,
  });

  const indexerDown = isApiError(board.error, "INTERNAL");

  return (
    <Screen title="Leaderboard" subtitle="Ranked on realised P&L.">
      <div className="mb-3 flex gap-1 rounded-xl bg-surface p-1">
        {WINDOWS.map((option) => (
          <button
            key={option.id}
            onClick={() => setWindow(option.id)}
            aria-pressed={window === option.id}
            className={`h-8 flex-1 rounded-lg text-[0.8125rem] font-medium transition ${
              window === option.id ? "bg-raised text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {board.isLoading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : board.isError ? (
        <ErrorState
          title={indexerDown ? "The board is unavailable" : describeApiError(board.error).title}
          detail={
            indexerDown
              ? "Rankings come from the subgraph, and it did not answer. Rather than order people by numbers we do not have, we are showing nothing."
              : describeApiError(board.error).detail
          }
          onRetry={() => void board.refetch()}
        />
      ) : (board.data?.length ?? 0) === 0 ? (
        <Empty
          title="Nobody has closed a position yet"
          detail="The board ranks on realised P&L, so it fills up as positions are closed."
        />
      ) : (
        <>
          <ul className="space-y-1.5">
            {board.data?.map((entry) => (
              <li key={entry.user.handle}>
                <Link href={`/u/${entry.user.handle}`}>
                  <Card className="flex items-center gap-3 px-3.5 py-3 transition hover:border-line-strong">
                    <span
                      className={`num w-5 shrink-0 text-center text-[0.875rem] font-semibold ${
                        entry.rank <= 3 ? "text-accent" : "text-dim"
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <Avatar src={entry.user.avatarUrl} name={entry.user.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-medium">{entry.user.name}</p>
                      <p className="num truncate text-[0.6875rem] text-dim">
                        {entry.closedPositions === 0
                          ? "nothing closed"
                          : `${Math.round(entry.winRate * 100)}% of ${entry.closedPositions} · ${entry.copiesReceived} copies`}
                      </p>
                    </div>
                    <span
                      className={`num shrink-0 text-[0.9375rem] font-semibold ${
                        BigInt(entry.realizedPnlUsd) > 0n
                          ? "text-long"
                          : BigInt(entry.realizedPnlUsd) < 0n
                            ? "text-short"
                            : "text-muted"
                      }`}
                    >
                      {formatPnlWad(BigInt(entry.realizedPnlUsd))}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          <AsOf>
            Realised P&amp;L over the selected window, from the subgraph as of its last indexed
            block. A trader who has closed nothing has no win rate — the board shows that rather
            than a zero.
          </AsOf>
        </>
      )}
    </Screen>
  );
}
