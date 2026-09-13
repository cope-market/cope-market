/// The stages a trade moves through, and which of them mean the UI must not accept input.
///
/// This lives apart from `send.ts` so it carries no React: the sheets and a plain unit test can
/// both read it. It is shared rather than written out at each call site because it was not — both
/// sheets kept their own copy of the busy list, so one wrong entry disabled the sign button on the
/// open path and the close path at once.

export type TradeStage =
  | "idle"
  | "approving"
  | "quoting"
  | "quoted"
  | "awaiting-signature"
  | "confirming"
  | "done"
  | "failed";

/// Stages where something outside the user's control is in flight, so the sheet is inert.
///
/// `quoted` is deliberately absent. A quote in hand is the one moment the sheet most needs to be
/// interactive: it is the step that asks the wallet to sign, and the user has not been asked for
/// anything yet. `awaiting-signature` is set once that ask has gone out — see `signAndConfirm`.
///
/// `approving` cannot occur while closing, since only an open pulls collateral; it is listed for
/// both paths because a stage that never arrives costs nothing and a missing one costs a button.
export const BUSY_STAGES: readonly TradeStage[] = [
  "approving",
  "quoting",
  "awaiting-signature",
  "confirming",
];

export function isBusy(stage: TradeStage): boolean {
  return BUSY_STAGES.includes(stage);
}
