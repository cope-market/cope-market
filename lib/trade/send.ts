"use client";

import {useCallback, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import type {Address, Hex} from "viem";
import {useApi} from "../api/provider";
import {ApiRequestError} from "../api/client";
import {describeApiError} from "../api/errors";
import type {TradeIntent} from "../api/schema/entities";
import type {z} from "zod";
import {useChainSettings} from "../chain/config";
import {publicClient} from "../chain/client";
import {erc20Abi} from "../chain/abi";
import {useApproveUsdc, useSendTx} from "../chain/write";
import type {TradeStage} from "./stages";

/// Driving a trade from intent to settled position.
///
/// The server builds the transaction and verifies the receipt; the client signs. Four things in
/// this file exist because of specific ways the flow can go wrong:
///
///   - the vault pulls collateral, so an allowance has to exist before the first trade, and the
///     API deliberately does not build that transaction;
///   - a quote is honoured for thirty seconds and re-using an expired one fails at the contract;
///   - `confirm` can fail or its response can be lost after the transaction has already landed, so
///     the trade is polled rather than assumed lost — the intent was recorded before the
///     transaction was built, and confirming the same hash twice is safe;
///   - every rejection arrives as a code, before anything is signed.

export type IntentData = z.infer<typeof TradeIntent>;

export type {TradeStage} from "./stages";

export interface TradeProgress {
  stage: TradeStage;
  intent: IntentData | null;
  txHash: Hex | null;
  tokenId: string | null;
  error: {title: string; detail: string} | null;
}

const IDLE: TradeProgress = {stage: "idle", intent: null, txHash: null, tokenId: null, error: null};

export interface OpenTradeInput {
  feedId: string;
  isLong: boolean;
  /// USDC base units, gross. The open fee comes out of this.
  collateral: bigint;
  thesisId: string | null;
  copiedFromTokenId: string | null;
}

/// Polls a trade until it settles. Used when `confirm` itself failed — the transaction may well
/// have succeeded, and telling the user it failed would be wrong.
async function pollTrade(
  getTrade: () => Promise<{status: string; tokenId: string | null; error: string | null}>,
  attempts = 10,
): Promise<{tokenId: string | null; error: string | null} | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    try {
      const trade = await getTrade();
      if (trade.status === "confirmed") return {tokenId: trade.tokenId, error: null};
      if (trade.status === "failed") return {tokenId: null, error: trade.error};
    } catch {
      // Keep polling. A failure to read the trade says nothing about the trade.
    }
  }
  return null;
}

export function useTrade() {
  const api = useApi();
  const send = useSendTx();
  const approve = useApproveUsdc();
  const chain = useChainSettings();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<TradeProgress>(IDLE);
  // React calls a state updater twice under StrictMode, so the cancel below cannot live inside one
  // without sending the request twice. A ref gives `reset` the current value without that.
  const latest = useRef(progress);
  latest.current = progress;

  /// Abandons an intent the user backed out of, and forgets it locally either way.
  ///
  /// An intent is recorded on the server before the transaction is built, so walking away from the
  /// confirm panel leaves a row pending until it expires. Cancelling is only valid while it is
  /// still pending and nothing depends on it succeeding, so a failure here is swallowed: the user
  /// has already moved on, and the intent expires by itself regardless.
  const reset = useCallback(() => {
    const current = latest.current;
    if (current.intent && current.txHash === null && current.stage !== "done") {
      void api.cancelTrade({params: {tradeId: current.intent.tradeId}, body: {}}).catch(() => {});
    }
    setProgress(IDLE);
  }, [api]);

  /// Makes sure the vault can pull `collateral`, approving without a cap if it cannot. Returns
  /// false if the user declined, which is not an error worth shouting about.
  const ensureAllowance = useCallback(
    async (account: Address, collateral: bigint): Promise<boolean> => {
      const allowance = await publicClient().readContract({
        address: chain.contracts.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, chain.contracts.syntheticVault],
      });
      if (allowance >= collateral) return true;

      setProgress((current) => ({...current, stage: "approving"}));
      await approve();
      return true;
    },
    [approve, chain.contracts.usdc, chain.contracts.syntheticVault],
  );

  /// Asks the server for a quote and an unsigned transaction. Nothing is signed here, and every
  /// protocol-level rejection lands at this step rather than after a signature.
  const requestIntent = useCallback(
    async (input: OpenTradeInput): Promise<IntentData | null> => {
      setProgress({...IDLE, stage: "quoting"});
      try {
        const {intent} = await api.createTradeIntent({
          body: {
            feedId: input.feedId,
            isLong: input.isLong,
            collateral: input.collateral.toString(),
            thesisId: input.thesisId,
            copiedFromTokenId: input.copiedFromTokenId,
          },
        });
        setProgress({...IDLE, stage: "quoted", intent});
        return intent;
      } catch (error) {
        const copy = describeApiError(error);
        setProgress({...IDLE, stage: "failed", error: {title: copy.title, detail: copy.detail}});
        return null;
      }
    },
    [api],
  );

  const requestCloseIntent = useCallback(
    async (tokenId: bigint): Promise<IntentData | null> => {
      setProgress({...IDLE, stage: "quoting"});
      try {
        const {intent} = await api.createCloseIntent({
          params: {tokenId: tokenId.toString()},
          body: {},
        });
        setProgress({...IDLE, stage: "quoted", intent});
        return intent;
      } catch (error) {
        const copy = describeApiError(error);
        setProgress({...IDLE, stage: "failed", error: {title: copy.title, detail: copy.detail}});
        return null;
      }
    },
    [api],
  );

  /// Signs the intent's transaction, then tells the server about it. The server is what decides
  /// the trade succeeded: it waits for the receipt and parses the event. A client-reported fill is
  /// never taken at face value, here or there.
  const signAndConfirm = useCallback(
    async (intent: IntentData, account?: Address): Promise<boolean> => {
      if (Date.parse(intent.expiresAt) <= Date.now()) {
        setProgress({
          ...IDLE,
          stage: "failed",
          error: {title: "Quote expired", detail: "Prices move. Request a fresh quote."},
        });
        return false;
      }

      let txHash: Hex;
      try {
        if (account && intent.action === "open") {
          await ensureAllowance(account, BigInt(intent.quote.collateral));
        }
        setProgress((current) => ({...current, stage: "awaiting-signature", error: null}));
        txHash = await send({
          to: intent.tx.to as Address,
          data: intent.tx.data as Hex,
          value: BigInt(intent.tx.value),
          chainId: intent.tx.chainId,
        });
      } catch (error) {
        setProgress({
          ...IDLE,
          stage: "failed",
          intent,
          error: {
            title: "The transaction did not go through",
            detail: error instanceof Error ? error.message : "It failed before reaching the chain.",
          },
        });
        return false;
      }

      setProgress((current) => ({...current, stage: "confirming", txHash}));

      const settle = (tokenId: string | null, failure: string | null): void => {
        if (failure) {
          setProgress({
            stage: "failed",
            intent,
            txHash,
            tokenId: null,
            error: {title: "The trade failed on-chain", detail: failure},
          });
          return;
        }
        setProgress({stage: "done", intent, txHash, tokenId, error: null});
        // Balances, positions and the feed have all just changed.
        void queryClient.invalidateQueries({queryKey: ["wallet"]});
        void queryClient.invalidateQueries({queryKey: ["graph"]});
        void queryClient.invalidateQueries({queryKey: ["positions"]});
        void queryClient.invalidateQueries({queryKey: ["feed"]});
      };

      try {
        const {trade} = await api.confirmTrade({
          params: {tradeId: intent.tradeId},
          body: {txHash},
        });
        settle(trade.tokenId, trade.status === "failed" ? trade.error : null);
        return trade.status !== "failed";
      } catch (error) {
        // The transaction is on-chain; only our report of it failed. Ask the server what it makes
        // of the trade rather than declaring a loss.
        const settled = await pollTrade(async () => {
          const {trade} = await api.getTrade({params: {tradeId: intent.tradeId}});
          return {status: trade.status, tokenId: trade.tokenId, error: trade.error};
        });

        if (settled) {
          settle(settled.tokenId, settled.error);
          return settled.error === null;
        }

        const copy =
          error instanceof ApiRequestError
            ? describeApiError(error)
            : {
                title: "Sent, but not confirmed",
                detail: "The transaction was sent. We could not reach the server to confirm it.",
              };
        setProgress({
          stage: "failed",
          intent,
          txHash,
          tokenId: null,
          error: {
            title: copy.title,
            detail: `${copy.detail} The transaction is on-chain; this screen will catch up.`,
          },
        });
        return false;
      }
    },
    [api, send, ensureAllowance, queryClient],
  );

  return {progress, reset, requestIntent, requestCloseIntent, signAndConfirm};
}
