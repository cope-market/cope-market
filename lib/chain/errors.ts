import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  parseAbi,
  toFunctionSelector,
} from "viem";
import type {Hex} from "viem";

/// Turning a revert into something a person can act on.
///
/// Most rejections never get this far: the API validates a trade and returns a specific error code
/// before the user signs anything. This covers the two paths the client drives itself — the USDC
/// approval and any transaction that is simulated locally — and the case where conditions moved
/// between the quote and the block.

export const protocolErrorsAbi = parseAbi([
  // Oracle
  "error StalePrice(bytes32 feedId, uint256 age, uint256 maxAge)",
  "error PriceUnavailable(bytes32 feedId)",
  "error InvalidPrice(bytes32 feedId)",
  // Vault guards
  "error AssetDisabled(bytes32 feedId)",
  "error ConfidenceTooWide(bytes32 feedId, uint256 confBps, uint256 maxConfBps)",
  "error PositionTooLarge(bytes32 feedId, uint256 notionalUsd, uint256 maxPositionUsd)",
  "error OpenInterestCapExceeded(bytes32 feedId, bool isLong, uint256 oiUsd, uint256 maxOiUsd)",
  "error ZeroCollateral()",
  "error ZeroUnits()",
  // Positions
  "error UnknownPosition(uint256 tokenId)",
  "error NotPositionOwner(uint256 tokenId, address caller)",
  "error PositionHealthy(uint256 tokenId, uint256 lossWad, uint256 thresholdWad)",
  // Liquidity
  "error InsufficientLiquidity(uint256 requested, uint256 available)",
]);

/// What to tell the user. Deliberately specific: "transaction reverted" tells them nothing, and
/// several of these are not failures at all but the protocol behaving as designed.
const MESSAGES: Record<string, string> = {
  StalePrice:
    "This market is closed. Prices have stopped publishing, so it cannot be traded until they resume.",
  PriceUnavailable: "There is no price for this asset yet.",
  InvalidPrice: "The oracle reported a price that cannot be used.",
  AssetDisabled: "This market is not open for new positions.",
  ConfidenceTooWide: "The price is too uncertain right now. Try again shortly.",
  PositionTooLarge: "That is above the cap for a single position.",
  OpenInterestCapExceeded:
    "This side of the market is full. Try the other side, or a smaller size.",
  ZeroCollateral: "Enter an amount.",
  ZeroUnits: "That amount is too small at this price.",
  UnknownPosition: "This position no longer exists — it has already been closed.",
  NotPositionOwner: "You do not own this position.",
  PositionHealthy: "This position is not liquidatable.",
  InsufficientLiquidity:
    "The pool cannot cover this payout yet. Your position stays open and can be closed later.",
};

export interface DecodedRevert {
  name: string;
  message: string;
  args: readonly unknown[];
}

/// Selector -> error name, built from the ABI so it cannot fall out of step with it.
///
/// The signature is assembled by hand because viem's `toFunctionSelector` hashes an ABI item
/// through its formatted form, which for an error carries the `error ` keyword and produces a
/// selector no chain will ever send. Every argument here is an elementary type, so joining the
/// input types is the whole of it.
export const errorSelectors: Record<Hex, string> = Object.fromEntries(
  protocolErrorsAbi
    .filter((entry): entry is Extract<typeof entry, {type: "error"}> => entry.type === "error")
    .map((entry) => {
      const signature = `${entry.name}(${entry.inputs.map((input) => input.type).join(",")})`;
      return [toFunctionSelector(signature), entry.name] as const;
    }),
);

/// Decodes revert data. Returns null for anything not ours, which the caller shows as a generic
/// failure rather than guessing.
export function decodeRevert(data: Hex): DecodedRevert | null {
  try {
    const decoded = decodeErrorResult({abi: protocolErrorsAbi, data});
    const message = MESSAGES[decoded.errorName];
    if (!message) return null;
    return {name: decoded.errorName, message, args: decoded.args ?? []};
  } catch {
    return null;
  }
}

/// Pulls revert data out of whatever viem threw and decodes it.
export function describeChainError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      const known = MESSAGES[reverted.data.errorName];
      if (known) return known;
    }

    const raw = error.walk((e) => typeof (e as {data?: unknown}).data === "string");
    const data = (raw as {data?: string} | null)?.data;
    if (typeof data === "string" && data.startsWith("0x")) {
      const decoded = decodeRevert(data as Hex);
      if (decoded) return decoded.message;
    }

    // Two cases worth naming rather than passing through viem's prose.
    if (/user rejected|denied/i.test(error.message)) return "You cancelled the transaction.";
    if (/insufficient funds/i.test(error.message)) {
      return "Not enough USDC to cover this and the gas for it.";
    }
    return error.shortMessage || error.message;
  }

  return error instanceof Error ? error.message : "The transaction failed.";
}
