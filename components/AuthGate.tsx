"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useCallback} from "react";
import type {ReactNode} from "react";
import {useSession} from "@/lib/auth/session";
import {Button, Card, ErrorState, Skeleton} from "./ui";
import {describeApiError, isApiError} from "@/lib/api/errors";

/// Wraps a screen that needs an account. The three states it distinguishes matter: Privy still
/// restoring, signed out, and signed in but the account not yet created on our side.

export function AuthGate({children}: {children: ReactNode}) {
  const {ready, authenticated, profile, loading, error, refresh, signOut} = useSession();
  const pathname = usePathname();
  const router = useRouter();

  /// Signing in again has to start by signing out. This state is reached with Privy holding a
  /// session it considers valid while the server refuses the token it issues, so sending the user
  /// to /login while that session stands just bounces them back as already authenticated.
  const signInAgain = useCallback(() => {
    void (async () => {
      await signOut();
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    })();
  }, [signOut, router, pathname]);

  if (!ready || loading) {
    return (
      <div className="space-y-2 px-4 py-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Card className="mx-4 mt-4 p-6 text-center">
        <p className="text-[0.9375rem] font-semibold">Sign in to continue</p>
        <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] text-muted">
          This needs an account and a wallet. Both come from signing in with X.
        </p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="mt-4 inline-block">
          <Button>Continue with X</Button>
        </Link>
      </Card>
    );
  }

  if (error || !profile) {
    const copy = describeApiError(error);
    // A 401 that retrying cannot clear is the one case where the copy asks for something the user
    // has no way to do from here, so it gets the action rather than a bare message.
    const stale = isApiError(error, "UNAUTHORIZED") && !copy.retryable;
    return (
      <div className="px-4 py-4">
        <ErrorState
          title={copy.title}
          detail={copy.detail}
          onRetry={copy.retryable ? refresh : undefined}
          action={stale ? {label: "Sign in again", onClick: signInAgain} : undefined}
        />
      </div>
    );
  }

  return <>{children}</>;
}
