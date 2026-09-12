#!/usr/bin/env tsx
/// Reads the deployment the way the app does and prints what it found.
///
/// This is the check that the chain layer agrees with reality: same client, same ABIs, same
/// multicall, same market-open derivation. If `npm run verify:chain` disagrees with the explorer,
/// the app will disagree too.

import {ARC_TESTNET_CONTRACTS} from "../lib/chain/arc";
import {publicClient} from "../lib/chain/client";
import {readMarkets, readOpenInterest, readVault} from "../lib/chain/reads";
import {formatAge, formatBps, formatPrice, formatUsdc6, formatWad} from "../lib/format";
import {quoteOpen} from "../lib/trade/quote";

const SYMBOLS: Record<string, string> = {
  "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b": "EUR/USD",
  "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2": "XAU/USD",
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC/USD",
  "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1": "TSLA/USD",
};

async function main(): Promise<void> {
  const client = publicClient();
  const contracts = ARC_TESTNET_CONTRACTS;

  const chainId = await client.getChainId();
  console.log(`chain ${chainId}  vault ${contracts.syntheticVault}\n`);

  const {rows, blockTimestamp} = await readMarkets(client, contracts);
  const oi = await readOpenInterest(client, contracts, rows);

  console.log(`markets, as of block time ${blockTimestamp}`);
  for (const [index, row] of rows.entries()) {
    const symbol = SYMBOLS[row.feedId.toLowerCase()] ?? row.feedId.slice(0, 10);
    const age = row.market.ageSeconds === null ? "never" : formatAge(row.market.ageSeconds);
    const badge = row.market.tradeable ? "OPEN  " : `${row.market.status.toUpperCase().padEnd(6)}`;
    console.log(
      `  ${symbol.padEnd(9)} ${badge} ${formatPrice(row.mark.price).padStart(12)} ` +
        `± ${formatPrice(row.mark.conf).padStart(10)}  published ${age.padStart(8)}  ` +
        `fees ${formatBps(row.config.openFeeBps)}/${formatBps(row.config.closeFeeBps)}`,
    );
    if (row.market.reason) console.log(`            ${row.market.reason}`);

    const side = oi[index];
    if (side && (side.long > 0n || side.short > 0n)) {
      console.log(
        `            open interest  long ${formatWad(side.long)}  short ${formatWad(side.short)}` +
          `  of ${formatWad(side.maxOiUsd)} a side`,
      );
    }
  }

  const vault = await readVault(client, contracts);
  console.log(`\nliquidity vault`);
  console.log(`  total assets   ${formatUsdc6(vault.totalAssets)} USDC   (live, not indexed)`);
  console.log(`  total shares   ${formatWad(vault.totalShares)}`);
  console.log(`  exit fee       ${formatBps(vault.exitFeeBps)}`);
  console.log(`  liability      ${formatWad(vault.totalLiability, {sign: true})} USD wad`);

  // The number the trade sheet will preview, computed the way the server computes it.
  const tradeable = rows.find((row) => row.market.tradeable) ?? rows[0];
  if (tradeable) {
    const symbol = SYMBOLS[tradeable.feedId.toLowerCase()] ?? tradeable.feedId.slice(0, 10);
    const quote = quoteOpen({
      price: tradeable.mark.price,
      conf: tradeable.mark.conf,
      collateral: 2_000_000n,
      openFeeBps: tradeable.config.openFeeBps,
      isLong: true,
    });
    console.log(
      `\n2.00 USDC long on ${symbol}${tradeable.market.tradeable ? "" : "  (market closed — preview only)"}`,
    );
    console.log(`  mark           ${formatPrice(tradeable.mark.price)}`);
    console.log(
      `  entry          ${formatPrice(quote.entryPrice)}   skewed against the trader by confidence`,
    );
    console.log(`  open fee       ${formatUsdc6(quote.openFee, {min: 2, max: 6})} USDC`);
    console.log(`  collateral     ${formatUsdc6(quote.netCollateral)} USDC after the fee`);
    console.log(`  units          ${formatWad(quote.units, {min: 2, max: 12})}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
