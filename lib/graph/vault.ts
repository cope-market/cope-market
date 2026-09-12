import {z} from "zod";
import {BigIntString, VAULT_SUBGRAPH, lower, query} from "./client";

/// Queries against the standardized ERC-4626 subgraph. Nothing Cope-specific appears in it — it
/// indexes any tokenized vault, and ours is simply one of them.
///
/// Its `totalAssets` is what the contract said at `lastUpdatedBlock`, not what it says now: the
/// pool's assets move as traders win and lose against it, and none of that emits a log. For a live
/// figure the app calls `LiquidityVault.totalAssets()`; this is for history.

const VaultSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  totalAssets: BigIntString,
  totalShares: BigIntString,
  sharePrice: z.string(),
  lastUpdatedBlock: BigIntString,
});

export type VaultSummary = z.infer<typeof VaultSchema>;

export async function vaultSummary(address: string): Promise<VaultSummary | null> {
  const {vault} = await query(
    VAULT_SUBGRAPH,
    `query Summary($id: ID!) {
      vault(id: $id) { id name symbol decimals totalAssets totalShares sharePrice lastUpdatedBlock }
    }`,
    {id: lower(address)},
    z.object({vault: VaultSchema.nullable()}),
  );
  return vault;
}

const SnapshotSchema = z.object({
  day: z.number(),
  timestamp: BigIntString,
  totalAssets: BigIntString,
  totalShares: BigIntString,
  sharePrice: z.string(),
  dailyDepositedAssets: BigIntString,
  dailyWithdrawnAssets: BigIntString,
});

export type VaultSnapshot = z.infer<typeof SnapshotSchema>;

/// Daily history, oldest first so a chart can be drawn straight from it.
///
/// Snapshots exist only for days that had activity. A quiet day produces no row at all, so a
/// consumer has to carry the previous value forward rather than read the gap as a fall to zero.
export async function vaultSnapshots(address: string, days = 90): Promise<VaultSnapshot[]> {
  const {vaultDailySnapshots} = await query(
    VAULT_SUBGRAPH,
    `query Snapshots($vault: String!, $days: Int!) {
      vaultDailySnapshots(
        where: {vault: $vault}
        orderBy: day
        orderDirection: desc
        first: $days
      ) {
        day timestamp totalAssets totalShares sharePrice dailyDepositedAssets dailyWithdrawnAssets
      }
    }`,
    {vault: lower(address), days},
    z.object({vaultDailySnapshots: z.array(SnapshotSchema)}),
  );
  return [...vaultDailySnapshots].reverse();
}

/// Fills the gaps between snapshots by carrying the last known value forward, which is what
/// actually happened: a day with no deposit or withdrawal is a day the vault did not change size.
export function carryForward(snapshots: readonly VaultSnapshot[]): VaultSnapshot[] {
  if (snapshots.length === 0) return [];

  const filled: VaultSnapshot[] = [];
  let previous = snapshots[0] as VaultSnapshot;

  for (const snapshot of snapshots) {
    for (let day = previous.day + 1; day < snapshot.day; day += 1) {
      filled.push({
        ...previous,
        day,
        timestamp: previous.timestamp + BigInt(day - previous.day) * 86_400n,
        dailyDepositedAssets: 0n,
        dailyWithdrawnAssets: 0n,
      });
    }
    filled.push(snapshot);
    previous = snapshot;
  }
  return filled;
}
