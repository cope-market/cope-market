import {describe, expect, it} from "vitest";
import {decodeRevert, errorSelectors} from "./errors";
import {encodeErrorResult} from "viem";
import {protocolErrorsAbi} from "./errors";

/// The selectors in INTEGRATION.md are documented as stable and clients switch on them. Pinning
/// them here means a signature change in the contracts fails this suite rather than quietly
/// turning every revert into "the transaction failed".
const DOCUMENTED: Record<string, string> = {
  "0xaffad796": "StalePrice",
  "0xe30f9765": "PriceUnavailable",
  "0x29333f88": "AssetDisabled",
  "0x622f6a9c": "ConfidenceTooWide",
  "0x255d1cd7": "PositionTooLarge",
  "0x8f31a741": "OpenInterestCapExceeded",
  "0xebb1e0ba": "ZeroCollateral",
  "0xc46babb1": "ZeroUnits",
  "0x606840e0": "NotPositionOwner",
  "0xa2016c11": "UnknownPosition",
  "0x0b5454a2": "PositionHealthy",
  "0xa17e11d5": "InsufficientLiquidity",
};

describe("protocol error selectors", () => {
  it("match the table in INTEGRATION.md", () => {
    for (const [selector, name] of Object.entries(DOCUMENTED)) {
      expect(errorSelectors[selector as `0x${string}`], selector).toBe(name);
    }
  });
});

describe("decodeRevert", () => {
  it("decodes the stale-price revert an out-of-hours market produces", () => {
    // Exactly what rpc.testnet.arc.io returned for EUR/USD on a Saturday.
    const data =
      "0xaffad796a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b" +
      "00000000000000000000000000000000000000000000000000000000000131cd" +
      "0000000000000000000000000000000000000000000000000000000000000258";

    const decoded = decodeRevert(data as `0x${string}`);
    expect(decoded?.name).toBe("StalePrice");
    expect(decoded?.args[1]).toBe(78285n);
    expect(decoded?.args[2]).toBe(600n);
    expect(decoded?.message).toMatch(/market is closed/i);
  });

  it("says a refused winning close leaves the position open", () => {
    const data = encodeErrorResult({
      abi: protocolErrorsAbi,
      errorName: "InsufficientLiquidity",
      args: [5_000_000n, 30_016_928n],
    });
    expect(decodeRevert(data)?.message).toMatch(/stays open/i);
  });

  it("returns null for revert data that is not ours", () => {
    expect(decodeRevert("0xdeadbeef")).toBeNull();
  });
});
