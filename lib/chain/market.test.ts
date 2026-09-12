import {describe, expect, it} from "vitest";
import {marketStatus} from "./market";

const base = {enabled: true, maxAgeSec: 600, blockTimestamp: 1_789_238_570n};

describe("marketStatus", () => {
  it("calls a fresh feed open", () => {
    const market = marketStatus({...base, lastPublishTime: 1_789_238_500n});
    expect(market.status).toBe("open");
    expect(market.tradeable).toBe(true);
    expect(market.reason).toBeNull();
    expect(market.ageSeconds).toBe(70);
  });

  it("calls an out-of-hours feed closed rather than broken", () => {
    // EUR/USD as measured on a Saturday: 21 hours since the last publish.
    const market = marketStatus({...base, lastPublishTime: 1_789_160_399n});
    expect(market.status).toBe("closed");
    expect(market.tradeable).toBe(false);
    expect(market.ageSeconds).toBe(78_171);
    expect(market.reason).toMatch(/closed/i);
  });

  it("treats the boundary as still open, matching the contract's `age > maxAge` rejection", () => {
    const atLimit = marketStatus({...base, lastPublishTime: base.blockTimestamp - 600n});
    expect(atLimit.status).toBe("open");

    const pastLimit = marketStatus({...base, lastPublishTime: base.blockTimestamp - 601n});
    expect(pastLimit.status).toBe("closed");
  });

  it("says a disabled asset can still be closed out of", () => {
    const market = marketStatus({...base, enabled: false, lastPublishTime: base.blockTimestamp});
    expect(market.status).toBe("disabled");
    expect(market.tradeable).toBe(false);
    expect(market.reason).toMatch(/can still be closed/i);
  });

  it("distinguishes a feed that has never published from a stale one", () => {
    const market = marketStatus({...base, lastPublishTime: 0n});
    expect(market.status).toBe("no-price");
    // Not zero. An age of zero would say the price is current.
    expect(market.ageSeconds).toBeNull();
  });

  it("uses chain time, so a browser clock cannot close a live market", () => {
    // The block is behind the wall clock; freshness is still judged against the block.
    const market = marketStatus({
      enabled: true,
      maxAgeSec: 600,
      lastPublishTime: 1_000_000n,
      blockTimestamp: 1_000_060n,
    });
    expect(market.status).toBe("open");
  });
});
