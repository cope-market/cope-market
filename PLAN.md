# Cope Market — Implementation Plan

## Context

Cope Market is a social trading app for people who follow real-world events on X. A user posts an event-driven financial thesis (fomo-style, but for macro/stock/forex events rather than memecoins), attaches a real on-chain position in a tokenized real-world asset, and others can read the feed, watch live P&L, and copy the position. Assets live where they exist on-chain: EUR exposure as EURC on Circle's Arc chain, US stocks as Robinhood Stock Tokens on Robinhood Chain.

The repo is empty (README only). v1 is a PWA. A native iOS app will follow later and must reuse the same backend, so the backend is built API-first from day one.

### Decisions made with the user
- Real on-chain swaps in v1, no paper trading.
- Privy auth with X login and an embedded EVM wallet (one address serves both chains). X handle/avatar used for profiles.
- Chains at launch: Arc (EURC/USDC) + Robinhood Chain (stock tokens).
- Social loop: thesis post + one-tap copy that opens a pre-filled trade sheet the user confirms and signs.
- Stack: Next.js App Router + TypeScript + Tailwind + Serwist PWA, Supabase Postgres, viem. Deploy on Vercel.
- No geo-gating in v1 (keep a hook; Robinhood tokens are barred for US/UK/CA/CH persons).
- Events come from pasted tweet URLs rendered via X's free oEmbed. No paid X API.
- Two clients, one backend: everything goes through a versioned JSON API; the PWA is client #1.
- **Testnet only until the full flow works.** No mainnet tokens at any size during development. Mainnet cutover is a separate, later step (M7) after the user says go.
- User has a Uniblock subscription (optional for balances/tx history) and an OpenSea key (not useful here; OpenSea swap API doesn't cover these chains).

### Verified external facts (as of 2026-09-10)
| Item | Fact |
|---|---|
| Arc mainnet | Public mainnet launches **Sept 16, 2026**. Mainnet chain ID and addresses unpublished until then. |
| Arc testnet | Chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, explorer `https://testnet.arcscan.app`, faucet `https://faucet.circle.com` |
| Arc gas | Native token is USDC with **18 decimals** natively; ERC-20 view at `0x3600000000000000000000000000000000000000` uses 6 decimals. Gas floor 20 gwei `maxFeePerGas`. |
| Arc EURC (testnet) | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 dec). Permit2 at canonical address. |
| Arc FX venues | StableFX is institution-only (KYB), not usable. Circle ships `@circle-fin/swap-kit` (USDC↔EURC on Arc, viem adapter, optional API key). Uniswap v4, Aerodrome, and a StableSwap AMM deploy at mainnet. |
| Robinhood Chain | Mainnet since July 2026. Arbitrum Orbit L2, chain ID `4663`, RPC `https://rpc.mainnet.chain.robinhood.com`; testnet `46630`, `https://rpc.testnet.chain.robinhood.com`. Gas in ETH. |
| Stock tokens | 450+ ERC-20s, freely transferable, trade on Uniswap v3/v4, PancakeSwap, Pons. **1inch Swap API supports chain 4663** (Classic + Fusion). 0x and LiFi also support it. |
| ERC-8056 | Tokens expose `uiMultiplier()`; UI shares = raw / 10^dec × multiplier. Corporate actions change the multiplier, not balances. |
| Robinhood REST | Unauthenticated `https://api.robinhood.com/rhj/`: `GET /assets`, `GET /prices/{symbol}` (raw underlying bid/ask, **not** multiplier-adjusted), `GET /corporate-actions`. 60 rps, 15s cache. |
| Privy | `loginMethods: ['twitter']`, embedded EVM wallets, custom chains via viem `defineChain` in `supportedChains`. Has a Swift SDK for the future iOS client. |

---

## Architecture principles

1. **API-first.** All reads, writes, quotes and trade-building live under `app/api/v1/**` as route handlers with bearer-token auth. No server actions, no RSC-only data loading for core data. The PWA calls the API through a typed client generated from the same zod schemas.
2. **Server builds, client signs.** Chain adapters run server-side and return unsigned `{chainId,to,data,value}` transaction requests. Clients only sign/send with their Privy wallet and post the tx hash back. Server verifies receipts on-chain; client-reported amounts are never trusted.
3. **Adapters are the only place chain differences live.** One `VenueAdapter` interface, two implementations (Arc, Robinhood), env-switched testnet/mainnet config.
4. **Fewest moving parts.** Supabase Postgres, Vercel Cron for periodic jobs, no queues, no websockets (15s polling for marks).

---

## Repo layout

```
app/
  layout.tsx                      # PrivyProvider, React Query, PWA meta, tab bar
  manifest.ts, sw.ts              # PWA manifest + Serwist service worker
  (public)/login/page.tsx
  (app)/feed, post/new, p/[id], u/[handle], leaderboard, trade, wallet
  api/v1/
    openapi.json/route.ts         # generated OpenAPI 3.1 spec
    auth/session/route.ts         # POST: verify Privy token, upsert user
    me/route.ts                   # GET profile, PATCH bio
    me/devices/route.ts           # POST register push token (web-push now, APNs later)
    events/oembed/route.ts        # POST tweet url -> cached oEmbed
    assets/route.ts               # GET catalog
    prices/route.ts               # GET ?assetIds= -> marks
    theses/route.ts, theses/[id]/route.ts, theses/[id]/like, theses/[id]/comments
    users/[handle]/route.ts, users/[handle]/follow/route.ts
    feed/route.ts                 # GET ?tab=latest|top|following&cursor=
    leaderboard/route.ts
    positions/[id]/route.ts
    trades/intent/route.ts        # POST: quote + unsigned txs -> trade row (pending)
    trades/[id]/confirm/route.ts  # POST tx hash -> verify receipt, apply fill
    wallet/balances/route.ts      # GET per-chain USDC/asset/gas balances
    cron/snapshot-prices, cron/refresh-leaderboard, cron/reconcile-trades, cron/refresh-assets
lib/
  api-schema/                     # zod schemas for every request/response; source of OpenAPI + client types
  api-client/                     # thin typed fetch wrapper used by the PWA (attaches Privy token)
  auth/privy-server.ts            # verifyRequest(req) -> { userId, privyId, wallet }
  auth/privy-client.tsx           # PrivyProvider config, useWalletClient()
  chains/arc.ts, chains/robinhood.ts   # viem defineChain, env-switched
  venues/types.ts                 # VenueAdapter + Asset/Quote/TxRequest/Fill
  venues/arc.ts                   # swap-kit or direct pool
  venues/robinhood.ts             # 1inch Swap API (+ direct ERC-20 approve)
  venues/registry.ts              # assetId -> adapter
  prices/robinhood.ts, prices/fx.ts, prices/index.ts
  pnl.ts, ranking.ts              # pure, unit-tested
  db/server.ts (service role), db/queries/*.ts, db/types.ts (generated)
  geo.ts                          # returns allowed:true; called on trade intent
components/                       # TradeSheet, PositionCard, TweetEmbed, PnlBadge, InstallPrompt
supabase/migrations/0001_init.sql
scripts/seed-assets.ts
tests/unit/*.test.ts, tests/e2e/*.spec.ts
env.example
```

Packages: `next@15`, `react@19`, `tailwindcss@4`, `@serwist/next`, `viem@2`, `@privy-io/react-auth`, `@privy-io/server-auth`, `@circle-fin/swap-kit`, `@supabase/supabase-js`, `@tanstack/react-query@5`, `zod`, `@asteasolutions/zod-to-openapi`, `vitest`, `@playwright/test`. Supabase CLI for migrations and `supabase gen types`. No ORM.

`NEXT_PUBLIC_CHAIN_ENV=testnet|mainnet` selects chain IDs, RPCs, token/router addresses. Nothing outside `lib/chains` and `lib/venues/registry.ts` knows the environment.

---

## API contract

- Auth: `Authorization: Bearer <Privy access token>`. `lib/auth/privy-server.ts` calls `privy.verifyAuthToken` (local verification, no network), maps `privyId` → `users` row, upserts on first login with X handle/avatar/wallet from `privy.getUser`. The Privy Swift SDK exposes the same access token, so iOS authenticates identically.
- Route registry: `lib/api-schema/routes.ts` holds `defineRoute({ method, path, auth, params?, query?, body?, response, operationId })` for every endpoint. Handlers wrap it with `defineHandler(route, impl)` (validates input, verifies JWT, formats errors); the typed client derives method/path/types from the same object; the OpenAPI doc is folded from the registry. One definition, three consumers.
- Errors as `{ error: { code, message } }` with stable codes (`INSUFFICIENT_BALANCE`, `LOW_GAS`, `QUOTE_EXPIRED`, `ASSET_HALTED`, `GEO_BLOCKED`, `UNAUTHORIZED`, `VALIDATION`).
- OpenAPI 3.1 generated via zod-to-openapi, written to `public/openapi.json` by `scripts/gen-openapi.ts` (committed; CI fails if stale) and served at `/api/v1/openapi.json`. Conventions for clean Swift codegen: bigints as decimal strings, ISO-8601 dates, `operationId` everywhere, no `oneOf` responses, cursor pagination as `{ data, nextCursor }`.
- Import boundary (lint rule): page/component code imports only `lib/api-client` and `lib/api-schema`, never `lib/db`, `lib/venues`, or `lib/api-server`. Client-side chain code is limited to viem `sendTransaction` and `waitForTransactionReceipt`.
- Push: `devices` stores `{platform: 'web'|'ios', token, webPushKeys?}`; `notifications` rows are inserted by `apply_fill` and social actions now and read by an in-app inbox. Delivery (web-push VAPID, APNs) is deferred to v1.1.

Core endpoints (all under `/api/v1`):
| Method | Path | Purpose |
|---|---|---|
| GET | `chains` | Chain config (chainId, rpc, explorer, native currency, USDC address) so iOS builds chain config from the server |
| POST | `auth/session` | Verify token, upsert user, return profile |
| GET | `me`, `users/{handle}` | Profiles with open/closed positions and stats |
| POST/DELETE | `users/{handle}/follow` | Follow graph |
| POST | `events/oembed` | `{tweetUrl}` → cached event `{id, html, author}` |
| GET | `assets` | Catalog (chain, symbol, address, multiplier, status) |
| GET | `prices?assetIds=` | Marks, 15s cache |
| GET | `feed?tab=&cursor=` | Ranked feed |
| POST/GET | `theses`, `theses/{id}` | Create/read thesis (stance, asset, event, body) |
| POST/DELETE | `theses/{id}/like`; POST/GET `theses/{id}/comments` | Social |
| GET | `wallet/balances` | USDC, asset, gas per chain + `enoughGas` flags |
| POST | `trades/quote` | Non-persisted quote for live preview while the user types an amount |
| POST | `trades/intent` | `{assetId, side, amountIn, slippageBps, thesisId?, copyOfPositionId?}` → `{tradeId, quote, txs: TxRequest[], expiresAt}` |
| POST | `trades/{id}/confirm` | `{txHashes: Hex[]}` → verified fill + updated position |
| GET | `trades/{id}` | Poll until `confirmed`/`failed` (needed on iOS backgrounding or if confirm timed out) |
| POST | `trades/{id}/cancel` | Only while `pending` |
| GET | `positions/{id}` | Position with live P&L and trades |
| POST | `positions/{id}/close-intent` | `{fraction?}` → sell trade intent with txs, server computes amount |
| GET/POST | `notifications`, `notifications/read` | In-app inbox |
| POST/DELETE | `devices`, `devices/{id}` | Push token registration (web now, iOS later) |
| GET | `leaderboard?window=7d|30d|all` | From the `leaderboard` table |

---

## Venue adapter interface (`lib/venues/types.ts`)

```ts
export type ChainKey = "arc" | "robinhood";
export interface Asset { id: string /* "arc:EURC" | "robinhood:AAPL" */; chain: ChainKey; kind: "fx"|"stock";
  symbol: string; name: string; address: Address; decimals: number;
  quote: { symbol: "USDC"; address: Address; decimals: 6 }; logoUrl?: string; status: "active"|"halted"|"delisted" }
export interface Mark { assetId: string; priceUsd: number; uiMultiplier: number; source: string; at: Date }
export type Side = "buy" | "sell";   // buy = USDC -> asset, sell = asset -> USDC. Positions are long or flat only.
export interface QuoteRequest { asset: Asset; side: Side; amountIn: bigint; taker: Address; slippageBps: number }
export interface Quote { asset: Asset; side: Side; tokenIn: Address; tokenOut: Address; amountIn: bigint; amountOut: bigint;
  minAmountOut: bigint; unitPriceUsd: number; priceImpactBps?: number; route: string; expiresAt: Date; raw?: unknown }
export interface TxRequest { chainId: number; to: Address; data: Hex; value?: string; gas?: string; label: "approve"|"swap" }
export interface Fill { txHash: Hex; amountIn: bigint; amountOut: bigint; unitPriceUsd: number; gasCostNative: bigint; blockNumber: bigint }

export interface VenueAdapter {
  chain: ChainKey; chainId: number; publicClient: PublicClient;
  listAssets(): Promise<Asset[]>;
  getMark(asset: Asset): Promise<Mark>;
  getBalance(asset: Asset, owner: Address): Promise<bigint>;
  getQuoteBalance(owner: Address): Promise<bigint>;                 // USDC, 6-dec raw
  getGasBalance(owner: Address): Promise<{ raw: bigint; symbol: string; enoughForSwap: boolean }>;
  quote(req: QuoteRequest): Promise<Quote>;
  buildSwapTxs(q: Quote): Promise<TxRequest[]>;                     // server-side, unsigned; approve first if needed
  parseFill(q: Quote, receipt: TransactionReceipt): Promise<Fill>;  // from Transfer logs; the only source of truth
  expectedSpenders(): Address[];                                    // receipt.to must be one of these
  explorerTx(hash: Hex): string;
  toUi(asset: Asset, raw: bigint, multiplier?: number): number; fromUi(asset: Asset, ui: number, multiplier?: number): bigint;
}
```

### Arc adapter (`lib/venues/arc.ts`)
- `defineChain` with `nativeCurrency: { symbol: "USDC", decimals: 18 }`; enforce `maxFeePerGas >= 20 gwei` in returned `TxRequest` gas hints.
- USDC amounts are always 6-decimal via the ERC-20 interface at `0x3600…0000`. `getGasBalance` reads the native 18-dec balance separately. Unit test that the two never mix.
- `quote`/`buildSwapTxs`: preferred path is swap-kit's quote + prepare/calldata API if it exposes one (verify, R3). Fallback: read the USDC/EURC StableSwap (or Uniswap v4 at mainnet) pool directly with viem and build router calldata + Permit2/ERC-20 approve. Do not use swap-kit's client-side `kit.swap()` in the final design because iOS can't run it; acceptable only as a temporary v0 shortcut behind the same `trades/intent` contract.
- `getMark(EURC)`: DEX quote of 100 USDC → EURC inverted (actual exit price), sanity-checked against `https://api.frankfurter.app` EUR/USD; Chainlink EUR/USD on Arc if a feed exists.

### Robinhood adapter (`lib/venues/robinhood.ts`)
- `defineChain` for 4663 / 46630, ETH gas.
- `listAssets`: seeded from Robinhood `GET /assets` filtered to chain 4663 and active; stored in `assets`; refreshed daily by cron.
- `getMark`: `GET /prices/{symbol}` mid of bid/ask; halted → block buys.
- Multiplier: read `uiMultiplier()` with 60s cache, cross-check `/assets.multipliers`.
- Two execution backends behind the same adapter, selected by env:
  - **Testnet (46630, now):** Uniswap v3 QuoterV2 + SwapRouter02 called directly with viem. The official Robinhood testnet faucet dispenses test stock tokens (TSLA, AMZN, NFLX, …) plus test ETH; testnet USDC from the same faucet or QuickNode/Chainlink faucets. Seed `assets` from the faucet token list (local JSON with addresses read from the explorer) since the Robinhood REST `/assets` list is mainnet-only. If USDC/stock pools with depth don't exist on testnet, create them ourselves: a `scripts/seed-testnet-pools.ts` viem script that calls the v3 `NonfungiblePositionManager` to create and fund USDC/TSLA etc. pools from faucet balances. Marks on testnet come from the pool quote (Robinhood REST prices for the real symbol can be shown as a reference).
  - **Mainnet (4663, M7):** 1inch Swap API `GET /swap/v6.0/4663/quote` and `/swap` calldata; `allowance` check → ERC-20 `approve(1inch router, max)` first if needed. Uniswap v3 direct stays as fallback (R1).
- `parseFill`: Transfer logs; `gasCostNative = gasUsed × effectiveGasPrice`.

---

## Database (`supabase/migrations/0001_init.sql`)

Tables (key columns only):
- `users(id, privy_id uq, x_handle uq, x_name, x_avatar_url, wallet_address uq, bio, created_at)`
- `devices(id, user_id, platform 'web'|'ios', token, created_at)` and `notifications(id, user_id, kind, payload jsonb, read_at, created_at)`
- `events(id, tweet_url uq, tweet_id, author_handle, author_name, oembed_html, oembed_json, fetched_at)`
- `assets(id pk 'arc:EURC', chain, kind, symbol, name, address, decimals, quote_address, quote_decimals, logo_url, status, ui_multiplier, multiplier_updated_at, meta jsonb)`
- `theses(id, user_id, event_id, asset_id, stance 'bullish'|'bearish', title, body, copied_from_thesis_id, like_count, comment_count, copy_count, created_at)`
- `positions(id, user_id, thesis_id, asset_id, status 'open'|'closed', qty_raw numeric(78,0), cost_basis_usd, realized_pnl_usd, entry_price_usd, exit_price_usd, entry_multiplier, opened_at, closed_at, copied_from_position_id)` with unique index on `(user_id, asset_id) where status='open'`
- `trades(id, user_id, position_id, thesis_id, copy_of_position_id, asset_id, side, status 'pending'|'submitted'|'confirmed'|'failed'|'cancelled'|'expired', quote_json, txs_json, tx_hashes text[], swap_tx_hash uq, amount_in_raw, amount_out_raw, unit_price_usd, ui_multiplier, block_number, gas_cost_native, error, expires_at, created_at, confirmed_at)`
- `follows(follower_id, followee_id)`, `likes(user_id, thesis_id)`, `comments(id, user_id, thesis_id, body, created_at)`
- `price_snapshots(asset_id, price_usd, ui_multiplier, source, at)` pk `(asset_id, at)`
- `leaderboard(user_id pk, realized_pnl_usd, unrealized_pnl_usd, total_pnl_usd, open_positions, closed_positions, win_rate, refreshed_at)` plain table refreshed by cron

Views: `latest_marks` (distinct on asset), `position_pnl` (open positions joined to marks: `qty_ui = qty_raw / 10^dec × ui_multiplier`, `unrealized = qty_ui × mark − cost_basis`).

Function: `apply_fill(trade_id, amount_in, amount_out, unit_price, multiplier, tx_hash, block, gas)` plpgsql, atomic: update trade → upsert/adjust position using avg-cost math (mirrors `lib/pnl.ts`) → bump `copy_count` if `copied_from_position_id`.

Auth model: Privy JWT verified in route handlers; all writes via the service-role client (server-only). RLS enabled on every table with public-read policies only (trades readable only when `confirmed`); no anon write policies. Ownership checks in handlers.

---

## P&L

Pure functions in `lib/pnl.ts` (unit tested, and the SQL in `apply_fill` must match):
- Buy: `qty += out; cost_basis += in_usd; entry = cost_basis / qty_ui`.
- Sell: `avg = cost_basis / qty_ui; realized += proceeds − avg × sold_ui; cost_basis −= avg × sold_ui; qty −= in`. `qty == 0` → closed, `exit = proceeds / sold_ui`.
- Unrealized from `position_pnl`. Gas shown per trade, excluded from P&L in v1.
- Multiplier changes revalue automatically because `qty_raw` is stored raw; entry price is re-expressed as `entry × (mult_at_entry / mult_now)` in the UI.
- Marks: client polls `prices` every 15s via React Query. Cron `snapshot-prices` every 5 min for assets with open positions (+EURC). Cron `refresh-leaderboard` every 5 min runs one upsert SQL. If Vercel plan limits cron cadence, use Supabase `pg_cron` + `pg_net` hitting the same endpoints with `CRON_SECRET`.

---

## Trade flow

1. Client: `GET wallet/balances` → show funding CTA if USDC or gas insufficient.
2. Client (debounced): `POST trades/intent` → server runs `geo.check`, `adapter.quote`, `adapter.buildSwapTxs`, stores `trades` row `pending` with `quote_json` + `txs_json`, returns quote + unsigned txs (30s expiry).
3. Client signs/sends each `TxRequest` in order with the Privy wallet client (`switchChain` first). Approve then swap on Robinhood; Arc typically one tx if Permit2 signature is folded in (else approve + swap).
4. Client: `POST trades/{id}/confirm {txHash}` → server marks `submitted`, `waitForTransactionReceipt` (route `maxDuration = 60`), verifies `receipt.from == wallet` and `to == expected router`, `parseFill`, calls `apply_fill`. Returns updated position.
5. Thesis linking: from `/post/new` the thesis row is created first (no position), trade runs, then position gets `thesis_id`. Bearish theses have no position (long/flat model); if the user holds the asset, offer "Sell to flat".
6. Cron `reconcile-trades` re-checks `submitted` rows older than 2 min; `failed` on revert or after 30 min missing.

Close = same flow with `side='sell'`, `amountIn = qty_raw` or partial.

**Funding (v1):** `/wallet` shows the address as QR with per-chain instructions. Arc: send USDC on Arc (gas is USDC, one asset suffices); testnet faucet link; CCTP bridge link at mainnet. Robinhood: needs USDC + a little ETH; link canonical Orbit bridge and Relay/LiFi (verify 4663 support); "Gas low" banner under ~0.0005 ETH. Don't depend on Privy `useFundWallet` for custom chains. v1.1: Privy smart wallets + paymaster to remove the ETH requirement.

---

## Feed and copy

- `lib/ranking.ts`: `score = (1 + likes + 3·copies + 2·comments + 5·clamp(|pnl_pct|,0,1)) / (age_h + 2)^1.4`, computed in SQL for `tab=top`; `latest` by `created_at`; `following` filtered by `follows`. Cursor pagination.
- Copy: "Copy" → `/trade?copy=<positionId>&thesis=<thesisId>` → TradeSheet pre-filled (asset, buy, amount = min(original notional, balance), 25/50/100% chips, original entry vs current). On fill: `copied_from_position_id`, `copy_count++`, auto-created lightweight thesis (`copied_from_thesis_id`, same event, stance) so the copy appears in feed and profile.

---

## PWA

- `manifest.ts`: standalone, `start_url: /feed`, maskable icons, `id: "/"`.
- Serwist: precache static; `NetworkFirst` for feed/prices; `NetworkOnly` for `api/v1/trades/*`, `auth/*`, anything with `Authorization`. Disabled in dev.
- iOS: `viewport-fit=cover`, apple meta tags, 180px touch icon, safe-area padding on tab bar, 16px inputs. Install prompt: `beforeinstallprompt` on Android; one-time "Add to Home Screen" sheet on iOS Safari.
- Known iOS risk: X OAuth may complete in Safari rather than the standalone PWA (separate storage). Test on device in M0; mitigation is "log in before installing".

---

## Milestones

- **M0 Scaffold**: Next + Tailwind + Serwist + Privy X login + embedded wallet; `auth/session`; Supabase project + `0001_init.sql`; zod schemas + OpenAPI route; typed API client; `wallet/balances` on both testnets; `env.example`.
- **M1 Events + theses**: oEmbed cache, thesis create with asset picker (seeded `assets`), latest feed, thesis page, profiles.
- **M2 Arc trade**: `VenueAdapter`, Arc adapter, `trades/intent` + `confirm`, `apply_fill`, TradeSheet, position card with live P&L. First end-to-end buy + close of EURC on Arc testnet.
- **M3 Robinhood trade (testnet 46630)**: claim faucet stock tokens + ETH + USDC; Robinhood adapter via direct Uniswap v3, approve + swap, multiplier handling (check whether test tokens implement `uiMultiplier()`; default to 1 if absent). Spike first: is Uniswap v3 deployed on testnet and do USDC/stock pools exist? If pools are missing, run `seed-testnet-pools.ts` (R2). Robinhood REST marks and the 1inch path are wired but only exercised at M7.
- **M4 Social + P&L**: follows, likes, comments, price snapshot cron, leaderboard cron + page, profile positions.
- **M5 Copy + ranking**: copy prefill, `copy_count`, auto-thesis, top/following tabs.
- **M6 Hardening + PWA**: install prompt, iOS device pass, reconcile cron, error states (halted, low gas, stale quote), Playwright suite, push-token registration endpoint. Freeze the `v1` spec here: additive changes only from this point so the Swift client stays compatible.
- **M7 Mainnet cutover (only after the user says go, and after Sept 16)**: fill Arc mainnet chain ID/USDC/EURC/router into `lib/chains/arc.ts` + registry; switch Robinhood adapter to 1inch + Robinhood REST marks; `NEXT_PUBLIC_CHAIN_ENV=mainnet`; re-seed assets; $1 smoke trade per chain; testnet stays as a Vercel preview env.

---

## Verification

- Unit (vitest): `pnl.ts`, `ranking.ts`, decimal/multiplier helpers, `parseFill` against saved receipt fixtures, OpenAPI spec builds, zod schemas round-trip.
- M0: X login on desktop + iPhone Safari; `users` row has handle/avatar/wallet; both RPCs return block numbers; faucet USDC shows as 6-dec balance with native gas shown separately.
- M2: buy 1 USDC → EURC on Arc testnet; `trades.status='confirmed'` and `amount_out_raw` matches arcscan; sell back; `realized_pnl_usd ≈ −spread`. Force a stale quote and a rejected signature; no orphan positions.
- M3: same on Robinhood; approve once, swap once; `qty_ui` matches Robinhood's display for a token with multiplier ≠ 1.
- M4: hit cron endpoints manually with `CRON_SECRET`; leaderboard totals equal sum over positions (SQL assertion test).
- M5: copy from a second account; `copy_count` increments; copier profile shows position.
- E2E (Playwright, nightly): `NEXT_PUBLIC_E2E=1` injects a funded testnet key via viem in place of the Privy UI; login → post thesis → real small trade on Arc testnet → P&L → copy from second user → leaderboard.
- PWA: Lighthouse PWA audit passes; installs on Android and iOS; service worker never caches `api/v1/trades`.
- API reuse check (the iOS proof): a `tests/api` script with no browser walks quote → intent → sign with a viem local account → confirm → poll, using a test-mode JWT accepted by `privy-server.ts` only outside production. Spec lint via `redocly lint`; optionally run `swift-openapi-generator` in CI to prove the spec generates.

---

## Risks to verify first (spike before M2/M3)

- **R1** 1inch API on 4663: quote/swap endpoints return calldata for a USDC→stock pair with depth; else Uniswap v3 direct.
- **R2** Robinhood testnet 46630 has faucet stock tokens (per user), but Uniswap v3 deployment and USDC/stock pool liquidity there are unverified. Fallback ladder: use existing pools → seed our own pools from faucet balances → deploy v3 factory/router ourselves if absent. Never mainnet during development.
- **R3** swap-kit exposes a server-side quote + calldata path (not only `kit.swap()`); else read the StableSwap/Uniswap v4 pool directly.
- **R4** ERC-8056 `uiMultiplier()` ABI and direction, checked against a post-split token.
- **R5** Arc mainnet params unpublished until Sept 16; all in env/registry.
- **R6** Privy custom chain with 18-dec USDC native currency and `switchChain`; X OAuth inside iOS standalone PWA.
- **R7** Chainlink EUR/USD on Arc existence; Robinhood REST staleness vs DEX price; halted stocks.
- **R8** Vercel cron cadence on the plan tier; fallback pg_cron.
- **R9** `lib/geo.ts` reads `req.geo.country` and returns allowed today; gating US/UK/CA/CH on Robinhood assets is a one-line change later.
