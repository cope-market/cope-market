"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {useSession} from "@/lib/auth/session";
import {useChainSettings} from "@/lib/chain/config";
import {useLpPosition, useMarkets, useOpenInterest, useVault, useWallet} from "@/lib/chain/hooks";
import {useLpActions} from "@/lib/chain/write";
import {useVaultHistory} from "@/lib/graph/hooks";
import {AmountInput} from "@/components/AmountInput";
import {SharePriceChart} from "@/components/SharePriceChart";
import {AsOf, Button, Card, ErrorState, Row, Screen, Skeleton} from "@/components/ui";
import {formatBps, formatUsdc6, formatWad, parseUsdc6, percentOf, wadFromUsdc6} from "@/lib/format";

/// The liquidity vault: counterparty to every position.
///
/// The live figure comes from the contract and the history from the subgraph, and the screen says
/// which is which. They disagree by design — the pool's assets move as traders win and lose
/// against it, and none of that emits a log for an indexer to see.

export default function LpPage() {
  const {address, authenticated} = useSession();
  const chain = useChainSettings();
  const vault = useVault();
  const markets = useMarkets();
  const {data: openInterest} = useOpenInterest(markets.data?.rows);
  const position = useLpPosition(address);
  const wallet = useWallet(address);
  const history = useVaultHistory(chain.contracts.liquidityVault);
  const {deposit, redeem} = useLpActions();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalOi = (openInterest ?? []).reduce((sum, row) => sum + row.long + row.short, 0n);
  // Open interest is an 18-decimal USD figure and the pool's assets are 6-decimal USDC, so one has
  // to be scaled before the two can be compared at all.
  const utilization = vault.data ? percentOf(totalOi, wadFromUsdc6(vault.data.totalAssets)) : null;

  const parsed = parseUsdc6(amount);

  async function submit() {
    if (!address || parsed === null || parsed === 0n) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "deposit") {
        await deposit(parsed, address);
      } else {
        // The input is in USDC; redeem takes shares, so convert at the current share price.
        const shares =
          vault.data && vault.data.totalAssets > 0n
            ? (parsed * vault.data.totalShares) / vault.data.totalAssets
            : 0n;
        await redeem(shares, address);
      }
      setAmount("");
      await Promise.all([vault.refetch(), position.refetch(), wallet.refetch()]);
      void queryClient.invalidateQueries({queryKey: ["graph", "vault"]});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Pool" subtitle="Counterparty to every position on Cope Market.">
      <Card className="p-4">
        {vault.isLoading ? (
          <Skeleton className="h-20" />
        ) : vault.isError || !vault.data ? (
          <ErrorState title="Cannot read the vault" detail="The Arc RPC did not answer." />
        ) : (
          <>
            <p className="text-[0.75rem] text-dim">Total assets</p>
            <p className="num mt-1 text-[2rem] font-semibold leading-none tracking-tight">
              {formatUsdc6(vault.data.totalAssets)}
              <span className="ml-1.5 text-[0.875rem] font-medium text-muted">USDC</span>
            </p>

            <dl className="mt-4 space-y-0.5 border-t border-line pt-3">
              <Row label="Shares outstanding" value={formatWad(vault.data.totalShares)} />
              <Row
                label="Owed to open positions"
                value={`${formatWad(vault.data.totalLiability, {sign: true})} USD`}
                hint={vault.data.totalLiability > 0n ? "pool is down" : "pool is up"}
              />
              <Row
                label="Utilization"
                value={utilization === null ? "n/a" : `${utilization.toFixed(0)}%`}
                hint="open interest vs assets"
              />
              <Row label="Exit fee" value={formatBps(vault.data.exitFeeBps)} />
            </dl>

            <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
              Total assets already nets out what the pool owes open positions. Without that, an LP
              could deposit just before traders lose and withdraw just before they win, at the
              expense of everyone else in the pool.
            </p>
          </>
        )}
      </Card>

      <section className="mt-4">
        <h2 className="mb-2 text-[0.875rem] font-semibold">Share price</h2>
        {history.isLoading ? (
          <Skeleton className="h-28" />
        ) : history.isError ? (
          <p className="text-[0.8125rem] text-muted">
            The subgraph did not answer, so there is no history to draw. The live figure above is
            unaffected — it comes from the contract.
          </p>
        ) : (
          <>
            <SharePriceChart snapshots={history.data?.snapshots ?? []} />
            {history.data?.summary ? (
              <AsOf>
                History from the ERC-4626 subgraph, as of block{" "}
                {String(history.data.summary.lastUpdatedBlock)}. Its total assets figure lags the
                contract&apos;s, because the pool&apos;s value moves without emitting an event.
              </AsOf>
            ) : null}
          </>
        )}
      </section>

      {authenticated ? (
        <Card className="mt-4 p-4">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-raised p-1">
            {(["deposit", "withdraw"] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setMode(option);
                  setAmount("");
                }}
                className={`h-9 rounded-lg text-[0.875rem] font-semibold capitalize transition ${
                  mode === option ? "bg-overlay text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={mode === "deposit" ? wallet.data?.usdc : position.data?.maxWithdraw}
            disabled={busy}
          />

          {mode === "withdraw" && position.data ? (
            <dl className="mt-3 space-y-0.5 border-t border-line pt-3">
              <Row label="Your shares" value={formatWad(position.data.shares)} />
              <Row
                label="Worth now"
                value={`${formatUsdc6(position.data.redeemable)} USDC`}
                hint="exit fee included"
              />
            </dl>
          ) : null}

          {error ? <p className="mt-3 text-[0.8125rem] text-short">{error}</p> : null}

          <Button
            onClick={() => void submit()}
            disabled={busy || parsed === null || parsed === 0n}
            className="mt-4 w-full"
          >
            {busy ? "Working…" : mode === "deposit" ? "Deposit USDC" : "Withdraw"}
          </Button>

          <p className="mt-2 text-[0.6875rem] leading-relaxed text-dim">
            Shares are 18-decimal and the asset is 6-decimal, deliberately, so a small deposit
            cannot round to nothing. Withdrawals quote what you receive after the{" "}
            {vault.data ? formatBps(vault.data.exitFeeBps) : "exit"} fee, which stays with the
            remaining LPs.
          </p>
        </Card>
      ) : (
        <Card className="mt-4 p-4 text-center">
          <p className="text-[0.875rem] font-medium">Sign in to provide liquidity</p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            LPs take the other side of every trade. Trader losses and fees become LP yield; trader
            wins come out of the pool.
          </p>
        </Card>
      )}
    </Screen>
  );
}
