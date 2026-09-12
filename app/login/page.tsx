"use client";

import {Suspense, useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {isStandalone, useSession} from "@/lib/auth/session";
import {Button, Card} from "@/components/ui";

/// Sign-in is X, through Privy, with an embedded wallet created on the way.

/// `useSearchParams` forces this subtree to render on the client, so it needs a boundary the
/// prerender can stop at. The fallback is the page's own frame without the button, which is what
/// the first paint would show anyway.
export default function LoginPage() {
  return (
    <Suspense fallback={<SignInFrame />}>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const {ready, authenticated, signIn, loading} = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/feed";
  const [installed, setInstalled] = useState(false);

  useEffect(() => setInstalled(isStandalone()), []);

  useEffect(() => {
    if (ready && authenticated) router.replace(next);
  }, [ready, authenticated, router, next]);

  return (
    <main className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-[max(4rem,env(safe-area-inset-top))]">
      <div>
        <div className="mb-8 size-14 rounded-2xl bg-accent" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            className="size-14 p-3"
            fill="none"
            stroke="#0c0a1a"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7l4 8 4-3.5 4 5.5 4-11" />
          </svg>
        </div>
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight">
          Trade the
          <br />
          news you read.
        </h1>
        <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-muted">
          Post a thesis on an event, back it with a real position on Arc, and copy the ones you
          believe. Positions settle on-chain; so does the author&apos;s cut.
        </p>
      </div>

      <div className="space-y-3">
        {installed ? (
          <Card className="p-3.5">
            <p className="text-[0.8125rem] leading-relaxed text-muted">
              You are running the installed app. Signing in with X leaves and returns, which an
              installed window on iOS handles poorly. If it does not come back, open Cope Market in
              Safari, sign in there, then reopen the app.
            </p>
          </Card>
        ) : null}

        <Button onClick={signIn} disabled={!ready || loading} className="w-full">
          {ready ? "Continue with X" : "Loading…"}
        </Button>

        <p className="text-center text-[0.75rem] leading-relaxed text-dim">
          A wallet is created for you. Everything is on Arc testnet, and the pool is seeded by the
          team — this is a demonstration, not a venue with real money in it.
        </p>
      </div>
    </main>
  );
}

/// The shape of the screen, with nothing in it that depends on the URL.
function SignInFrame() {
  return (
    <main className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-[max(4rem,env(safe-area-inset-top))]">
      <div>
        <div className="mb-8 size-14 rounded-2xl bg-accent" aria-hidden="true" />
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight">
          Trade the
          <br />
          news you read.
        </h1>
      </div>
    </main>
  );
}
