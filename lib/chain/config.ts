"use client";

import {useQuery} from "@tanstack/react-query";
import {useApi} from "../api/provider";
import {ARC_MIN_MAX_FEE_PER_GAS, ARC_TESTNET_CONTRACTS, ARC_TESTNET_ID} from "./arc";
import type {ContractAddresses} from "./arc";

/// Contract addresses come from the server so a client never hard-codes one, and the mainnet
/// cutover is a deployment rather than a release. The static values are a fallback for a cold
/// start and for a backend outage: the chain views are worth showing even when the API is down,
/// because the chain is where the money actually is.

export interface ChainSettings {
  chainId: number;
  contracts: ContractAddresses;
  minMaxFeePerGasWei: bigint;
  explorerUrl: string;
  /// False when these are the built-in fallbacks rather than the server's answer.
  fromServer: boolean;
}

export const FALLBACK_CHAIN: ChainSettings = {
  chainId: ARC_TESTNET_ID,
  contracts: ARC_TESTNET_CONTRACTS,
  minMaxFeePerGasWei: ARC_MIN_MAX_FEE_PER_GAS,
  explorerUrl: "https://testnet.arcscan.app",
  fromServer: false,
};

export function useChainSettings(): ChainSettings {
  const api = useApi();

  const {data} = useQuery({
    queryKey: ["chains"],
    queryFn: async (): Promise<ChainSettings | null> => {
      const {chains} = await api.getChains({});
      const chain = chains[0];
      if (!chain) return null;
      return {
        chainId: chain.chainId,
        // The schema has already checked these are 20-byte hex; the cast gives viem the literal
        // type it wants without re-validating what zod has validated.
        contracts: chain.contracts as ContractAddresses,
        minMaxFeePerGasWei: BigInt(chain.minMaxFeePerGasWei),
        explorerUrl: chain.explorerUrl,
        fromServer: true,
      };
    },
    // Addresses change on a deploy, not on a refresh.
    staleTime: 10 * 60_000,
    retry: 1,
  });

  return data ?? FALLBACK_CHAIN;
}
