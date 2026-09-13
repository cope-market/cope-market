import type {Address, Hex, PublicClient} from "viem";
import {erc20Abi, liquidityVaultAbi, priceOracleAbi, syntheticVaultAbi} from "./abi";
import type {ContractAddresses} from "./arc";
import {marketStatus} from "./market";
import type {Market} from "./market";

/// Everything the client reads straight from the contracts. The API deliberately has no routes for
/// any of it: positions, prices, balances, liquidity-vault state and risk parameters have one
/// source of truth and it is the chain.

/// The oracle reverts `StalePrice` when the price is older than the bound it is given. Valuation
/// must not be gated on freshness — an out-of-hours market still has a last price worth showing,
/// and the vault's own `liability` reads with no bound for exactly this reason — so the display
/// path asks for any age and decides tradeability separately, in market.ts.
const ANY_AGE = 2n ** 256n - 1n;

export interface AssetConfig {
  enabled: boolean;
  maxAgeSec: number;
  maxConfBps: number;
  openFeeBps: number;
  closeFeeBps: number;
  maxOiUsd: bigint;
  maxPositionUsd: bigint;
}

export interface Mark {
  /// 1e18
  price: bigint;
  /// 1e18
  conf: bigint;
  publishTime: bigint;
}

export interface MarketRow {
  feedId: Hex;
  config: AssetConfig;
  mark: Mark;
  market: Market;
}

export interface Position {
  tokenId: bigint;
  feedId: Hex;
  isLong: boolean;
  openedAt: bigint;
  /// USDC base units, net of the open fee.
  collateral: bigint;
  /// 1e18
  units: bigint;
  /// 1e18, already skewed against the trader.
  entryPrice: bigint;
  author: Address;
  copiedFromId: bigint;
  copyAuthor: Address;
  authorFeeBps: number;
}

function toAssetConfig(
  raw: readonly [boolean, number, number, number, number, bigint, bigint],
): AssetConfig {
  return {
    enabled: raw[0],
    maxAgeSec: raw[1],
    maxConfBps: raw[2],
    openFeeBps: raw[3],
    closeFeeBps: raw[4],
    maxOiUsd: raw[5],
    maxPositionUsd: raw[6],
  };
}

/// The catalogue of live markets, with the risk parameters and the last price for each, plus
/// whether each one can be traded at the block these reads were made against.
export async function readMarkets(
  client: PublicClient,
  contracts: ContractAddresses,
): Promise<{rows: MarketRow[]; blockTimestamp: bigint}> {
  const [feedIds, block] = await Promise.all([
    client.readContract({
      address: contracts.syntheticVault,
      abi: syntheticVaultAbi,
      functionName: "enabledFeeds",
    }),
    client.getBlock(),
  ]);

  const results = await client.multicall({
    allowFailure: false,
    contracts: feedIds.flatMap(
      (feedId) =>
        [
          {
            address: contracts.syntheticVault,
            abi: syntheticVaultAbi,
            functionName: "assetConfig",
            args: [feedId],
          },
          {
            address: contracts.oracle,
            abi: priceOracleAbi,
            functionName: "lastPublishTime",
            args: [feedId],
          },
          {
            address: contracts.oracle,
            abi: priceOracleAbi,
            functionName: "getPrice",
            args: [feedId, ANY_AGE],
          },
        ] as const,
    ),
  });

  const rows = feedIds.map((feedId, index): MarketRow => {
    const config = toAssetConfig(
      results[index * 3] as readonly [boolean, number, number, number, number, bigint, bigint],
    );
    const lastPublishTime = results[index * 3 + 1] as bigint;
    const price = results[index * 3 + 2] as {price: bigint; conf: bigint; publishTime: bigint};

    return {
      feedId,
      config,
      mark: {price: price.price, conf: price.conf, publishTime: price.publishTime},
      market: marketStatus({
        enabled: config.enabled,
        maxAgeSec: config.maxAgeSec,
        lastPublishTime,
        blockTimestamp: block.timestamp,
      }),
    };
  });

  return {rows, blockTimestamp: block.timestamp};
}

/// Positions by token id. `positions` reverts `UnknownPosition` for anything closed or never
/// minted, so failures are allowed and mapped to null: a closed position is a normal outcome of
/// asking about one, not an error to surface.
export async function readPositions(
  client: PublicClient,
  contracts: ContractAddresses,
  tokenIds: readonly bigint[],
): Promise<Map<string, Position | null>> {
  if (tokenIds.length === 0) return new Map();

  const results = await client.multicall({
    allowFailure: true,
    contracts: tokenIds.map(
      (tokenId) =>
        ({
          address: contracts.syntheticVault,
          abi: syntheticVaultAbi,
          functionName: "positions",
          args: [tokenId],
        }) as const,
    ),
  });

  const positions = new Map<string, Position | null>();
  tokenIds.forEach((tokenId, index) => {
    const result = results[index];
    if (!result || result.status !== "success") {
      positions.set(tokenId.toString(), null);
      return;
    }
    const raw = result.result as unknown as Omit<Position, "tokenId">;
    positions.set(tokenId.toString(), {...raw, tokenId});
  });
  return positions;
}

export async function readPosition(
  client: PublicClient,
  contracts: ContractAddresses,
  tokenId: bigint,
): Promise<Position | null> {
  return (await readPositions(client, contracts, [tokenId])).get(tokenId.toString()) ?? null;
}

/// Protocol-level parameters, as opposed to the per-asset ones in `assetConfig`.
///
/// Read rather than assumed: the owner can change any of them without a deploy, and a number baked
/// into the interface would then be a lie the user acts on.
export interface ProtocolParams {
  /// Share of a copy's profit paid to the origin author. 1000 = 10%.
  authorFeeBps: number;
  /// Share of collateral that must be lost before a position can be liquidated. 9000 = 90%.
  liquidationThresholdBps: number;
  /// Share of collateral paid to whoever calls `liquidate`. 100 = 1%.
  liquidationRewardBps: number;
}

export async function readProtocolParams(
  client: PublicClient,
  contracts: ContractAddresses,
): Promise<ProtocolParams> {
  const [authorFeeBps, liquidationThresholdBps, liquidationRewardBps] = await client.multicall({
    allowFailure: false,
    contracts: [
      {address: contracts.syntheticVault, abi: syntheticVaultAbi, functionName: "authorFeeBps"},
      {
        address: contracts.syntheticVault,
        abi: syntheticVaultAbi,
        functionName: "liquidationThresholdBps",
      },
      {
        address: contracts.syntheticVault,
        abi: syntheticVaultAbi,
        functionName: "liquidationRewardBps",
      },
    ] as const,
  });

  return {authorFeeBps, liquidationThresholdBps, liquidationRewardBps};
}

export interface WalletState {
  /// 6 decimals. The spendable balance, and what every contract amount is denominated in.
  usdc: bigint;
  /// 18 decimals. The same balance as the chain's native currency. It pays gas and nothing else.
  gas: bigint;
  /// 6 decimals. What SyntheticVault is allowed to pull for collateral.
  vaultAllowance: bigint;
  /// How many position NFTs the account holds.
  positionCount: bigint;
}

export async function readWallet(
  client: PublicClient,
  contracts: ContractAddresses,
  account: Address,
): Promise<WalletState> {
  const [gas, reads] = await Promise.all([
    client.getBalance({address: account}),
    client.multicall({
      allowFailure: false,
      contracts: [
        {address: contracts.usdc, abi: erc20Abi, functionName: "balanceOf", args: [account]},
        {
          address: contracts.usdc,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, contracts.syntheticVault],
        },
        {
          address: contracts.syntheticVault,
          abi: syntheticVaultAbi,
          functionName: "balanceOf",
          args: [account],
        },
      ] as const,
    }),
  ]);

  return {usdc: reads[0], gas, vaultAllowance: reads[1], positionCount: reads[2]};
}

export interface VaultState {
  /// 6 decimals, net of what the pool owes open positions. This is live; the subgraph's copy is
  /// as of its last indexed block.
  totalAssets: bigint;
  /// 18 decimals. Shares are 18-decimal while the asset is 6-decimal, on purpose: it stops small
  /// deposits rounding to zero.
  totalShares: bigint;
  exitFeeBps: number;
  /// 1e18, signed across every enabled feed. Positive means the pool owes traders.
  totalLiability: bigint;
}

export async function readVault(
  client: PublicClient,
  contracts: ContractAddresses,
): Promise<VaultState> {
  const [totalAssets, totalShares, exitFeeBps, totalLiability] = await client.multicall({
    allowFailure: false,
    contracts: [
      {address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalAssets"},
      {address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalSupply"},
      {address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "exitFeeBps"},
      {address: contracts.syntheticVault, abi: syntheticVaultAbi, functionName: "totalLiability"},
    ] as const,
  });

  return {totalAssets, totalShares, exitFeeBps, totalLiability};
}

export interface LpPosition {
  shares: bigint;
  /// 6 decimals. What redeeming every share would pay now, exit fee already deducted.
  redeemable: bigint;
  maxWithdraw: bigint;
}

export async function readLpPosition(
  client: PublicClient,
  contracts: ContractAddresses,
  account: Address,
): Promise<LpPosition> {
  const shares = await client.readContract({
    address: contracts.liquidityVault,
    abi: liquidityVaultAbi,
    functionName: "balanceOf",
    args: [account],
  });

  if (shares === 0n) return {shares: 0n, redeemable: 0n, maxWithdraw: 0n};

  // previewRedeem and maxWithdraw already account for the exit fee, so what they return is what
  // the holder receives. No fee arithmetic happens in the interface.
  const [redeemable, maxWithdraw] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: contracts.liquidityVault,
        abi: liquidityVaultAbi,
        functionName: "previewRedeem",
        args: [shares],
      },
      {
        address: contracts.liquidityVault,
        abi: liquidityVaultAbi,
        functionName: "maxWithdraw",
        args: [account],
      },
    ] as const,
  });

  return {shares, redeemable, maxWithdraw};
}

export interface OpenInterest {
  feedId: Hex;
  /// 1e18 USD, valued at average entry so a cap does not move with the market.
  long: bigint;
  short: bigint;
  maxOiUsd: bigint;
}

export async function readOpenInterest(
  client: PublicClient,
  contracts: ContractAddresses,
  rows: readonly MarketRow[],
): Promise<OpenInterest[]> {
  if (rows.length === 0) return [];

  const results = await client.multicall({
    allowFailure: false,
    contracts: rows.flatMap(
      (row) =>
        [
          {
            address: contracts.syntheticVault,
            abi: syntheticVaultAbi,
            functionName: "openInterest",
            args: [row.feedId, true],
          },
          {
            address: contracts.syntheticVault,
            abi: syntheticVaultAbi,
            functionName: "openInterest",
            args: [row.feedId, false],
          },
        ] as const,
    ),
  });

  return rows.map((row, index) => ({
    feedId: row.feedId,
    long: results[index * 2] as bigint,
    short: results[index * 2 + 1] as bigint,
    maxOiUsd: row.config.maxOiUsd,
  }));
}
