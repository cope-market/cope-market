"use client";

import {useQuery} from "@tanstack/react-query";
import type {Address} from "viem";
import {useChainSettings} from "./config";
import {publicClient} from "./client";
import {
  readLpPosition,
  readMarkets,
  readOpenInterest,
  readPositions,
  readVault,
  readWallet,
} from "./reads";
import type {MarketRow} from "./reads";

/// React Query over the chain reads. Prices move, so these poll; addresses do not, so they key on
/// the settings the server handed back and refetch when those change.

/// Fast enough that a price feels live, slow enough not to hammer a public RPC. The contract's
/// own staleness bound is 600 seconds, so this is far inside what the protocol considers current.
const PRICE_POLL_MS = 12_000;

export function useMarkets() {
  const chain = useChainSettings();

  return useQuery({
    queryKey: ["markets", chain.contracts.syntheticVault],
    queryFn: () => readMarkets(publicClient(), chain.contracts),
    refetchInterval: PRICE_POLL_MS,
    staleTime: PRICE_POLL_MS,
  });
}

export function useMarket(feedId: string | undefined) {
  const {data, ...rest} = useMarkets();
  const row = feedId
    ? data?.rows.find((candidate) => candidate.feedId.toLowerCase() === feedId.toLowerCase())
    : undefined;
  return {...rest, data: row, blockTimestamp: data?.blockTimestamp};
}

export function useOpenInterest(rows: readonly MarketRow[] | undefined) {
  const chain = useChainSettings();

  return useQuery({
    queryKey: ["open-interest", chain.contracts.syntheticVault, rows?.map((row) => row.feedId)],
    queryFn: () => readOpenInterest(publicClient(), chain.contracts, rows ?? []),
    enabled: (rows?.length ?? 0) > 0,
    refetchInterval: PRICE_POLL_MS * 2,
  });
}

export function useWallet(account: Address | undefined) {
  const chain = useChainSettings();

  return useQuery({
    queryKey: ["wallet", chain.contracts.usdc, account],
    queryFn: () => readWallet(publicClient(), chain.contracts, account as Address),
    enabled: Boolean(account),
    refetchInterval: 20_000,
  });
}

/// Positions by token id, straight from the contract. A token that has been closed reverts, and
/// the read maps that to null rather than to an error: asking about a closed position is a normal
/// thing to do, and the answer is "it is closed".
export function usePositions(tokenIds: readonly bigint[]) {
  const chain = useChainSettings();
  const key = tokenIds.map(String);

  return useQuery({
    queryKey: ["positions", chain.contracts.syntheticVault, key],
    queryFn: () => readPositions(publicClient(), chain.contracts, tokenIds),
    enabled: tokenIds.length > 0,
    refetchInterval: PRICE_POLL_MS,
  });
}

export function useVault() {
  const chain = useChainSettings();

  return useQuery({
    queryKey: ["vault", chain.contracts.liquidityVault],
    queryFn: () => readVault(publicClient(), chain.contracts),
    refetchInterval: 20_000,
  });
}

export function useLpPosition(account: Address | undefined) {
  const chain = useChainSettings();

  return useQuery({
    queryKey: ["lp-position", chain.contracts.liquidityVault, account],
    queryFn: () => readLpPosition(publicClient(), chain.contracts, account as Address),
    enabled: Boolean(account),
    refetchInterval: 20_000,
  });
}
