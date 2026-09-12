"use client";

import {useQuery} from "@tanstack/react-query";
import {useApi} from "./provider";
import type {Asset} from "./schema/entities";
import type {z} from "zod";

export type AssetInfo = z.infer<typeof Asset>;

/// Nothing on-chain turns a bytes32 feed id into "EUR/USD", so the catalogue comes from the API.
/// These four are the fallback, and they are the same four the server serves: our Hermes key is
/// entitled to no others, and listing one it is not would put a permanently broken market in
/// front of someone.
const FALLBACK: AssetInfo[] = [
  {
    feedId: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    symbol: "EUR/USD",
    name: "Euro",
    assetClass: "fx",
    logoUrl: null,
  },
  {
    feedId: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
    symbol: "XAU/USD",
    name: "Gold",
    assetClass: "metal",
    logoUrl: null,
  },
  {
    feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    symbol: "BTC/USD",
    name: "Bitcoin",
    assetClass: "crypto",
    logoUrl: null,
  },
  {
    feedId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    symbol: "TSLA/USD",
    name: "Tesla",
    assetClass: "equity",
    logoUrl: null,
  },
];

export function useAssets() {
  const api = useApi();

  const {data} = useQuery({
    queryKey: ["assets"],
    queryFn: async () => (await api.listAssets({})).assets,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const assets = data ?? FALLBACK;
  const byFeedId = new Map(assets.map((asset) => [asset.feedId.toLowerCase(), asset]));

  return {
    assets,
    byFeedId,
    lookup: (feedId: string): AssetInfo | undefined => byFeedId.get(feedId.toLowerCase()),
    /// Feed ids are 32 bytes and mean nothing to a reader. Falling back to a truncated one is
    /// better than rendering a blank where a symbol should be.
    symbolFor: (feedId: string): string =>
      byFeedId.get(feedId.toLowerCase())?.symbol ?? `${feedId.slice(0, 10)}…`,
  };
}

export const ASSET_CLASS_LABEL: Record<AssetInfo["assetClass"], string> = {
  fx: "FX",
  metal: "Metal",
  crypto: "Crypto",
  equity: "Equity",
};
