# Cope Market — Integration Reference

**Audience: the agent building the frontend and the iOS client.** This document is the ground truth
for what exists on-chain and, later, what the API exposes. It is kept up to date as features land.
Read the Status table first. It says what you can build against today.

Do not infer behaviour that this document does not state. If something is missing, ask.

Related documents: [`PLAN.md`](./PLAN.md) for scope and milestones, [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for system design, and the [contracts repo](https://github.com/cope-market/contracts) for source.

---

## Status

Updated 2026-09-12.

| Layer | State | You can build against it |
|---|---|---|
| Contracts on Arc testnet | Deployed and verified | **Yes** |
| API contract, typed client, mock server | Done | **Yes** |
| Price pusher | Runs manually, not yet always-on | Partly. See Market hours. |
| Backend API, real endpoints | Not started | Use the mock |
| Subgraph | Not started | No |

**The API shapes are frozen.** Build against the mock server and the typed client. When the real
endpoints land they answer with the same shapes, so nothing you write against the mock has to
change.

**Chain reads stay direct.** Positions, prices, balances, liquidity-vault state and risk parameters
are read from the contracts with viem and are deliberately not mirrored by the API. The rest of this
document covers those calls.

---

## Using the API

Repository: [cope-market/backend](https://github.com/cope-market/backend).

### Run the mock

No database, no chain, no environment to configure.

```bash
git clone https://github.com/cope-market/backend.git
cd backend && npm ci
npm run mock            # http://localhost:4000/api/v1
PORT=4100 npm run mock  # somewhere else
```

Every route answers with a realistic fixture. Writes are not remembered, so a POST returns a
plausible object but changes nothing. Authenticated routes need an `Authorization: Bearer <anything>`
header; the mock does not inspect the value, it only checks that one is present, which is enough to
exercise your signed-out paths.

CORS is open, so a frontend on another port can call it from a browser.

### Use the typed client

```ts
import {createApiClient} from "@cope-market/backend/lib/api-client/client";

const api = createApiClient({
  baseUrl: "http://localhost:4000/api/v1",
  getAccessToken: async () => privy.getAccessToken(),
});

const {data} = await api.getFeed({query: {tab: "top", limit: 20}});
const {thesis} = await api.getThesis({params: {thesisId: id}});
```

Argument and return types are derived from the same schemas the server validates against, so a call
that compiles is a call the server understands. Responses are parsed before they reach you: if the
server sends the wrong shape the client throws rather than passing it on.

Errors throw `ApiRequestError` with a `code` from a closed set and the HTTP `status`. Switch on
`code`, never on `message`.

### The spec

`public/openapi.json` in the backend repo, also served at `/api/v1/openapi.json`. Valid OpenAPI
3.1, generated from the route definitions, and checked in CI so it cannot drift.

### Routes

26 routes: chain and asset catalogue, auth and profile, follows, tweet embeds, theses with likes and
comments, feed, leaderboard, trade intent and confirm, notifications, devices.

There are deliberately **no** routes for positions, prices, balances or liquidity-vault state. Those
come from the chain.

---

## Chain

| Item | Value |
|---|---|
| Name | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` |
| Native currency | USDC, **18 decimals** |
| Minimum `maxFeePerGas` | 20 gwei. Arc rejects a lower value. |

```ts
import {defineChain} from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {name: "USD Coin", symbol: "USDC", decimals: 18},
  rpcUrls: {default: {http: ["https://rpc.testnet.arc.io"]}},
  blockExplorers: {default: {name: "Arcscan", url: "https://testnet.arcscan.app"}},
});
```

### USDC has two decimal representations

This is the most common way to be wrong by a factor of 1e12 on Arc. Read both sentences.

- The **native** balance (`eth_getBalance`) has **18 decimals**. It pays gas.
- The **ERC-20** view at `0x3600000000000000000000000000000000000000` has **6 decimals**. It is the
  same balance, truncated.

Every contract in this protocol takes and returns 6-decimal amounts. Use the ERC-20 balance in the
user interface. Use the native balance only to tell the user if they can pay gas.

Measured on a live account: `eth_getBalance` returned `11705898898359212279` and ERC-20 `balanceOf`
returned `11705898`.

Do not read `totalSupply()` on the USDC contract. It returns a value that matches neither decimal
scale. Nothing here uses it.

---

## Contracts

All three are verified. Source is on the explorer.

| Contract | Address |
|---|---|
| `SyntheticVault` | [`0x2c720283A8Bbb5CC5b13C0C4Bcf2300826286c47`](https://testnet.arcscan.app/address/0x2c720283A8Bbb5CC5b13C0C4Bcf2300826286c47) |
| `LiquidityVault` | [`0x0ffABC4e80125C5742D5ed04Cc1fD1b634Bc3C5d`](https://testnet.arcscan.app/address/0x0ffABC4e80125C5742D5ed04Cc1fD1b634Bc3C5d) |
| `PushOracle` | [`0x0f2d191fEC3bB2DEEd8cE3E326193fd9b5203277`](https://testnet.arcscan.app/address/0x0f2d191fEC3bB2DEEd8cE3E326193fd9b5203277) |
| USDC | `0x3600000000000000000000000000000000000000` |

These addresses are stable. Two earlier deployments were replaced. Both causes are fixed.

---

## Assets

Four feeds are live. A feed is identified by a `bytes32` Pyth feed id.

| Symbol | Class | Feed id |
|---|---|---|
| EUR/USD | FX | `0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
| XAU/USD | Metal | `0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2` |
| BTC/USD | Crypto | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| TSLA/USD | Equity | `0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1` |

Read the live list with `SyntheticVault.enabledFeeds()`. Do not hard-code it. The list can change.

Do not add other Pyth feeds. Our Hermes key is entitled to these four only. AAPL, SPY and NVDA
return HTTP 403 and would appear as permanently broken markets.

### Market hours

FX, metals and equities stop publishing when their market closes. Crypto does not.

When a feed is stale, `open` and `close` revert with `StalePrice`. This is correct behaviour, not a
bug. Show the asset as "market closed" and disable the trade button. Measured on a Saturday:
EUR/USD was 13 hours stale, TSLA 10 hours, and BTC was current.

**Demo on BTC outside market hours.** It is the only feed that publishes 24 hours a day.

---

## Units

Get these wrong and every number in the user interface is wrong.

| Quantity | Decimals | Example |
|---|---|---|
| USDC amounts: collateral, payout, LP assets | **6** | `2000000` is 2 USDC |
| Prices, confidence, P&L, liability, open interest | **18** (wad) | `77355490580460000000000` is 77,355.49 |
| `units` on a position | **18** | quantity of the synthetic asset |
| LP shares | **18** | `30000000000000000000` is 30 shares |
| `bps` fields | 1 bps = 0.01% | `10` is 0.10% |

LP shares are 18-decimal while the asset is 6-decimal. This is deliberate. It stops small deposits
rounding to zero.

---

## Reading state

### Position

```solidity
function positions(uint256 tokenId) external view returns (Position memory);

struct Position {
    bytes32 feedId;
    bool    isLong;
    uint64  openedAt;      // unix seconds
    uint128 collateral;    // USDC, 6 dec, NET of the open fee
    uint256 units;         // 1e18
    uint256 entryPrice;    // 1e18, already skewed against the trader
    address author;        // who opened it; does not change if the NFT is sold
    uint256 copiedFromId;  // origin tokenId, or 0
    address copyAuthor;    // receives the author fee, or the zero address
    uint16  authorFeeBps;
}
```

`positions` reverts with `UnknownPosition` for a token that never existed or was closed. Handle the
revert. It does not return an empty struct.

`collateral` is net of the open fee. Show the user the amount they paid, not this value, unless you
label it as collateral at risk.

### Other reads

| Call | Returns |
|---|---|
| `SyntheticVault.enabledFeeds()` | `bytes32[]` of live feed ids |
| `SyntheticVault.assetConfig(bytes32)` | see Risk parameters below |
| `SyntheticVault.openInterest(bytes32 feedId, bool isLong)` | USD wad, valued at average entry |
| `SyntheticVault.liability(bytes32)` | `int256` USD wad. Positive means the pool owes traders. |
| `SyntheticVault.balanceOf(address)` | number of positions held. It is an ERC-721. |
| `LiquidityVault.totalAssets()` | USDC, 6 dec, net of what the pool owes open positions |
| `LiquidityVault.maxWithdraw(address)` | USDC the holder can take out now, after the exit fee |
| `PushOracle.getPrice(bytes32 feedId, uint256 maxAge)` | `(price, conf, publishTime)`. Reverts if stale. |
| `PushOracle.lastPublishTime(bytes32)` | `uint64`, or 0 if never written |

To show a price without risking a revert, call `lastPublishTime` first. If the age is above the
asset's `maxAgeSec`, the market is closed.

---

## Writing state

### Open a position

```solidity
function open(
    bytes32 feedId,
    bool    isLong,
    uint128 collateral,    // USDC, 6 dec, gross. The fee is taken from this.
    uint256 copiedFromId,  // 0 for an original position
    bytes[] updateData     // pass an empty array
) external payable returns (uint256 tokenId);
```

1. The user approves `SyntheticVault` to spend USDC.
2. Call `open`. Send zero value. `PushOracle` rejects a non-zero value.
3. Read the `PositionOpened` event for the `tokenId`.

`updateData` is an empty array today because the oracle is a push oracle. When Arc fixes its Pyth
deployment, the backend will supply this. Keep the parameter.

### Close a position

```solidity
function close(uint256 tokenId, bytes[] updateData) external payable;
```

The caller must own the position or be approved for it. The payout goes to the current owner.

### Liquidity provision

`LiquidityVault` is a standard ERC-4626 vault. Use `deposit`, `mint`, `withdraw` and `redeem`.
`previewRedeem` and `previewWithdraw` already account for the 0.10% exit fee, so the numbers they
return are what the user receives.

### Copy a position

Pass the origin `tokenId` as `copiedFromId`. The contract records the origin author and pays them a
share of the copy's profit when it closes. The origin position must still be open.

The copy opens at the current price, not at the author's entry price. Show both.

---

## Risk parameters

`assetConfig(bytes32)` returns these. Read them. Do not assume the values below stay fixed.

| Field | Current value | Meaning |
|---|---|---|
| `enabled` | `true` | Trading is allowed |
| `maxAgeSec` | `600` | A price older than this rejects the trade |
| `maxConfBps` | `100` | Reject if oracle confidence is above 1% of price |
| `openFeeBps` | `10` | 0.10%, taken from collateral |
| `closeFeeBps` | `10` | 0.10%, taken from exit notional |
| `maxOiUsd` | `250000e18` | Open interest cap per side |
| `maxPositionUsd` | `25000e18` | Cap per position |

Protocol-level: `SyntheticVault.authorFeeBps()` is `1000` (10% of a copy's profit).
`LiquidityVault.exitFeeBps()` is `10` (0.10%).

---

## Errors

Decode the revert and show a specific message. Each selector is stable.

| Selector | Error | What to tell the user |
|---|---|---|
| `0xaffad796` | `StalePrice(feedId, age, maxAge)` | Market is closed. Try a crypto market. |
| `0xe30f9765` | `PriceUnavailable(feedId)` | No price yet for this asset. |
| `0x29333f88` | `AssetDisabled(feedId)` | This market is not open for new positions. |
| `0x622f6a9c` | `ConfidenceTooWide(feedId, bps, maxBps)` | Price is too uncertain right now. |
| `0x255d1cd7` | `PositionTooLarge(feedId, usd, maxUsd)` | Above the per-position cap. |
| `0x8f31a741` | `OpenInterestCapExceeded(...)` | This side of the market is full. |
| `0xebb1e0ba` | `ZeroCollateral()` | Enter an amount. |
| `0xc46babb1` | `ZeroUnits()` | Amount is too small for this price. |
| `0x606840e0` | `NotPositionOwner(tokenId, caller)` | You do not own this position. |
| `0xa2016c11` | `UnknownPosition(tokenId)` | Position does not exist or is closed. |
| `0x0b5454a2` | `PositionHealthy(...)` | Position is not liquidatable. |
| `0xa17e11d5` | `InsufficientLiquidity(wanted, available)` | Pool cannot cover this payout yet. |

---

## Things that will surprise you

1. **Entry price is not the market price.** The contract moves the price against the trader by the
   oracle confidence interval. A long enters above mid. A short enters below mid. Show the quoted
   entry, not the mid, or the user will think the trade filled badly.
2. **Payout follows the NFT. The author fee does not.** If a position is transferred, the new holder
   receives the payout on close. The author fee still goes to the original author.
3. **Closing always works.** Disabling an asset or lowering a cap blocks new positions only. It never
   traps an open one.
4. **A losing position can pay out zero.** It never pays out a negative amount and the user never
   owes more than their collateral.
5. **The pool can refuse a winning close.** If `LiquidityVault` cannot cover the payout it reverts
   with `InsufficientLiquidity`. The position stays open and can be closed later.
6. **Gas is USDC.** A user with USDC but no separate gas token can still trade. There is no second
   asset to fund.

---

## Changelog

- **2026-09-12** — API contract frozen. Typed client and mock server available; 26 routes, OpenAPI
  3.1 spec generated and checked in CI. Chain reads stay direct.
- **2026-09-12** — First version. Contracts deployed and verified on Arc testnet.
