"use client";

import {Suspense, useEffect} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useSession} from "@/lib/auth/session";
import {Button} from "@/components/ui";

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

  useEffect(() => {
    if (ready && authenticated) router.replace(next);
  }, [ready, authenticated, router, next]);

  return (
    <main className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-[max(4rem,env(safe-area-inset-top))]">
      <div>
        {/* The mark rather than the full lockup: the wordmark is spelled out by the heading
            below it, and repeating it twice in one screen reads as a placeholder. */}
        <img
          src="/icons/icon-192.png"
          alt="Cope Market"
          width={56}
          height={56}
          className="mb-8 size-14 rounded-2xl"
        />
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
        <div className="mb-8 size-14 rounded-2xl bg-surface" aria-hidden="true" />
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-tight">
          Trade the
          <br />
          news you read.
        </h1>
      </div>
    </main>
  );
}
