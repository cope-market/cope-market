import {describe, expect, it} from "vitest";
import {ZERO_ADDRESS, exitPrice, quoteClose, quoteCloseAtMark} from "./pnl";

/// Positions 1 and 2 on Arc testnet, opened and closed for real against
/// SyntheticVault 0x2c720283A8Bbb5CC5b13C0C4Bcf2300826286c47 and read back from the
/// cope-market-arc subgraph. `realizedPnlWad` and `payout` are what the contract actually settled,
/// so agreeing with them is agreeing with the chain rather than with our own reading of it.
const SETTLED = [
  {
    tokenId: 1n,
    isLong: true,
    units: 25_844_656_539_652n,
    collateral: 1_998_000n,
    entryPrice: 77_308_049_999_990_000_000_000n,
    exit: 77_283_477_712_910_000_000_000n,
    realizedPnlWad: -635_062_319_976_328n,
    payout: 1_995_367n,
  },
  {
    tokenId: 2n,
    isLong: true,
    units: 25_848_268_602_466n,
    collateral: 1_998_000n,
    entryPrice: 77_297_246_896_040_000_000_000n,
    exit: 77_263_956_767_180_000_000_000n,
    realizedPnlWad: -860_492_192_583_985n,
    payout: 1_995_142n,
  },
];

// Every live asset carries closeFeeBps = 10, read from assetConfig on the deployed vault.
const CLOSE_FEE_BPS = 10;

describe("quoteClose against real settlements on Arc testnet", () => {
  for (const position of SETTLED) {
    it(`reproduces what the contract paid on position ${position.tokenId}`, () => {
      const quote = quoteClose(
        {
          isLong: position.isLong,
          units: position.units,
          entryPrice: position.entryPrice,
          collateral: position.collateral,
          closeFeeBps: CLOSE_FEE_BPS,
        },
        position.exit,
      );

      expect(quote.pnlWad).toBe(position.realizedPnlWad);
      expect(quote.payout).toBe(position.payout);
      // What the user actually lost: the close fee on top of the adverse price move.
      expect(quote.netUsdc6).toBe(position.payout - position.collateral);
    });
  }
});

describe("exitPrice", () => {
  it("moves against the trader in both directions", () => {
    const price = 77_000_000_000_000_000_000_000n;
    const conf = 10_000_000_000_000_000_000n;
    expect(exitPrice(price, conf, true)).toBe(price - conf);
    expect(exitPrice(price, conf, false)).toBe(price + conf);
  });

  it("is what quoteCloseAtMark prices against", () => {
    const input = {
      isLong: true,
      units: 10n ** 18n,
      entryPrice: 100n * 10n ** 18n,
      collateral: 100_000_000n,
      closeFeeBps: 0,
    };
    const mark = {price: 110n * 10n ** 18n, conf: 1n * 10n ** 18n};
    // A long exits at 109, not at 110.
    expect(quoteCloseAtMark(input, mark).pnlWad).toBe(9n * 10n ** 18n);
  });
});

describe("the shape of a settlement", () => {
  const base = {
    isLong: true,
    units: 10n ** 18n, // one unit
    entryPrice: 100n * 10n ** 18n,
    collateral: 100_000_000n, // 100 USDC
    closeFeeBps: 0,
  };

  it("pays a short when the price falls", () => {
    const quote = quoteClose({...base, isLong: false}, 90n * 10n ** 18n);
    expect(quote.pnlWad).toBe(10n * 10n ** 18n);
    expect(quote.payout).toBe(110_000_000n);
  });

  it("never pays out negative, however far the price runs against a short", () => {
    // A short at 100 with the price at 1,000: the loss is nine times the collateral.
    const quote = quoteClose({...base, isLong: false}, 1_000n * 10n ** 18n);
    expect(quote.pnlWad).toBe(-900n * 10n ** 18n);
    expect(quote.payout).toBe(0n);
    expect(quote.netUsdc6).toBe(-100_000_000n);
  });

  it("charges the close fee on exit notional, not on collateral", () => {
    // Exit notional is 110 USD; 10 bps of it is 0.11 USDC. Charged on collateral it would have
    // been 0.10, which is the discrepancy this case exists to catch.
    const quote = quoteClose({...base, closeFeeBps: 10}, 110n * 10n ** 18n);
    expect(quote.closeFeeWad).toBe(11n * 10n ** 16n);
    expect(quote.payout).toBe(109_890_000n);
  });

  it("truncates the payout toward zero, as Wad.fromWad does", () => {
    const quote = quoteClose({...base, collateral: 1n}, 100n * 10n ** 18n);
    // Collateral of 1 base unit is 1e12 wad; the position is flat, so the payout is exactly it.
    expect(quote.payout).toBe(1n);
  });
});

describe("the author fee on a copied position", () => {
  const copy = {
    isLong: true,
    units: 10n ** 18n,
    entryPrice: 100n * 10n ** 18n,
    collateral: 100_000_000n,
    closeFeeBps: 0,
    copyAuthor: "0xeeb3e0999D01f0d1Ed465513E414725a357F6ae4",
    authorFeeBps: 1000, // the protocol's current rate
  };

  it("takes a tenth of the profit and pays it out of the holder's payout", () => {
    const quote = quoteClose(copy, 110n * 10n ** 18n);
    expect(quote.pnlWad).toBe(10n * 10n ** 18n);
    expect(quote.authorFee).toBe(1_000_000n); // 1 USDC, a tenth of 10
    expect(quote.payout).toBe(109_000_000n);
  });

  it("charges nothing when the copy loses — no profit, no fee", () => {
    const quote = quoteClose(copy, 90n * 10n ** 18n);
    expect(quote.pnlWad).toBe(-10n * 10n ** 18n);
    expect(quote.authorFee).toBe(0n);
    expect(quote.payout).toBe(90_000_000n);
  });

  it("charges nothing on a flat close, which is not a profit", () => {
    expect(quoteClose(copy, 100n * 10n ** 18n).authorFee).toBe(0n);
  });

  it("charges nothing on an original position", () => {
    const quote = quoteClose({...copy, copyAuthor: ZERO_ADDRESS}, 110n * 10n ** 18n);
    expect(quote.authorFee).toBe(0n);
    expect(quote.payout).toBe(110_000_000n);
  });
});
