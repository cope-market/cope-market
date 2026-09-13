"use client";

import {useState} from "react";
import Link from "next/link";
import {AuthGate} from "@/components/AuthGate";
import {PositionCard} from "@/components/PositionCard";
import {ClosePositionSheet, EditBioSheet} from "@/components/lazy";
import {SettledNotice} from "@/components/SettledNotice";

import {AsOf, Button, Card, Empty, ErrorState, Pill, Row, Screen, Skeleton} from "@/components/ui";
import {useSession} from "@/lib/auth/session";
import {useWallet} from "@/lib/chain/hooks";
import {useLivePositions} from "@/lib/chain/position";
import {useChainSettings} from "@/lib/chain/config";
import {useApproveUsdc} from "@/lib/chain/write";
import {explorerAddressUrl} from "@/lib/chain/arc";
import {formatGasBalance, formatUsdc6, shortAddress} from "@/lib/format";

/// Balances, the vault's allowance, and what the account currently holds.
///
/// The two balances on this screen are the same USDC at different scales, and the copy says so.
/// Getting that wrong is a factor of a million in the interface, and it is the single most common
/// way to be wrong on Arc.

/// Below this there is not enough native USDC to pay for a transaction at Arc's 20 gwei floor.
const GAS_FLOOR = 10n ** 15n; // 0.001 USDC

export default function WalletPage() {
  return (
    <AuthGate>
      <Wallet />
    </AuthGate>
  );
}

function Wallet() {
  const {profile, address, signOut} = useSession();
  const chain = useChainSettings();
  const wallet = useWallet(address);
  const approve = useApproveUsdc();
  const {
    positions,
    settled,
    isLoading: positionsLoading,
    isError: positionsError,
    refetch,
  } = useLivePositions(address);

  const [closingTokenId, setClosingTokenId] = useState<bigint | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const needsApproval = wallet.data ? wallet.data.vaultAllowance < 1_000_000n : false;
  const lowOnGas = wallet.data ? wallet.data.gas < GAS_FLOOR : false;

  async function onApprove() {
    setApproving(true);
    setApprovalError(null);
    try {
      await approve();
      await wallet.refetch();
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : "The approval failed.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <Screen
      title={profile?.name ?? "Wallet"}
      subtitle={profile ? `@${profile.handle}` : undefined}
      action={
        <button
          onClick={() => void signOut()}
          className="text-[0.8125rem] text-muted hover:text-ink"
        >
          Sign out
        </button>
      }
    >
      <Card className="mb-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-[0.8125rem] leading-relaxed ${profile?.bio ? "text-muted" : "text-dim"}`}
          >
            {profile?.bio ?? "No bio yet. It is the first thing someone reads before copying you."}
          </p>
          <button
            onClick={() => setEditingBio(true)}
            className="shrink-0 text-[0.8125rem] font-medium text-accent"
          >
            Edit
          </button>
        </div>
      </Card>

      <Card className="p-4">
        {wallet.isLoading ? (
          <Skeleton className="h-24" />
        ) : wallet.isError ? (
          <p className="text-[0.8125rem] text-muted">
            The Arc RPC did not answer, so balances are unknown.
          </p>
        ) : wallet.data ? (
          <>
            <p className="text-[0.75rem] text-dim">Spendable</p>
            <p className="num mt-1 text-[2rem] font-semibold leading-none tracking-tight">
              {formatUsdc6(wallet.data.usdc)}
              <span className="ml-1.5 text-[0.875rem] font-medium text-muted">USDC</span>
            </p>

            <div className="mt-4 space-y-0.5 border-t border-line pt-3">
              <Row
                label="For gas"
                value={`${formatGasBalance(wallet.data.gas)} USDC`}
                hint={lowOnGas ? "too low" : undefined}
              />
              <Row
                label="Vault allowance"
                value={
                  wallet.data.vaultAllowance > 10n ** 18n
                    ? "Unlimited"
                    : `${formatUsdc6(wallet.data.vaultAllowance)} USDC`
                }
              />
              <Row label="Positions held" value={String(wallet.data.positionCount)} />
            </div>

            <p className="mt-3 text-[0.6875rem] leading-relaxed text-dim">
              Both figures are the same USDC. Arc&apos;s native balance has 18 decimals and pays
              gas; the ERC-20 view has 6 and is what every contract here takes.
            </p>
          </>
        ) : null}
      </Card>

      {lowOnGas ? (
        <Card className="mt-2 p-4">
          <p className="text-[0.875rem] font-medium text-warn">Not enough to pay for gas</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Arc charges gas in USDC and enforces a 20 gwei floor. Top up from the Circle faucet.
          </p>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[0.8125rem] font-medium text-accent"
          >
            Open the faucet →
          </a>
        </Card>
      ) : null}

      {needsApproval ? (
        <Card className="mt-2 p-4">
          <p className="text-[0.875rem] font-medium">Approve USDC once</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            The vault pulls collateral when you open a position, so it needs an allowance first.
            This is a plain token approval and it only happens once.
          </p>
          {approvalError ? (
            <p className="mt-2 text-[0.8125rem] text-short">{approvalError}</p>
          ) : null}
          <Button onClick={() => void onApprove()} disabled={approving} className="mt-3 w-full">
            {approving ? "Approving…" : "Approve USDC"}
          </Button>
        </Card>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold">
          Open positions
          {positions.length > 0 ? <Pill>{positions.length}</Pill> : null}
        </h2>

        <SettledNotice positions={settled} />

        {positionsLoading ? (
          <Skeleton className="h-32" />
        ) : positionsError ? (
          <ErrorState
            title="Cannot list your positions"
            detail="Open positions are found through the subgraph, which did not answer. Your positions are safe on-chain either way."
            onRetry={refetch}
          />
        ) : positions.length === 0 && settled.length === 0 ? (
          <Empty
            title="No open positions"
            detail="Back a thesis, or open one directly from a market."
          />
        ) : (
          <ul className="space-y-2">
            {positions.map((live) => (
              <li key={String(live.position.tokenId)}>
                <PositionCard live={live} onClose={setClosingTokenId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {address ? (
        <AsOf>
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="hover:text-muted"
          >
            {shortAddress(address)} on Arcscan
          </a>
          {" · "}
          Balances read live from the chain. The list of positions comes from the subgraph and can
          lag it by a block.
          {!chain.fromServer ? " Contract addresses are the built-in fallbacks." : null}
        </AsOf>
      ) : null}

      <p className="mt-2 flex gap-4 text-[0.6875rem]">
        {profile ? (
          <Link href={`/u/${profile.handle}`} className="text-accent">
            Your public profile →
          </Link>
        ) : null}
        <Link href="/markets" className="text-accent">
          Browse markets →
        </Link>
      </p>

      <EditBioSheet
        open={editingBio}
        onClose={() => setEditingBio(false)}
        bio={profile?.bio ?? null}
      />

      <ClosePositionSheet
        live={positions.find((live) => live.position.tokenId === closingTokenId) ?? null}
        open={closingTokenId !== null}
        onDone={() => {
          setClosingTokenId(null);
          refetch();
        }}
      />
    </Screen>
  );
}
