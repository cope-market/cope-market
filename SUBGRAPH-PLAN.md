# Workstream 5: A standardized ERC-4626 vault subgraph

## Why this shape

The Graph's Track 1 is explicit that a bespoke subgraph does not qualify:

> Simply querying one Subgraph with no composition or standardization does not qualify.

Qualifying needs either two composed Graph products or **meaningful work on a standardized schema**.
Composition is closed to us: Arc has subgraph support but no public Substreams endpoint, and dropping
Robinhood removed the cross-chain pipeline the original plan relied on. So the route is
standardization, which their brief names directly:

> Contributing a new composable Substreams module for an emerging standard, such as **ERC-4626
> tokenized-vault flows**, also counts.
> Authoring or extending a **Standardized Subgraph** … is in scope.

`LiquidityVault` is ERC-4626. The qualifying build is therefore **a schema for any ERC-4626 vault**,
instantiated on ours — not a schema for ours that happens to be a vault. Those produce different
code, and only the first scores.

## Two subgraphs, not one

Mixing Cope Market's positions and copy graph into the standardized schema would undermine the claim
that it is standardized. So:

| Subgraph | Contents | Purpose |
|---|---|---|
| `erc4626-vault` | Only what the ERC-4626 standard defines: deposits, withdrawals, share transfers, per-account positions, TVL and share-price history | The Track 1 submission. Reusable against any vault. |
| `cope-market` | Positions, copy lineage, author fees, realised P&L, leaderboard inputs | The product. Feeds the backend. |

The second is what makes `realizedPnlUsd` and `winRate` stop being zeros.

## Design rules for the standardized schema

**Nothing Cope-specific may appear in it.** No feed ids, no theses, no positions. If a field would
not make sense on a Yearn or Morpho vault, it does not belong.

**Follow Messari's vault conventions** where they exist. Their brief names Messari Standardized
Subgraphs as the reference, and matching established naming is what makes a schema standard rather
than merely generic.

**Configuration, not code, selects the vault.** Address, network and start block come from a
manifest template. Deploying against a different vault must be a config change.

**Amounts are `BigInt`, values are `BigDecimal`.** Share price and TVL need division; token amounts
must not.

## Steps

| # | Step | Done when |
|---|---|---|
| **5.1** | Scaffold | graph-cli project, codegen, and matchstick running on an empty suite |
| **5.2** | Standardized schema | Vault, Account, VaultPosition, Deposit, Withdraw, Transfer and snapshot entities, with nothing Cope-specific in them |
| **5.3** | Mappings | ERC-4626 Deposit and Withdraw handled, positions and counters maintained, unit-tested with matchstick |
| **5.4** | Share transfers and snapshots | Secondary share movement tracked; hourly and daily TVL and share price |
| **5.5** | Deploy and verify | Indexed on Arc testnet via Subgraph Studio, queried live, numbers agreeing with the contract |
| **5.6** | Prove it is generic | A second instance against a different ERC-4626 vault, from config alone |
| **5.7** | Cope-specific subgraph | Positions, copies, author fees and realised P&L |
| **5.8** | Wire the backend | Leaderboard and profile stats read real P&L instead of returning "0" |
| **5.9** | Verification | Both subgraphs live, the backend serving real numbers, and the standards claim demonstrable |

## Dependencies to resolve before starting

1. **A repository.** `cope-market/subgraph`, so the Track 1 submission is a clean public repo rather
   than a directory inside the backend.
2. **A Subgraph Studio account and deploy key.** Same external lead-time risk as the Privy secret
   and the Pyth key. Worth starting now.

## Out of scope

The MCP server is workstream 6, conditional on this landing cleanly. It is what would open Track 2,
and sequencing it after means a slip costs the speculative track rather than the solid one.
