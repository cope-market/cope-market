# Cope Market — Implementation Plan

## Context

Cope Market is a social trading app for people who follow real-world events on X. A user posts an
event-driven financial thesis (fomo-style, but for macro, FX, metals and equities rather than
memecoins), attaches a real on-chain position, and others read the feed, watch live P&L, and copy the
position with one tap.

v1 is a PWA. A native iOS app follows later and must reuse the same backend, so the backend is
built API-first from day one.

**The project is built for ETHOnline 2026.** Arc mainnet deployment by **Sept 30, 2026** is a hard
commercial deadline — $5,000 of the Arc prize pool is contingent on it.

---

## Decisions

### Product

- **Arc-only.** Robinhood Chain is dropped (see "Why Robinhood was dropped").
- **Synthetic positions, not tokenized RWAs.** Exposure is minted against a USDC pool at an oracle
  price. We do not issue, custody, or bridge any tokenized security.
- **Asset classes at launch: FX, metals, equities.** All three on testnet. Mainnet asset list is a
  config decision made separately (see "Legal posture").
- **Long and short.** The old long/flat limitation is gone; bearish theses are real positions.
- Social loop unchanged: thesis post + one-tap copy that opens a pre-filled sheet the user signs.
- Copy attribution and author profit-share settle on-chain, not in the database.

### On-chain

- **Design A — oracle-priced vault.** A USDC pool is counterparty to every trader. Positions carry
  their own entry price. Rejected: tracker shares (no shorts, no per-holder entry price), event
  escrow (needs a counterparty, breaks one-tap copy), collateralized debt synths (too complex).
- **Positions are ERC-721.** Minted on open, burned on close. ERC-20 fungibility is incompatible
  with per-position entry price — two AAPL longs opened at different prices are not interchangeable.
- **LPs supply the USDC via an ERC-4626 vault.** Trader losses and fees become LP yield.
- **Pyth is the primary oracle**, Chainlink is the mainnet fallback, both behind one
  `IPriceOracle` interface plus a mock for tests.
- 1x leverage only in v1. Liquidation exists for shorts (unbounded loss) and as a safety net.

### Off-chain

- Privy auth with X login and an embedded EVM wallet. X handle/avatar for profiles.
- Stack: Next.js App Router + TypeScript + Tailwind + Serwist PWA, Supabase Postgres, viem,
  Foundry for contracts. Deploy on Vercel.
- Events come from pasted tweet URLs rendered via X's free oEmbed. No paid X API.
- Two clients, one backend: everything through a versioned JSON API; the PWA is client #1.
- Server builds unsigned transactions, client signs. Server verifies receipts on-chain.
- The Graph indexes the vault contracts; the subgraph is the source of truth for P&L and
  leaderboard, replacing the price-snapshot and reconcile cron jobs.

### Hackathon partners (3 max)

| Partner | Pool | Angle |
|---|---|---|
| **Arc** | $10,000 | Stablecoin-native DeFi: synthetic FX venue, LP liquidity, on-chain copy settlement. Two open tracks. |
| **The Graph** | $15,000 | Subgraph over the vault. ERC-4626 vault flows are named in their Track 1 brief as a standard worth supporting. |
| **Privy** | $5,000 | "Best financial flow" — X login, embedded wallet, full open/close trade flow. |

Uniswap Foundation was considered and dropped when Robinhood was cut; no Uniswap code remains in
scope. 1inch, ENS, Ledger, Hedera, World, Chainlink and Bazantic do not fit the build.

---

## Why Robinhood was dropped

Verified 2026-09-12. Four independent blockers, any one of which is expensive:

1. **No Arc ↔ Robinhood bridge exists.** LI.FI lists Arc but returns `Chain 5042 is not supported`.
   Relay has no Arc entry at all. Even if one appears after Arc mainnet launch, testnet bridging
   will not exist, so the flow could not be built or demoed during development.
2. **Robinhood Chain has no USDC.** Its stablecoin is USDG (Paxos). CCTP therefore cannot be the
   bridge, and the whole `quote: USDC` assumption in the old adapter interface was wrong.
3. **Robinhood is not a hackathon sponsor.** Zero prize money for half the engineering effort.
4. The original R2 risk stands: Uniswap v3 deployment and USDC/stock pool depth on testnet 46630
   were never verified.

Synthetic exposure via Pyth gives us the same equities — 1,249 feeds — on one chain, with no bridge,
no second stablecoin, and no third-party liquidity dependency.

---

## Verified external facts (as of 2026-09-12)

### Arc

| Item | Fact |
|---|---|
| Mainnet | Chain ID **`5042`**. Public launch **Sept 16, 2026**. |
| Testnet | Chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, explorer `https://testnet.arcscan.app`, faucet `https://faucet.circle.com` |
| Gas | Native token is USDC with **18 decimals** natively; the ERC-20 view at `0x3600000000000000000000000000000000000000` uses 6 decimals. Gas floor 20 gwei `maxFeePerGas`. |
| USDC (mainnet) | `0x3600000000000000000000000000000000000000` (6 dec) |
| EURC (mainnet) | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` (6 dec) |
| EURC (testnet) | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 dec) |
| Token ecosystem | Arc mainnet lists three tokens: USDC, EURC, cirBTC. This is why synthetics are necessary. |
| Oracle providers | Arc docs list Chainlink, Chronicle, Pyth, RedStone, Stork. |

### Oracles

| Item | Fact |
|---|---|
| Pyth on Arc testnet | `0x2880aB155794e7179c9eE2e38200202908C17B43` — **verified live** via `eth_getCode` (177 bytes, proxy). |
| Pyth on Arc mainnet | Not yet published. `0x2880aB...` is Pyth's canonical cross-chain address, so the same address is likely. **Confirm on Sept 16.** |
| Pyth coverage | 1,249 equity feeds (`Equity.US.AAPL/USD`, `TSLA`, `NVDA`, `SPY`, …), FX (`FX.EUR/USD` and 6 more EUR pairs), metals, crypto. |
| Pyth access | Feed metadata is public. **Price updates from Hermes now require a Pyth Pro API key** (`unauthorized` without one). Signup step, not a blocker. |
| Chainlink on Arc mainnet | **30 feeds already published with addresses.** EUR/USD `0xDd5B15443cd733D3966a50a3E48cB7DF9Fb5DE0D`, EURC/USD `0x361b95c10b76Ca3f35C686d423e43A951755Bf23`, PAXG/USD `0xD7a3C3E82867e606f21A1fEa9b38cF4f34B96D2a`, plus JPY/AUD/CAD/MXN/BRL/KRW and crypto majors. **No equities.** |
| Chainlink on Arc testnet | None published (404). This is why Pyth is primary — it is live where we develop. |

This resolves the old **R7** (Chainlink EUR/USD on Arc): it exists, address known.

### The Graph

| Network | CAIP-2 | Subgraphs | Substreams / Firehose |
|---|---|---|---|
| Arc Mainnet | `eip155:5042` | Studio deploy | firehose defined, no public endpoint |
| Arc Testnet | `eip155:5042002` | Studio deploy | same |

`issuanceRewards: false` on both — deploy via Subgraph Studio, which the prize brief explicitly
accepts.

### Privy

`loginMethods: ['twitter']`, embedded EVM wallets, custom chains via viem `defineChain` in
`supportedChains`. Swift SDK exists for the future iOS client.

---

## Scope

### In

- `SyntheticVault` (ERC-721 positions), `LiquidityVault` (ERC-4626), `PythOracle` adapter
- Open, close, liquidate, copy-with-attribution, author profit share
- LP deposit and withdraw
- PWA: login, feed, thesis post, trade sheet, position cards, profiles, leaderboard, LP page
- Subgraph over both contracts
- Arc testnet throughout development; Arc mainnet by Sept 30

### Out (v1.1+)

- Leverage above 1x
- Native iOS client (the API is built to serve it, but it is not built)
- Push delivery (web-push VAPID, APNs) — token registration endpoint only
- Transferable-position secondary market UI (the NFT is transferable; we ship no marketplace)
- Funding rates, cross-margin, portfolio margining

---

## Legal posture

Synthetic exposure to named equities is a derivative. For the hackathon:

- Testnet carries FX, metals and equities.
- **Mainnet asset list is a separate, deliberate decision.** The default is FX, metals and crypto
  only — these avoid the securities question entirely and suit event-driven macro theses.
  Equities on mainnet require an explicit go from the user.
- Position size and open-interest caps are enforced in the contract, not the UI.
- `lib/geo.ts` keeps the existing hook and returns `allowed: true` today.
- The README states plainly that the LP pool is seeded by the team and that the system is a
  hackathon demo. Judges reward disclosed simplification and punish hidden insolvency.

---

## Milestones

18 days, Sept 12 → Sept 30. Mainnet is the deadline, not the stretch goal.

| # | Milestone | Dates | Exit criteria |
|---|---|---|---|
| **M0** | Scaffold | Sep 12–13 | Next + Tailwind + Serwist + Privy X login; Foundry project; Supabase + `0001_init.sql`; zod schemas + OpenAPI route; typed client; `env.example` |
| **M1** | Vault contracts on Arc testnet | Sep 14–16 | `SyntheticVault` + `PythOracle` deployed; open and close a long and a short on `FX.EUR/USD` and `Equity.US.AAPL/USD` from a Foundry script; full unit suite green |
| **M2** | Trade flow end to end | Sep 16–18 | `trades/intent` returns an unsigned tx with the Pyth update blob embedded; Privy signs; `trades/{id}/confirm` parses `PositionOpened`; position card shows live P&L |
| **M3** | Social layer | Sep 18–20 | oEmbed cache, thesis create with asset picker, latest feed, thesis page, profiles, follows, likes, comments |
| **M4** | Copy + settlement | Sep 20–22 | Copy from a second account mints a position with `copiedFrom` and `copyAuthor`; closing in profit pays the author on-chain |
| **M5** | LiquidityVault | Sep 22–24 | ERC-4626 deposit/withdraw; aggregate NAV nets open-position liability; exit fee; utilization cap; LP page |
| **M6** | Subgraph + leaderboard | Sep 24–25 | Subgraph deployed to Studio on Arc testnet; feed P&L and leaderboard read from it; price-snapshot and reconcile crons deleted |
| **M7** | Hardening + PWA + demo | Sep 25–27 | Install prompt, iOS device pass, error states (stale price, wide confidence, cap hit, insufficient NAV), Playwright suite, architecture diagram, demo video |
| **M8** | **Mainnet cutover** | Sep 28–30 | Confirm Pyth at `0x2880aB...` on chain 5042; deploy contracts; seed LP pool; enable the mainnet asset list; $1 smoke trade; submit |

Tiering inside the contract work, so a slip does not sink the submission:

1. **Must have** — `SyntheticVault` with ERC-721 positions, Pyth oracle, staleness and confidence
   guards, caps. Pool seeded by the team, disclosed.
2. **High value** — `LiquidityVault` ERC-4626 with aggregate NAV, exit fee, utilization cap.
3. **If time** — skew fee scaling with imbalance, liquidation caller reward, withdrawal cooldown.

Tier 1 alone is a complete, demoable product. Tier 2 is what makes it a protocol.

---

## Risks

| # | Risk | Mitigation |
|---|---|---|
| **R1** | Pyth not deployed on Arc **mainnet** at launch. Only testnet is confirmed. | `IPriceOracle` adapter makes Chainlink a config flip. Chainlink's 30 Arc mainnet feeds are already published. Confirm with `eth_getCode` on Sept 16. |
| **R2** | Pyth Pro API key provisioning is slow or gated. | Apply on day 1. Fallback: Chainlink push feeds on mainnet, mock oracle on testnet. |
| **R3** | Vault insolvency — one-sided flow drains the pool. | Per-asset and global OI caps, per-position size cap, seeded pool, disclosed in README. Skew fee if time. |
| **R4** | Oracle staleness outside market hours lets a user trade a Friday close on Sunday. | `getPriceNoOlderThan(maxAge)` enforced in the contract, not the UI. Assets marked closed when stale. **Not optional — without it the vault is drainable.** |
| **R5** | Latency arbitrage: the pull model lets a user choose when to post an update. | Open and close fees (10–20 bps) wider than typical drift; tight `maxAge` (10–30s); reject wide confidence; always skew price against the user by `conf`. |
| **R6** | Arc mainnet contract addresses and behaviour unknown until Sept 16. | Everything in env + registry. Only `lib/chains` and the deploy script know the environment. |
| **R7** | Arc's 18-dec native USDC vs 6-dec ERC-20 view causes a decimal bug. | Normalize to 1e18 internally, convert only at the USDC boundary. Dedicated unit tests that the two never mix. |
| **R8** | Privy custom chain with 18-dec native currency, and X OAuth inside an iOS standalone PWA. | Test on device in M0. Mitigation for OAuth: "log in before installing". |
| **R9** | Shorts have unbounded loss. | `liquidate(id)` permissionless at 90% collateral loss, small caller reward, called by cron as backstop. |
| **R10** | Subgraph indexing lag makes the feed look stale. | Contract reads for the user's own position; subgraph for feed, leaderboard and history. |

---

## Verification

**Unit (Foundry)**
- P&L math for long and short, open and close, at profit and loss
- Average-entry accounting across multiple opens and partial closes
- NAV nets liability correctly; LP cannot deposit or withdraw at a stale NAV
- Staleness rejection, confidence rejection, cap rejection
- Liquidation threshold exactness at the boundary
- Fixed-point: 6-dec USDC against 1e18 internals, fuzzed

**Unit (vitest)**
- `pnl.ts` mirrors the Solidity exactly (same fixtures, both suites)
- `ranking.ts`, OpenAPI spec builds, zod schemas round-trip
- Pyth update-blob parsing against saved Hermes payloads

**Integration**
- M1: open long + short on FX and equity feeds from a Foundry script against Arc testnet
- M2: trade sheet → Privy signature → confirm → position row matches on-chain state
- M4: copy from a second account; closing in profit pays `copyAuthor`; assert balances
- M5: LP deposits, trader loses, LP share price rises; LP deposits, trader wins, it falls
- M6: subgraph leaderboard equals a direct contract read (assertion test)

**E2E (Playwright, nightly)**
`NEXT_PUBLIC_E2E=1` injects a funded testnet key via viem in place of the Privy UI:
login → post thesis → open position on Arc testnet → P&L → copy from a second user → close →
leaderboard.

**API reuse check (the iOS proof)**
A `tests/api` script with no browser walks quote → intent → sign with a viem local account →
confirm → poll, using a test-mode JWT accepted by `privy-server.ts` only outside production.
Spec lint via `redocly lint`.

**PWA**
Lighthouse PWA audit passes; installs on Android and iOS; the service worker never caches
`api/v1/trades`.

---

## Submission mapping

| Requirement | Where it is satisfied |
|---|---|
| Arc — functional MVP + architecture diagram | This plan + `ARCHITECTURE.md` + deployed PWA |
| Arc — meaningful use of Arc and USDC | USDC is collateral, quote asset, and gas |
| Arc — advanced programmable money flows | Conditional copy settlement, multi-step open with oracle update, LP NAV netting |
| Arc — mainnet by Sept 30 | M8 |
| The Graph — live data from a Graph provider | Subgraph on Arc via Subgraph Studio |
| The Graph — meaningful work with the data | Feed ranking, leaderboard, copy lineage graph |
| Privy — core integration, ≥1 wallet, ≥1 financial flow | X login, embedded wallet, open/close position |
| All three — public repo + demo video | Required at M7 |

---

See `ARCHITECTURE.md` for contract interfaces, math, invariants, data model, API contract and the
threat model.
