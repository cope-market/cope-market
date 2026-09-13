"use client";

import {useEffect} from "react";
import Link from "next/link";
import {Button, Card} from "@/components/ui";

/// What a runtime error looks like. Without this Next renders its own page, which is unstyled and
/// light — jarring in a dark app, and it tells the user nothing they can act on.

export default function Error({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  useEffect(() => {
    // No error reporting service is wired up, so the console is where this goes. Better than
    // swallowing it, which would make a report from a judge impossible to chase.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="w-full max-w-sm p-6 text-center">
        <p className="text-[1rem] font-semibold">Something broke on this screen</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-muted">
          Your positions and balances are on-chain and are unaffected by whatever this was.
        </p>
        {error.digest ? <p className="num mt-3 text-[0.6875rem] text-dim">{error.digest}</p> : null}
        <div className="mt-5 space-y-2">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Link href="/feed" className="block">
            <Button tone="quiet" className="w-full">
              Back to the feed
            </Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
