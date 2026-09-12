import {defineChain} from "viem";
import type {Address} from "viem";

/// Arc's native currency is USDC with 18 decimals, and the ERC-20 view of the same balance uses 6.
/// Both appear in this application and they must never be added. `nativeCurrency` below is the
/// 18-decimal one, and it is used for gas alone.

export const ARC_TESTNET_ID = 5042002;
export const ARC_MAINNET_ID = 5042;

/// Arc rejects a transaction whose maxFeePerGas is below this. Every transaction we send is
/// floored at it. The server also reports it on GET /chains, which is the value we prefer.
export const ARC_MIN_MAX_FEE_PER_GAS = 20_000_000_000n;

export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: "Arc Testnet",
  nativeCurrency: {name: "USD Coin", symbol: "USDC", decimals: 18},
  rpcUrls: {
    default: {http: [process.env["NEXT_PUBLIC_ARC_RPC_URL"] ?? "https://rpc.testnet.arc.io"]},
  },
  blockExplorers: {default: {name: "Arcscan", url: "https://testnet.arcscan.app"}},
  contracts: {
    // Verified present on Arc testnet, which is what lets every read in lib/chain/reads.ts go out
    // as one call instead of a dozen.
    multicall3: {address: "0xcA11bde05977b3631167028862bE2a173976CA11"},
  },
});

/// Contract addresses. GET /chains is the source of truth and the app replaces these as soon as it
/// answers; they exist so a cold start has something to read before the API responds, and so a
/// backend outage does not take the chain views down with it.
export interface ContractAddresses {
  syntheticVault: Address;
  liquidityVault: Address;
  usdc: Address;
  oracle: Address;
}

export const ARC_TESTNET_CONTRACTS: ContractAddresses = {
  syntheticVault: "0x2c720283A8Bbb5CC5b13C0C4Bcf2300826286c47",
  liquidityVault: "0x0ffABC4e80125C5742D5ed04Cc1fD1b634Bc3C5d",
  usdc: "0x3600000000000000000000000000000000000000",
  oracle: "0x0f2d191fEC3bB2DEEd8cE3E326193fd9b5203277",
};

export function explorerTxUrl(hash: string): string {
  return `${arcTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${arcTestnet.blockExplorers.default.url}/address/${address}`;
}
