# Workstream 8: The price pusher as a service

## Why this is not already done

`script/price-pusher.sh` works. It has pushed every price this project has ever traded on. What it
is not is a service: it is a shell script somebody runs in a terminal, and when that terminal closes
the vault stops having prices.

That is the single most dangerous dependency in the demo. With `PushOracle`, a price is whatever was
last written; nothing can open and nothing can close without it. The liquidation keeper made this
visible on its first live run, reporting `StalePrice` on every position — not a keeper problem, a
pusher problem, and one nobody had noticed.

## What is actually wrong with the script

Not the arithmetic. The scaling to WAD, the strictly-increasing publish time check and the
market-closed handling are all correct and carry over unchanged in substance.

**Nothing tells you it stopped.** The worst failure is silence: the process dies, every price goes
stale, and the first symptom is a trade reverting during a demo.

**A failed push is logged and forgotten.** "will retry next cycle" forever is the same as no
alerting at all.

**The interval is unchecked.** The comment says "keep well under the vault's `maxAgeSec`" and
nothing enforces it. `maxAgeSec` is readable on chain per asset.

**The feed list is hard-coded.** `enabledFeeds()` is on chain. A feed enabled in the vault but
absent from the script is an asset users can select and never trade, and nothing would say so.

**A successful transaction is treated as a successful push.** The two are not the same: what matters
is whether the oracle is now fresh enough for the vault to accept, which is a different question and
a readable one.

**Four runtimes.** bash, curl, python3 and cast, with `awk` parsing cast's output — which has
already caused one bug, noted in the script itself, where `cast`'s `[1.789e9]` annotation was parsed
as a timestamp.

## Where it lives

`contracts/services`, which is `contracts/keeper` renamed.

The keeper already has the parts this needs: the Arc chain definition, the 20 gwei gas floor, the
config loader, the revert classifier, the logging shape and a systemd story. Building a second
package beside it would mean duplicating all of that or importing across two package roots. Two jobs
in one package, with two entrypoints and two systemd units, is the ordinary arrangement.

The rename is a `git mv` in its own commit with no behaviour change, so the diff that follows is
about the pusher rather than about moving files.

## Steps

| # | Step | Done when |
|---|---|---|
| **8.1** | Rename and share | `contracts/services` hosts the keeper unchanged, with chain, config and logging shared |
| **8.2** | Hermes client | Fetch, parse and scale to WAD, tested against saved payloads rather than the network |
| **8.3** | Push planning | Feeds from `enabledFeeds()`, non-newer dropped, never stamped into the future, tested |
| **8.4** | Execution | `pushMany` with the gas floor, and a push confirmed by reading the oracle back |
| **8.5** | The service | Interval checked against `maxAgeSec`, consecutive failures escalated, heartbeat, systemd unit |
| **8.6** | Verification | Running against Arc testnet: feeds fresh, a trade opens, and the keeper stops reporting `StalePrice` |

## Decisions to settle first

**Which feeds.** From `enabledFeeds()` on chain, intersected with the Hermes key's entitlements.
The intersection is the part worth reporting: a feed enabled in the vault that the key cannot fetch
is an asset users can pick and never trade, and today nothing says so. One unentitled feed also
fails the whole Hermes request, so the intersection is a correctness requirement and not only a
diagnostic.

**What counts as success.** Not a mined transaction. After pushing, the oracle is read back and each
feed's age compared against that asset's `maxAgeSec`. That is the question the vault will ask.

**Failure escalation.** A single failed cycle is noise — Hermes rate-limits, RPCs blink. Sustained
failure is an outage. The service counts consecutive failures and changes its log level rather than
repeating the same line at the same volume forever.

**One instance only.** Two pushers share a key and race nonces. A lock, so the second exits with a
clear message instead of producing intermittent failures nobody can explain.

**`--stamp-now` survives, with its warning.** It publishes under chain time rather than the real
market time, which keeps a demo tradeable when FX and equity markets are closed. It asserts a
freshness the data does not have, so it stays opt-in, stays loud, and stays documented as such.

**The bash script stays** until the service has run for a demo. Deleting a thing that works before
its replacement has proved itself is how a demo ends up with neither.

## Out of scope

Alerting anywhere other than the log. A heartbeat file and an exit code are enough for systemd to
restart it and for a human to see; wiring a pager is a different project.

Pyth's pull path. When Arc fixes its Wormhole guardian set this whole service is deleted rather than
improved.
