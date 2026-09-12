"use client";

import {useQuery} from "@tanstack/react-query";
import {closedPositionsBy, copiesOf, positionsHeldBy, traderRecord} from "./cope";
import {vaultSnapshots, vaultSummary} from "./vault";

/// React Query over the subgraphs.
///
/// These poll more slowly than the chain reads on purpose. An indexer lags by design, so asking it
/// every few seconds produces the same answer at a cost; the user's own live numbers come from the
/// contract instead.

const INDEXER_POLL_MS = 30_000;

export function useHeldPositions(address: string | undefined) {
  return useQuery({
    queryKey: ["graph", "held", address?.toLowerCase()],
    queryFn: () => positionsHeldBy(address as string),
    enabled: Boolean(address),
    refetchInterval: INDEXER_POLL_MS,
  });
}

export function useClosedPositions(address: string | undefined) {
  return useQuery({
    queryKey: ["graph", "closed", address?.toLowerCase()],
    queryFn: () => closedPositionsBy(address as string),
    enabled: Boolean(address),
    staleTime: INDEXER_POLL_MS,
  });
}

export function useTraderRecord(address: string | undefined) {
  return useQuery({
    queryKey: ["graph", "trader", address?.toLowerCase()],
    queryFn: () => traderRecord(address as string),
    enabled: Boolean(address),
    staleTime: INDEXER_POLL_MS,
  });
}

export function useCopiesOf(tokenId: bigint | undefined) {
  return useQuery({
    queryKey: ["graph", "copies", tokenId?.toString()],
    queryFn: () => copiesOf(tokenId as bigint),
    enabled: tokenId !== undefined,
    staleTime: INDEXER_POLL_MS,
  });
}

export function useVaultHistory(address: string | undefined) {
  return useQuery({
    queryKey: ["graph", "vault", address?.toLowerCase()],
    queryFn: async () => ({
      summary: await vaultSummary(address as string),
      snapshots: await vaultSnapshots(address as string),
    }),
    enabled: Boolean(address),
    staleTime: 60_000,
  });
}
