import {parseAbi} from "viem";

/// Only the surface this client touches, written out rather than generated so a contract change
/// that matters shows up as a diff here. A superset of the backend's lib/chain/abi.ts: the client
/// also reads oracle prices for display, enumerates ERC-4626 state for the LP screen, and builds
/// its own USDC approval, which is the one transaction the API deliberately does not construct.

export const syntheticVaultAbi = parseAbi([
  "function assetConfig(bytes32 feedId) view returns (bool enabled, uint32 maxAgeSec, uint32 maxConfBps, uint32 openFeeBps, uint32 closeFeeBps, uint128 maxOiUsd, uint128 maxPositionUsd)",
  "function enabledFeeds() view returns (bytes32[])",
  "function openInterest(bytes32 feedId, bool isLong) view returns (uint256)",
  "function liability(bytes32 feedId) view returns (int256)",
  "function totalLiability() view returns (int256)",
  "function avgEntry(bytes32 feedId, bool isLong) view returns (uint256)",
  "function authorFeeBps() view returns (uint16)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function positions(uint256 tokenId) view returns ((bytes32 feedId, bool isLong, uint64 openedAt, uint128 collateral, uint256 units, uint256 entryPrice, address author, uint256 copiedFromId, address copyAuthor, uint16 authorFeeBps))",
  "function open(bytes32 feedId, bool isLong, uint128 collateral, uint256 copiedFromId, bytes[] updateData) payable returns (uint256 tokenId)",
  "function close(uint256 tokenId, bytes[] updateData) payable",
  "event PositionOpened(uint256 indexed tokenId, address indexed owner, bytes32 indexed feedId, bool isLong, uint128 collateral, uint256 units, uint256 entryPrice, uint256 copiedFromId)",
  "event PositionClosed(uint256 indexed tokenId, address indexed closedBy, bytes32 indexed feedId, uint256 exitPrice, int256 pnlWad, uint256 payout)",
]);

export const priceOracleAbi = parseAbi([
  "function getPrice(bytes32 feedId, uint256 maxAge) view returns ((uint256 price, uint256 conf, uint64 publishTime))",
  "function lastPublishTime(bytes32 feedId) view returns (uint64)",
]);

/// A standard ERC-4626 vault over 6-decimal USDC, with 18-decimal shares. previewRedeem and
/// previewWithdraw already account for the exit fee, so what they return is what the holder
/// receives and the interface does no fee arithmetic of its own.
export const liquidityVaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function decimals() view returns (uint8)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function maxRedeem(address owner) view returns (uint256)",
  "function exitFeeBps() view returns (uint16)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
]);

/// The 6-decimal view of Arc's native USDC. Do not call totalSupply on it: the value matches
/// neither decimal scale and nothing here needs it.
export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
