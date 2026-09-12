# Workstream 6: An MCP server over the subgraphs

## Why this shape

The Graph's Track 2 is $5,000 and its brief is explicit about what counts:

> Rewards both tooling — new or extended MCP servers, agent SKILLs — and AI agents using The Graph
> as a data source.

> Use The Graph as **load-bearing** infrastructure. Consume live data from a Graph provider. Do
> **meaningful work with the data**: reasoning, decisions, automation, or a natural-language
> interface.

Track 1's disqualifier applies by analogy and is the trap here:

> Simply querying one Subgraph with no composition or standardization does not qualify.

An MCP server that exposes `run_graphql_query` is exactly that trap with a different label. It moves
the querying to the model and does no work of its own. **Every tool in this server has to compute
something the subgraph cannot answer in one query**, or it is a proxy wearing a costume.

Workstream 5 already produced the two things that make this worth building: a standardized ERC-4626
schema with three live deployments, and a Cope Market subgraph with the copy graph in it.

## The tools, and what each one actually computes

| Tool | Computes | Why it is not a proxy |
|---|---|---|
| `vault_overview` | Current TVL, share price, holder count, flows over a window | Decimal-adjusts assets against shares, and says how stale the figure is |
| `vault_history` | Share-price series, drawdown, return over a period, annualised | Drawdown and return are derived across snapshots; neither exists as a field |
| `compare_vaults` | Several vaults side by side, ranked by return | Cross-chain, cross-protocol, over a schema none of them knew they were implementing |
| `top_traders` | Ranked by realised P&L over a window, with win rate | Aggregates position rows the schema stores individually |
| `trader_record` | One trader's record, including what their copiers earned | Joins the copy graph back onto results |
| `copy_lineage` | A position's copy tree and whether copying that author paid | Walks a recursive relation and scores it |

`compare_vaults` is the one that ties the two tracks together. It works against Cope Market's vault,
Moonwell Flagship USDC and Moonwell Flagship ETH with no per-protocol code, because all three are
indexed by the same standardized schema. That is "show what became easier because a shared schema
was used", demonstrated rather than claimed.

## Design rules

**No raw query passthrough.** Not as a convenience tool, not as an escape hatch. It is the one
thing the brief names as insufficient, and shipping it invites a reviewer to conclude the rest is
decoration.

**Read-only, no keys.** The server holds no private key and can send no transaction. An agent
pointed at it can be wrong but cannot be dangerous, and that should be true by construction rather
than by policy.

**Endpoints are configuration.** Any ERC-4626 subgraph following the standardized schema can be
added without code, the same rule the subgraph itself follows. A judge should be able to point it at
a vault we have never seen.

**Answers carry their own caveats.** A share price from the subgraph is as of the last indexed
event, not the block. A tool that returns the number without the timestamp invites a model to state
a stale figure as current, and a model will.

## Steps

| # | Step | Done when |
|---|---|---|
| **6.1** | Scaffold | TypeScript MCP server over stdio, one tool, tests, `npx`-runnable |
| **6.2** | Subgraph layer | Typed queries against the standardized schema, TTL cache, endpoints from config |
| **6.3** | Vault tools | `vault_overview`, `vault_history`, `compare_vaults`, unit-tested on fixtures |
| **6.4** | Trader tools | `top_traders`, `trader_record`, `copy_lineage` |
| **6.5** | SKILL.md and README | An agent can use it from the document alone; install is one command |
| **6.6** | Verification | Every tool run against the three live endpoints, numbers reconciled against the chain |

## Dependencies to resolve before starting

1. **A repository.** `cope-market/mcp`, public. Track 2 requires a public repo with a clear
   README or SKILL.md at its root, and the server is a distinct deliverable from the subgraphs it
   reads.

## Out of scope

The Substreams sub-challenge — deploying a Substreams pipeline from a single prompt — stays out.
Arc publishes no public Substreams endpoint, which is the same wall that closed the composition
route in workstream 5.

Anything that writes. No trade execution, no signing, no key handling. An agent that can open a
position is a different project with a different threat model.
