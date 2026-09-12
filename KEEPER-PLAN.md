# Workstream 7: The liquidation keeper

## Why this exists

`SyntheticVault.liquidate` is written, tested and deployed. Nothing calls it.

That gap is not cosmetic. The contract's own comment says why the function is there:

> A long at 1x cannot lose more than its collateral, but a short's loss is unbounded, so without
> this the pool would absorb the tail.

An underwater short currently stays open until its owner chooses to close it, which is exactly when
they will not. The loss accrues against the LP pool, and `liquidate` being permissionless means
anybody *could* close it — but on a chain nobody else is watching, "permissionless" means "nobody".

## The one design decision that matters

**The keeper simulates `liquidate` rather than reimplementing its health check.**

The alternative is to read the position, read the oracle, and recompute `_quoteClose` and the
threshold off-chain. That reproduces contract arithmetic in another language, which is the same
mistake the Solidity-versus-TypeScript P&L parity test exists to catch — except here a drift shows
up as a keeper that either misses liquidations or burns gas on reverts, and neither announces
itself.

`eth_call` against `liquidate` runs the contract's real logic against real state. It succeeds
exactly when a transaction would, and when it fails it fails with the contract's own error. There
is no second implementation to keep in step.

## Discovery comes from the chain, not the subgraph

`nextTokenId` is public and `ownerOf` reverts for a burned token, so the open set is derivable from
the chain alone. That matters more here than the convenience of a ready-made query: a subgraph is
behind by design, and a keeper that cannot see a position is a keeper that cannot liquidate it.

The subgraph stays useful as a scale optimisation later — it can pre-filter to positions worth
simulating — but the keeper must not depend on it being up.

## Where it lives

`contracts/keeper`, beside `price-pusher.sh`.

Not in the backend. The backend deliberately holds no key: it returns unsigned transactions and the
user signs them. Putting a funded key into that process changes its threat model for the sake of
tidiness. The contracts repo already has a `PRIVATE_KEY` in its `.env` for deployment and price
pushing, already has the ABIs, and is already where the other always-on process lives — so the
keeper joins that story rather than starting a new one.

## Steps

| # | Step | Done when |
|---|---|---|
| **7.1** | Scaffold | A TypeScript service with config from env, viem wired to Arc, and tests |
| **7.2** | Discovery | The open position set read from the chain, with closed ids remembered |
| **7.3** | Health by simulation | `eth_call` classifies each position, and every contract error is understood rather than swallowed |
| **7.4** | Execution | Liquidation sent, confirmed, and the race with another keeper handled |
| **7.5** | The loop | Interval, dry run, structured logs, and a systemd unit for the VPS |
| **7.6** | Verification | Run against Arc testnet: healthy positions skipped, and a real position liquidated end to end |

## Decisions to settle before starting

**Reward against gas.** A liquidation pays 1% of collateral. On a 2 USDC position that is 0.02 USDC,
and Arc's gas floor is 20 gwei. The keeper should report when a liquidation costs more than it pays
rather than silently declining — on testnet it should still act, because the point is bounding LP
risk and not earning the reward, but an operator has to be able to see the economics.

**Errors are classified, never swallowed.** `PositionHealthy` is the normal case and means skip.
A stale price means the oracle has not been pushed and the keeper can do nothing until it is — a
different condition entirely, and one worth alerting on, because it means trading is also broken.
An unrecognised revert must be logged loudly rather than treated as "not liquidatable".

**One transaction at a time.** Several liquidatable positions in one tick is a nonce race against
itself. Sequential is slower and correct; parallel is faster and occasionally drops transactions.

**A dry run that is actually dry.** The default should simulate and report without sending, so the
first thing anyone runs cannot spend money.

## How verification will work

The deployed positions are roughly 0.03% underwater against a 90% threshold, so nothing is
liquidatable on Arc testnet today and waiting for that to change is not a plan.

Verification will temporarily lower `liquidationThresholdBps` on the testnet deployment, liquidate a
real position end to end, and restore the parameter. That exercises the real function, the real
oracle path, the real reward transfer and the real event — and it changes a parameter rather than a
price, so nothing about the vault's accounting is falsified in the process.

## Out of scope

Folding the price pusher into this service. It is tempting — both need a key, a loop, and a systemd
unit, and the pusher being a bash script is a known weak point — but it is a separate change with
its own risk, and the keeper is what was asked for.
