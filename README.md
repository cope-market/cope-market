# Cope Market

Social trading of real-world events, on [Arc](https://www.arc.network). Post a thesis about
something that just happened, back it with a real on-chain position, and copy the ones you believe.
Copy attribution and the author's profit share settle in the contract, not in a database.

Built for ETHOnline 2026. **The liquidity pool is seeded by the team, the contracts are unaudited,
and everything here runs on Arc testnet. This is a demonstration, not a venue.**

This repository is the progressive web app. The rest of the system lives alongside it:

| Part | Repository | State |
|---|---|---|
| Contracts | `cope-market/contracts` | Deployed and verified on Arc testnet |
| API | `cope-market/backend` | 26 routes, OpenAPI 3.1, shapes frozen |
| Subgraphs | `cope-market/subgraphs` | A standardized ERC-4626 schema, and a Cope-specific one |

[`INTEGRATION.md`](./INTEGRATION.md) is the ground truth for what exists on-chain and what the API
serves. [`ARCHITECTURE.md`](./ARCHITECTURE.md) covers the contracts, the maths and the threat model.
[`PLAN.md`](./PLAN.md) is scope and milestones.

## Running it

```bash
npm install
cp env.example .env.local     # nothing in it is secret
npm run dev                   # http://localhost:3000
```

The app needs an API to talk to. Until the backend is deployed, run its mock — no database, no
chain, no configuration:

```bash
git clone https://github.com/cope-market/backend.git ../cope-market-backend
cd ../cope-market-backend && npm ci && PORT=4000 npm run mock
```

`BACKEND_ORIGIN` points at it, and `next.config.ts` proxies `/api/v1/*` there so every request is
same-origin and CORS never enters the picture.

Chain reads need nothing configured: Arc testnet's RPC and both subgraph endpoints are public.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit suite, including the P&L parity tests |
| `npm run check` | Types, lint, formatting, tests, and the vendored API contract |
| `npm run verify:chain` | Reads the live deployment the way the app does, and prints it |
| `npm run verify:graph` | Runs every subgraph query the app uses against the live indexers |
| `npm run shot -- /markets` | Screenshots a route at phone size |
| `npm run api:sync` | Re-copies the API contract from the backend |

## How it is put together

Three sources answer three different questions, and every screen says which one it is using.

**The chain** answers what is true now: prices, positions, balances, the pool's assets, every risk
parameter. There are deliberately no API routes for any of it. `lib/chain` reads it with viem
through Multicall3, which is deployed at the canonical address on Arc.

**The API** answers what a chain cannot: who someone is, what they wrote, who follows whom, and the
cached embed of the post they were reacting to. It also builds every transaction that touches the
protocol and verifies the receipt afterwards, so a client-reported fill is never taken at face
value.

**The subgraphs** answer what happened: closed positions, realised P&L, the copy graph, the pool's
history. An indexer lags by design, so nothing built on one is described as current.

### The API contract is vendored, not depended on

`lib/api` is copied verbatim from the backend by `scripts/sync-api.ts`, and `npm run api:check`
fails if it has drifted. That keeps the zod schemas — and so runtime validation of every response —
without making this repository's build depend on a private one.

### P&L is computed here, and it has to match the contract

`lib/trade/pnl.ts` mirrors `SyntheticVault._quoteClose` to the wei, and `lib/trade/quote.ts` is
shared with the server. Every serious bug in a system like this lives in the gap between the
contract's arithmetic and the interface's, so the tests assert against settlements read back off
Arc testnet rather than against our own reading of the source.

### Things the interface is careful about

- **USDC has two decimal scales on Arc.** The native balance has 18 decimals and pays gas; the
  ERC-20 view has 6 and is what every contract takes. `lib/format.ts` names the scale in every
  function and there is no formatter that takes an unlabelled amount. A lint rule stops a bigint
  becoming a JavaScript number anywhere that has not justified it.
- **Entry price is not the mark.** The contract moves the price against the trader by the oracle's
  confidence interval. The trade sheet shows the entry, and says why.
- **A closed market is the protocol working.** FX, metals and equities stop publishing out of
  hours, and the contract rejects a trade on a stale price. Freshness is judged against the chain's
  clock, not the browser's.
- **`n/a` and `0` are different.** A trader with no closed positions has no win rate. A pool with
  one snapshot has no return. Neither is zero, and neither is shown as zero.
- **P&L belongs to the author, not the holder.** A position NFT can be sold; `author` never
  changes. Rankings and attribution use it.
- **The service worker never caches a price or a trade.** A stale quote is worse than no quote.

## What is not built

Leverage above 1x, a native iOS client (the API is built to serve one), push delivery, and any
secondary market for position NFTs. See `PLAN.md`.
