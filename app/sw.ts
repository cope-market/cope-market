import {defaultCache} from "@serwist/next/worker";
import type {PrecacheEntry, SerwistGlobalConfig} from "serwist";
import {NetworkOnly, Serwist} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/// The API is never served from a cache. Not some of it — none of it.
///
/// Serwist's default runtime caching puts every same-origin GET under `/api/` behind NetworkFirst
/// with a 24-hour expiry, which is wrong for every route this app has. A quote is valid for thirty
/// seconds. A position's state changes when it is closed, possibly by a liquidation keeper rather
/// than by its owner. And the leaderboard is meant to fail loudly when the subgraph is down, so
/// that a ranking is never built from data we do not have — falling back to yesterday's board
/// would defeat the whole point of returning an error.
///
/// Origin is deliberately not part of the test. Privy's own API is served from another host and
/// the default cross-origin rule was storing its responses too; an auth endpoint answered from a
/// day-old cache is no better than a stale leaderboard.
///
/// This matcher is registered before `defaultCache` so it wins.
const apiIsAlwaysLive = {
  matcher: ({url}: {url: URL}) => url.pathname.startsWith("/api/"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiIsAlwaysLive, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({request}) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
