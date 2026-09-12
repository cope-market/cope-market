"use client";

import {useCallback} from "react";
import type {ReactNode} from "react";
import {PrivyProvider, usePrivy} from "@privy-io/react-auth";
import {ApiProvider} from "@/lib/api/provider";
import {arcTestnet} from "@/lib/chain/arc";

/// Privy owns sign-in and the embedded wallet; the API client owns the token it issues.
///
/// Two things about the chain configuration matter and both are one-line mistakes. Arc must be in
/// `supportedChains` or the embedded wallet cannot sign for it at all, and its native currency has
/// 18 decimals while every contract amount is 6 — the chain definition carries the first, and
/// nothing outside lib/format is allowed to conflate the second.

const appId = process.env["NEXT_PUBLIC_PRIVY_APP_ID"];

function PrivyBackedApi({children}: {children: ReactNode}) {
  const {getAccessToken, authenticated} = usePrivy();

  const token = useCallback(async () => {
    if (!authenticated) return null;
    return await getAccessToken();
  }, [authenticated, getAccessToken]);

  return <ApiProvider getAccessToken={token}>{children}</ApiProvider>;
}

const anonymous = async () => null;

export function Providers({children}: {children: ReactNode}) {
  // Without an app id the app still runs, signed out. That keeps a fresh checkout useful before
  // anyone has touched configuration, and it is the path Playwright drives.
  if (!appId) {
    return <ApiProvider getAccessToken={anonymous}>{children}</ApiProvider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["twitter"],
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: {ethereum: {createOnLogin: "users-without-wallets"}},
        appearance: {
          theme: "dark",
          accentColor: "#8b7cff",
          logo: "/icons/icon-192.png",
          walletChainType: "ethereum-only",
        },
      }}
    >
      <PrivyBackedApi>{children}</PrivyBackedApi>
    </PrivyProvider>
  );
}
