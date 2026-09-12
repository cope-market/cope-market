"use client";

import {use} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {describeApiError} from "@/lib/api/errors";
import {useAssets} from "@/lib/api/assets";
import {useLivePositions} from "@/lib/chain/position";
import {useClosedPositions, useTraderRecord} from "@/lib/graph/hooks";
import {winRate} from "@/lib/graph/cope";
import {Avatar} from "@/components/Avatar";
import {PositionCard} from "@/components/PositionCard";
import {AsOf, Button, Card, Empty, ErrorState, Pill, Row, Screen, Skeleton} from "@/components/ui";
import {formatPnlWad, formatUsdc6, shortAddress} from "@/lib/format";
import {explorerAddressUrl} from "@/lib/chain/arc";

/// A trader's profile, assembled from three sources, each answering what only it can.
///
///   the API ....... who they are, their bio, and whether you follow them
///   the chain ..... what they hold right now
///   the subgraph .. what they have closed, and how it went
///
/// The subgraph part degrades rather than fails. A profile is worth showing without its P&L
/// figure, which is why the backend returns the profile with a zero rather than an error when the
/// indexer is down — and why this screen says when a number is missing rather than printing a zero
/// that would read as "broke even".

export default function ProfilePage({params}: {params: Promise<{handle: string}>}) {
  const {handle} = use(params);
  const api = useApi();
  const queryClient = useQueryClient();
  const {symbolFor} = useAssets();

  const profile = useQuery({
    queryKey: ["user", handle],
    queryFn: async () => (await api.getUser({params: {handle}})).profile,
  });

  const address = profile.data?.walletAddress;
  const record = useTraderRecord(address);
  const closed = useClosedPositions(address);
  const {positions: open, isLoading: openLoading} = useLivePositions(address);

  const follow = useMutation({
    mutationFn: async (isFollowing: boolean) =>
      isFollowing
        ? await api.unfollowUser({params: {handle}})
        : await api.followUser({params: {handle}, body: {}}),
    onSuccess: () => void queryClient.invalidateQueries({queryKey: ["user", handle]}),
  });

  if (profile.isLoading) {
    return (
      <Screen title="Profile">
        <Skeleton className="h-40" />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    const copy = describeApiError(profile.error);
    return (
      <Screen title="Profile">
        <ErrorState
          title={copy.title}
          detail={copy.detail}
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  const user = profile.data;
  const viewer = user.viewer;
  const rate = record.data ? winRate(record.data) : null;
  const hasClosed = (record.data?.positionsClosed ?? 0) > 0;

  return (
    <Screen title={user.name} subtitle={`@${user.handle}`}>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar src={user.avatarUrl} name={user.name} size={52} />
          <div className="min-w-0 flex-1">
            {user.bio ? (
              <p className="text-[0.875rem] leading-relaxed text-muted">{user.bio}</p>
            ) : (
              <p className="text-[0.875rem] text-dim">No bio.</p>
            )}
            <p className="mt-1.5 text-[0.75rem] text-dim">
              <a
                href={explorerAddressUrl(user.walletAddress)}
                target="_blank"
                rel="noreferrer"
                className="hover:text-muted"
              >
                {shortAddress(user.walletAddress)}
              </a>
            </p>
          </div>
          {viewer && !viewer.isSelf ? (
            <Button
              tone={viewer.isFollowing ? "quiet" : "accent"}
              onClick={() => follow.mutate(viewer.isFollowing)}
              disabled={follow.isPending}
              className="h-9 shrink-0 px-3 text-[0.8125rem]"
            >
              {viewer.isFollowing ? "Following" : "Follow"}
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
          <Stat label="Followers" value={String(user.stats.followers)} />
          <Stat label="Following" value={String(user.stats.following)} />
          <Stat label="Copied" value={String(user.stats.copiesReceived)} />
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <h2 className="text-[0.875rem] font-semibold">Record</h2>
        {record.isLoading ? (
          <Skeleton className="mt-3 h-20" />
        ) : record.isError ? (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            The subgraph did not answer, so this trader&apos;s results are unavailable. Everything
            else on this profile is still true.
          </p>
        ) : !record.data ? (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            This address has never traded. That is not the same as having broken even.
          </p>
        ) : (
          <>
            <dl className="mt-2 space-y-0.5">
              <Row
                label="Realised P&L"
                value={hasClosed ? `${formatPnlWad(record.data.realizedPnlWad)} USD` : "n/a"}
                hint={hasClosed ? undefined : "nothing closed"}
              />
              <Row
                label="Win rate"
                value={rate === null ? "n/a" : `${Math.round(rate * 100)}%`}
                hint={
                  rate === null
                    ? "nothing closed"
                    : `${record.data.wins} of ${record.data.wins + record.data.losses}`
                }
              />
              <Row label="Positions opened" value={String(record.data.positionsOpened)} />
              <Row label="Positions closed" value={String(record.data.positionsClosed)} />
              {record.data.positionsLiquidated > 0 ? (
                <Row label="Liquidated" value={String(record.data.positionsLiquidated)} />
              ) : null}
              <Row label="Copies made" value={String(record.data.copiesMade)} />
              <Row
                label="Author fees earned"
                value={`${formatUsdc6(record.data.authorFeesEarned)} USDC`}
              />
            </dl>
            <AsOf>
              Results are the subgraph&apos;s, as of its last indexed block. A flat close counts as
              a loss, so wins and losses always add up to positions closed.
            </AsOf>
          </>
        )}
      </Card>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold">
          Open positions
          {open.length > 0 ? <Pill>{open.length}</Pill> : null}
        </h2>
        {openLoading ? (
          <Skeleton className="h-28" />
        ) : open.length === 0 ? (
          <Empty title="Nothing open" detail="This trader holds no positions right now." />
        ) : (
          <ul className="space-y-2">
            {open.map((live) => (
              <li key={String(live.position.tokenId)}>
                <PositionCard live={live} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[0.875rem] font-semibold">Closed</h2>
        {closed.isLoading ? (
          <Skeleton className="h-24" />
        ) : (closed.data?.length ?? 0) === 0 ? (
          <Empty title="Nothing closed yet" detail="There is no record to judge this trader by." />
        ) : (
          <ul className="space-y-1.5">
            {closed.data?.map((position) => (
              <li key={String(position.tokenId)}>
                <Card className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.8125rem] font-medium">
                        {symbolFor(position.asset.id)}
                      </span>
                      <Pill tone={position.isLong ? "long" : "short"}>
                        {position.isLong ? "Long" : "Short"}
                      </Pill>
                      {position.status === "LIQUIDATED" ? (
                        <Pill tone="warn">Liquidated</Pill>
                      ) : null}
                    </div>
                    <p className="num mt-0.5 text-[0.6875rem] text-dim">
                      #{String(position.tokenId)} · {formatUsdc6(position.collateral)} USDC
                    </p>
                  </div>
                  <span
                    className={`num shrink-0 text-[0.875rem] font-semibold ${
                      (position.realizedPnlWad ?? 0n) > 0n
                        ? "text-long"
                        : (position.realizedPnlWad ?? 0n) < 0n
                          ? "text-short"
                          : "text-muted"
                    }`}
                  >
                    {formatPnlWad(position.realizedPnlWad ?? 0n)}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <div>
      <p className="num text-[1.125rem] font-semibold">{value}</p>
      <p className="mt-0.5 text-[0.6875rem] text-dim">{label}</p>
    </div>
  );
}
