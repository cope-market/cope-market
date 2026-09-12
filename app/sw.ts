import {defaultCache} from "@serwist/next/worker";
import type {PrecacheEntry, SerwistGlobalConfig} from "serwist";
import {NetworkOnly, Serwist} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/// Anything that prices or settles money is never served from a cache. A quote is valid for
/// thirty seconds and a position's state changes when it is closed; handing back a stored copy of
/// either would put a stale number in front of someone about to sign for it.
const neverCache = [
  /^\/api\/v1\/trades/,
  /^\/api\/v1\/positions/,
  /^\/api\/v1\/auth/,
  /^\/api\/v1\/chains/,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...neverCache.map((pattern) => ({
      matcher: ({url, sameOrigin}: {url: URL; sameOrigin: boolean}) =>
        sameOrigin && pattern.test(url.pathname),
      handler: new NetworkOnly(),
    })),
    ...defaultCache,
  ],
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
