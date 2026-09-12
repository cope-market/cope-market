#!/usr/bin/env tsx
/// Runs every subgraph query the app uses against the live indexers and prints what came back.
///
/// The queries are the app's own, so this is a check that the documents are valid, the schemas
/// parse real responses, and the numbers agree with what the chain settled.

import {
  closedPositionsBy,
  copiesOf,
  positionsHeldBy,
  traderRecord,
  winRate,
} from "../lib/graph/cope";
import {vaultSnapshots, vaultSummary} from "../lib/graph/vault";
import {formatPnlWad, formatUsdc6, formatWad, shortAddress} from "../lib/format";

const TRADER = process.argv[2] ?? "0xeeb3e0999D01f0d1Ed465513E414725a357F6ae4";
const VAULT = "0x0ffABC4e80125C5742D5ed04Cc1fD1b634Bc3C5d";

async function main(): Promise<void> {
  const record = await traderRecord(TRADER);
  console.log(`trader ${shortAddress(TRADER)}`);
  if (!record) {
    console.log("  no history — not a trader who broke even, a trader who has not traded");
  } else {
    const rate = winRate(record);
    console.log(
      `  opened ${record.positionsOpened}  closed ${record.positionsClosed}  liquidated ${record.positionsLiquidated}`,
    );
    console.log(`  realised P&L   ${formatPnlWad(record.realizedPnlWad)} USD`);
    console.log(
      `  win rate       ${rate === null ? "n/a — nothing closed" : `${(rate * 100).toFixed(0)}%`}`,
    );
    console.log(`  copies made ${record.copiesMade}  received ${record.copiesReceived}`);
    console.log(`  author fees    ${formatUsdc6(record.authorFeesEarned)} USDC`);
  }

  const open = await positionsHeldBy(TRADER);
  console.log(`\nopen positions held: ${open.length}`);
  for (const position of open) {
    console.log(
      `  #${position.tokenId}  ${position.isLong ? "LONG " : "SHORT"}  ` +
        `${formatUsdc6(position.collateral)} USDC  entry ${formatWad(position.entryPrice)}  ` +
        `copies ${position.copyCount}`,
    );
  }

  const closed = await closedPositionsBy(TRADER);
  console.log(`\nclosed positions authored: ${closed.length}`);
  for (const position of closed) {
    console.log(
      `  #${position.tokenId}  ${position.status.padEnd(10)} ` +
        `P&L ${formatPnlWad(position.realizedPnlWad ?? 0n).padStart(9)} USD  ` +
        `paid out ${formatUsdc6(position.payout ?? 0n)} USDC`,
    );
  }

  const first = open[0] ?? closed[0];
  if (first) {
    const copies = await copiesOf(first.tokenId);
    console.log(`\ncopies of #${first.tokenId}: ${copies.length}`);
    for (const copy of copies) {
      console.log(`  #${copy.tokenId} by ${shortAddress(copy.author.id)}  ${copy.status}`);
    }
  }

  const summary = await vaultSummary(VAULT);
  console.log(`\nERC-4626 vault ${shortAddress(VAULT)}`);
  if (!summary) {
    console.log("  not indexed");
  } else {
    console.log(`  ${summary.name} (${summary.symbol})`);
    console.log(
      `  total assets   ${formatUsdc6(summary.totalAssets)} USDC   as of block ${summary.lastUpdatedBlock}`,
    );
    console.log(`  total shares   ${formatWad(summary.totalShares)}`);
    console.log(`  share price    ${summary.sharePrice}`);
  }

  const snapshots = await vaultSnapshots(VAULT, 10);
  console.log(`\ndaily snapshots: ${snapshots.length}`);
  for (const snapshot of snapshots) {
    console.log(
      `  day ${snapshot.day}  assets ${formatUsdc6(snapshot.totalAssets).padStart(9)}  ` +
        `share price ${snapshot.sharePrice}`,
    );
  }
  if (snapshots.length < 2) {
    console.log("  one snapshot or fewer: there is no return to report yet, which is n/a not 0%");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
