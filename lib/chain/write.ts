"use client";

import {useCallback} from "react";
import {useSendTransaction} from "@privy-io/react-auth";
import {encodeFunctionData, maxUint256} from "viem";
import type {Address, Hex} from "viem";
import {erc20Abi, liquidityVaultAbi} from "./abi";
import {useChainSettings} from "./config";
import {publicClient} from "./client";
import {describeChainError} from "./errors";

/// Sending a transaction. The server builds the calldata for anything that touches the protocol;
/// this signs and sends it, and waits for the receipt.

export interface SendableTx {
  to: Address;
  data: Hex;
  /// Wei, 18 decimals. Zero for every call this app makes — the oracle is a push oracle and
  /// rejects a non-zero value on open and close.
  value?: bigint;
  chainId?: number;
}

export class TransactionFailed extends Error {
  constructor(
    message: string,
    readonly hash?: Hex,
  ) {
    super(message);
    this.name = "TransactionFailed";
  }
}

export function useSendTx() {
  const {sendTransaction} = useSendTransaction();
  const chain = useChainSettings();

  /// Sends and waits. Returns the hash once the receipt says the transaction succeeded, and
  /// throws with a decoded reason when it did not.
  return useCallback(
    async (tx: SendableTx): Promise<Hex> => {
      let hash: Hex;
      try {
        const sent = await sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ?? 0n,
          chainId: tx.chainId ?? chain.chainId,
          // Arc rejects anything below its floor outright. The server reports the floor on
          // GET /chains so a client never has to know the number.
          maxFeePerGas: chain.minMaxFeePerGasWei,
        });
        hash = sent.hash;
      } catch (error) {
        throw new TransactionFailed(describeChainError(error));
      }

      const receipt = await publicClient().waitForTransactionReceipt({hash});
      if (receipt.status !== "success") {
        // The revert reason is not in the receipt, so replay the call at that block to get it.
        throw new TransactionFailed(await revertReason(tx, receipt.blockNumber), hash);
      }
      return hash;
    },
    [sendTransaction, chain.chainId, chain.minMaxFeePerGasWei],
  );
}

/// Re-runs a failed call as an `eth_call` against the block it failed in, which is the only way to
/// recover a custom error's arguments after the fact.
async function revertReason(tx: SendableTx, blockNumber: bigint): Promise<string> {
  try {
    await publicClient().call({to: tx.to, data: tx.data, blockNumber});
    return "The transaction reverted, and replaying it did not reproduce the failure.";
  } catch (error) {
    return describeChainError(error);
  }
}

/// The vault pulls collateral from the trader, so it needs an ERC-20 allowance before the first
/// trade. The API deliberately does not build this transaction: it is a plain token approval and
/// belongs to the client.
export function useApproveUsdc() {
  const send = useSendTx();
  const chain = useChainSettings();

  return useCallback(
    async (amount: bigint = maxUint256): Promise<Hex> =>
      await send({
        to: chain.contracts.usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [chain.contracts.syntheticVault, amount],
        }),
      }),
    [send, chain.contracts.usdc, chain.contracts.syntheticVault],
  );
}

/// LP deposits and withdrawals.
///
/// `LiquidityVault` is a plain ERC-4626 over 6-decimal USDC with 18-decimal shares, so these are
/// the standard calls. The API has no routes for them for the same reason it has none for
/// positions: the contract is the source of truth and the client can talk to it.
///
/// Nothing here computes the exit fee. `previewRedeem` and `previewWithdraw` already account for
/// it, so the figure shown to the user is the figure the contract will pay.
export function useLpActions() {
  const send = useSendTx();
  const chain = useChainSettings();

  const approveVault = useCallback(
    async (amount: bigint): Promise<Hex> =>
      await send({
        to: chain.contracts.usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [chain.contracts.liquidityVault, amount],
        }),
      }),
    [send, chain.contracts.usdc, chain.contracts.liquidityVault],
  );

  const deposit = useCallback(
    async (assets: bigint, receiver: Address): Promise<Hex> => {
      const allowance = await publicClient().readContract({
        address: chain.contracts.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [receiver, chain.contracts.liquidityVault],
      });
      if (allowance < assets) await approveVault(maxUint256);

      return await send({
        to: chain.contracts.liquidityVault,
        data: encodeFunctionData({
          abi: liquidityVaultAbi,
          functionName: "deposit",
          args: [assets, receiver],
        }),
      });
    },
    [send, approveVault, chain.contracts.usdc, chain.contracts.liquidityVault],
  );

  const redeem = useCallback(
    async (shares: bigint, account: Address): Promise<Hex> =>
      await send({
        to: chain.contracts.liquidityVault,
        data: encodeFunctionData({
          abi: liquidityVaultAbi,
          functionName: "redeem",
          args: [shares, account, account],
        }),
      }),
    [send, chain.contracts.liquidityVault],
  );

  return {deposit, redeem};
}
