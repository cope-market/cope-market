import {createPublicClient, http} from "viem";
import type {PublicClient} from "viem";
import {arcTestnet} from "./arc";

/// One shared public client. Multicall3 is deployed at the canonical address on Arc, so viem
/// aggregates the reads a screen makes into a single eth_call rather than a dozen round trips.

let cached: PublicClient | undefined;

export function publicClient(): PublicClient {
  cached ??= createPublicClient({
    chain: arcTestnet,
    transport: http(undefined, {batch: true, retryCount: 2}),
    batch: {multicall: {wait: 16}},
  }) as PublicClient;
  return cached;
}
