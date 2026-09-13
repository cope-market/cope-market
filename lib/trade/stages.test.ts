import {describe, expect, it} from "vitest";
import {BUSY_STAGES, isBusy, type TradeStage} from "./stages";

describe("trade stage busyness", () => {
  /// The regression this file exists for. `requestIntent` leaves the sheet at `quoted`, and both
  /// sheets disable the sign button while busy — so calling `quoted` busy disables the only
  /// control that can reach `signAndConfirm`, and no position can be opened or closed at all.
  it("does not call a ready quote busy", () => {
    expect(isBusy("quoted")).toBe(false);
    expect(BUSY_STAGES).not.toContain("quoted");
  });

  it("is busy only while something outside the user's control is in flight", () => {
    expect(isBusy("approving")).toBe(true);
    expect(isBusy("quoting")).toBe(true);
    expect(isBusy("awaiting-signature")).toBe(true);
    expect(isBusy("confirming")).toBe(true);
  });

  it("leaves the resting and terminal stages interactive", () => {
    expect(isBusy("idle")).toBe(false);
    expect(isBusy("done")).toBe(false);
    expect(isBusy("failed")).toBe(false);
  });

  /// Every stage should be considered here, so adding one to the union forces a decision about
  /// whether it blocks input rather than defaulting to "not busy" unnoticed.
  it("classifies every stage", () => {
    const all: TradeStage[] = [
      "idle",
      "approving",
      "quoting",
      "quoted",
      "awaiting-signature",
      "confirming",
      "done",
      "failed",
    ];
    expect(all.filter(isBusy).sort()).toEqual([...BUSY_STAGES].sort());
  });
});
