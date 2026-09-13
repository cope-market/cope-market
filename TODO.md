# TODO — PWA

Our list. Contracts, backend, subgraphs, the price pusher and the liquidation keeper belong to the
other dev; nothing here asks them to do anything, it only notes what we cannot verify until their
services are up.

**Status:** every screen is built. `npm run check` is green (types, lint, format, 97 unit tests,
API drift) and `npm run e2e` is green — 38 tests across WebKit/iPhone and Chromium/desktop.
Lighthouse: performance 92, accessibility 100, SEO 100.

**We are on the real backend.** `BACKEND_ORIGIN` points at the tunnel; the feed, leaderboard and
profiles are Postgres now, not fixtures, with live P&L computed from the chain on top. BTC/USD is
open — their pusher is running — so crypto is tradeable; FX, metals and equities are correctly
closed because it is Sunday. What has still not happened is a trade through the UI, which needs
Privy signing to work.

---

## 1. Client work, no dependencies — done

**Liquidation.**

- [x] `liquidationThresholdBps()` and `liquidationRewardBps()` read from the chain, not hard-coded.
- [x] Liquidation risk on every open position: the exit price it happens at, how far along it is,
      and a warning once past 60%. Quiet until it matters.
- [x] `liquidationReward` and `closedBy` queried; a liquidated position shows the liquidator's cut.
- [x] A position that disappears mid-session now says so instead of the card vanishing.
- [x] `lib/trade/liquidation.ts` with 11 tests, cross-checked against `quoteClose`.

**Bugs and loose ends.**

- [x] `/p/token/[tokenId]` built — the dangling link now lands on a real page, which also covers a
      copied position whose origin has no thesis.
- [x] Abandoned quotes call `cancelTrade` on the way out.
- [x] Bio editing on the wallet screen, via `PATCH me`.
- [x] Bundle: `/markets/[feedId]` went from 544 kB to 249 kB by lazy-loading the trade sheet.

**Testing.**

- [x] Playwright: 38 tests over the signed-out shell, markets, failure modes and PWA basics.
- [x] Lighthouse. Note: Lighthouse 12 removed the PWA category, so installability is asserted by
      our own tests instead — manifest, icon sizes, maskable icon, viewport, and that no `/api/`
      response is ever cached.
- [x] Screenshots re-taken from the production build.

**Found while doing the above, and fixed:**

- [x] **The service worker was caching the API.** Serwist's default runtime caching puts every
      same-origin `/api/` GET behind NetworkFirst with a 24-hour expiry, and our exclusion list
      only named four prefixes. A leaderboard that failed because the subgraph was down would have
      fallen back to a day-old ranking — exactly what the design forbids. All `/api/` is now
      NetworkOnly, and a test asserts the cache stays empty of it.
- [x] **The app crashed without a Privy app id**, despite claiming to run signed out: `useSession`
      called `usePrivy()` unconditionally. Session state now comes from a provider, chosen once at
      the tree root.
- [x] **Accessibility was 83.** `--color-dim` failed contrast at small sizes (3.4:1, now 4.8:1);
      the viewport blocked pinch-zoom; heading levels skipped; avatar links had no accessible name.
      Now 100.
- [x] **E2E must run against a production build.** Next's dev chunk loading is cancelled by WebKit,
      so every page rendered its shell and never hydrated. The built output is fine.

## 1b. Pointing at the live backend — done

- [x] `npm run api:sync` against their updated client.
- [x] `BACKEND_ORIGIN` set to the tunnel, verified end to end on a production build: real theses,
      real copy lineage, live P&L from the chain over the top.
- [x] **The proxy moved from `next.config.ts` to `middleware.ts`, and it had to.** A rewrite cannot
      add a request header, and ngrok needs one. Measured, same browser User-Agent, same tunnel:

      plain next.config rewrite  ->  200 text/html        (ngrok's interstitial)
      middleware + skip header   ->  200 application/json

      So the half of `INTEGRATION.md` that says a rewrite means "neither CORS nor ngrok's browser
      interstitial applies at all" is only right about CORS. The rewrite forwards the browser's
      User-Agent, and ngrok answers it with the warning page. **Worth telling Lajos** — the doc
      would send the next person into a JSON parse error that curl cannot reproduce.
- [x] Same-origin is still the right call for the other reasons too: their CORS allowlist names
      `http://localhost:3000` only, which would exclude the port the E2E suite builds on, and the
      tunnel URL stays out of the client bundle so a rotation needs no rebuild.
- [x] E2E still green through the proxy — 38 tests.

*If calls start failing, the tunnel URL has rotated. Ask for the current one rather than debugging.*

## 2. Needs you

- [x] Local config exists — the Privy app id is in the build.
- [x] Privy allowed origins — `http://localhost:3000` is allowlisted (visible in Privy's own CSP).
- [x] `BACKEND_ORIGIN` pointed at the tunnel.
- [ ] **Privy supported chains** — add Arc testnet (5042002, `https://rpc.testnet.arc.io`, native
      USDC 18-dec). Still unverified, and without it the embedded wallet cannot sign for Arc at all
      (risk R8). This is the single thing blocking a real trade.
- [ ] **A funded Arc testnet account** for the signed-in wallet, from `faucet.circle.com`.
- [ ] *If we want E2E on the built server:* add `http://localhost:3100` to Privy's allowed origins.
      Not needed for the current suite, which runs signed out on purpose. Their API CORS does not
      need it — we proxy.
- [ ] *For the copy demo:* a second X account and a second funded key.

## 3. Verify once signing works

- [ ] Sign in end to end: X login → embedded wallet → `POST auth/session` → real account.
- [ ] Open a long and a short on BTC; watch the live P&L move. **Ready now — BTC is open.**
- [ ] Close both; assert the payout matches `lib/trade/pnl.ts` to the base unit.
- [ ] Copy from the second account; confirm a profitable close pays the author on-chain.
- [ ] LP deposit and withdraw; confirm the receipt matches `previewRedeem` exactly.
- [ ] Watch a liquidation land in the UI while the position is on screen.
- [ ] Sweep the error states the mock cannot produce — `INSUFFICIENT_LIQUIDITY`, `QUOTE_EXPIRED`,
      `OPEN_INTEREST_CAP_EXCEEDED`.
- [ ] **E2E signer mode** (`NEXT_PUBLIC_E2E=1`, a viem local account in place of the Privy UI) and
      the full Playwright journey. Needs a funded key — **and a decision**, because test tokens are
      off on the live backend, deliberately, since it is reachable from the internet. A local viem
      signer can produce a real transaction but not a Privy session, so the journey runs either
      against the mock API with a real chain signature, or against the real backend by driving the
      actual Privy login in Playwright. The first is easy and proves less.

*Note: a stale-price failure is upstream, not ours — their pusher writes
`/tmp/cope-pusher-status.json` with `ok` and `healthy` flags. Our market badge derives the same
thing from `lastPublishTime` against `maxAgeSec` on-chain, which is the better check from here.*

## 4. Decisions for you

- [ ] **Tweet embeds degrade.** The embed runs in a sandboxed iframe without `allow-same-origin`,
      which blocks X's `widgets.js` (it assigns `document.domain`). The fallback is a styled quote
      card that looks deliberate. Good enough for the demo? The only way to get the full rendered
      tweet is to weaken the sandbox, and I would not.
- [ ] **Notifications inbox** is mock-only and unwired. `PLAN.md` puts push delivery out of scope —
      confirm the in-app inbox is out too, or I build it.
- [ ] **Best Practices is 74**, entirely from Privy: third-party cookies on `auth.privy.io`, a 403
      on their analytics endpoint, and a CSP frame-ancestors rejection when the origin is not
      allowlisted. Nothing we can fix, and Privy is a sponsor requirement. Worth knowing before a
      judge runs Lighthouse.

## 5. Ship

- [ ] Deploy to Vercel; add that origin to Privy. The backend needs no CORS change — we proxy.
- [ ] iOS device pass — install to home screen, and the X OAuth round trip from a standalone
      window. The login screen already warns about this; confirm the warning is right.
- [ ] Demo video, and an architecture diagram for the Arc submission.
- [ ] **Mainnet, by Sept 30** — our half is only the repoint: confirm `GET /chains` serves the
      mainnet addresses, flip `NEXT_PUBLIC_CHAIN_ENV`, re-run the smoke trade.
