import {describe, expect, it} from "vitest";
import {
  formatAge,
  formatBps,
  formatGasBalance,
  formatPnlUsdc6,
  formatPrice,
  formatReturnPercent,
  formatUsdc6,
  formatWad,
  parseUsdc6,
  usdc6FromWad,
  wadFromUsdc6,
} from "./format";

describe("the two USDC scales", () => {
  it("bridges 6-decimal and 18-decimal with the documented 1e12 factor", () => {
    expect(wadFromUsdc6(2_000_000n)).toBe(2_000_000_000_000_000_000n);
    expect(usdc6FromWad(2_000_000_000_000_000_000n)).toBe(2_000_000n);
  });

  it("truncates on the way down, as the contract's Wad.fromWad does", () => {
    expect(usdc6FromWad(1_999_999_999_999_999_999n)).toBe(1_999_999n);
  });

  it("renders the same live balance correctly at both scales", () => {
    // Measured on one account: eth_getBalance against ERC-20 balanceOf.
    expect(formatGasBalance(11_705_898_898_359_212_279n)).toBe("11.7059");
    expect(formatUsdc6(11_705_898n)).toBe("11.71");
  });
});

describe("formatUsdc6", () => {
  it("formats base units as USDC", () => {
    expect(formatUsdc6(2_000_000n)).toBe("2.00");
    expect(formatUsdc6(1_998_000n)).toBe("2.00");
    expect(formatUsdc6(0n)).toBe("0.00");
  });

  it("groups thousands", () => {
    expect(formatUsdc6(1_234_567_890_000n)).toBe("1,234,567.89");
  });

  it("rounds rather than truncating, so a near-miss is not shown as a miss", () => {
    expect(formatUsdc6(1_999_999n)).toBe("2.00");
    expect(formatUsdc6(1_994_999n)).toBe("1.99");
  });
});

describe("formatPrice", () => {
  it("gives a major pair the precision it trades at", () => {
    expect(formatPrice(1_159_850_000_000_000_000n)).toBe("1.15985");
  });

  it("gives a five-figure price two decimal places", () => {
    expect(formatPrice(77_291_455_000_000_000_000_000n)).toBe("77,291.46");
  });

  it("gives a sub-unit price six", () => {
    expect(formatPrice(12_345_000_000_000_00n)).toBe("0.001235");
  });
});

describe("P&L", () => {
  it("is always signed, so a gain and a loss never look alike", () => {
    expect(formatPnlUsdc6(4_100n)).toBe("+0.0041");
    expect(formatPnlUsdc6(-4_100n)).toBe("-0.0041");
    // Exactly flat carries no sign. A flat result is not a gain.
    expect(formatPnlUsdc6(0n)).toBe("0.00");
  });

  it("keeps two places when there is nothing smaller to show", () => {
    expect(formatWad(-1_495_554_512_560_313n, {min: 2, max: 4, sign: true})).toBe("-0.0015");
  });
});

describe("formatReturnPercent", () => {
  it("expresses a signed P&L against its collateral", () => {
    expect(formatReturnPercent(4_100n, 2_000_000n)).toBe("+0.21%");
    expect(formatReturnPercent(0n, 2_000_000n)).toBe("0.00%");
    expect(formatReturnPercent(-100_000n, 2_000_000n)).toBe("-5.00%");
  });

  it("returns null rather than zero when there is nothing to divide by", () => {
    // A position with no collateral has no return. Zero would say it broke even.
    expect(formatReturnPercent(0n, 0n)).toBeNull();
  });
});

describe("parseUsdc6", () => {
  it("reads what a person types", () => {
    expect(parseUsdc6("2")).toBe(2_000_000n);
    expect(parseUsdc6("2.5")).toBe(2_500_000n);
    expect(parseUsdc6("0.000001")).toBe(1n);
    expect(parseUsdc6("1,234.50")).toBe(1_234_500_000n);
  });

  it("refuses precision USDC cannot hold rather than silently truncating it", () => {
    expect(parseUsdc6("1.0000001")).toBeNull();
  });

  it("refuses anything that is not an amount, including the empty string", () => {
    expect(parseUsdc6("")).toBeNull();
    expect(parseUsdc6("abc")).toBeNull();
    expect(parseUsdc6("-1")).toBeNull();
    expect(parseUsdc6(".")).toBeNull();
  });
});

describe("small helpers", () => {
  it("renders basis points as the percentage they are", () => {
    expect(formatBps(10)).toBe("0.10%");
    expect(formatBps(1000)).toBe("10.00%");
  });

  it("renders ages", () => {
    expect(formatAge(30)).toBe("30s ago");
    expect(formatAge(17_919)).toBe("4h ago");
    expect(formatAge(-5)).toBe("0s ago");
  });
});
