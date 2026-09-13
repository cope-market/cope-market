"use client";

import {createContext, useCallback, useContext} from "react";
import type {ReactNode} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets} from "@privy-io/react-auth";
import type {Address} from "viem";
import {useApi} from "../api/provider";
import type {Profile} from "../api/schema/entities";
import type {z} from "zod";

/// Signing in is two steps, and the second is not optional.
///
/// Privy authenticates the user and issues an access token. That token is a credential, not an
/// account: until `POST auth/session` has been called once, every authenticated route answers
/// UNAUTHORIZED with "No account exists for this token". So the session query calls it — the
/// endpoint creates the account on first sight and returns the profile on every sight after, which
/// makes it both the bootstrap and the source of the signed-in profile.

export type ProfileData = z.infer<typeof Profile>;

export interface Session {
  /// Privy has finished restoring any previous session. Nothing below is meaningful until this.
  ready: boolean;
  authenticated: boolean;
  profile: ProfileData | null;
  /// The embedded wallet's address, once Privy has created one.
  address: Address | undefined;
  /// True while the account is being created or the profile fetched.
  loading: boolean;
  error: unknown;
  signIn: () => void;
  signOut: () => Promise<void>;
  refresh: () => void;
}

/// Session state is provided rather than computed in place, because the Privy hooks only work
/// inside a PrivyProvider and the app deliberately runs without one when no app id is configured —
/// a fresh checkout, and CI. Choosing between two providers is a component boundary, which is
/// allowed; calling `usePrivy` conditionally is not.
const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>.");
  return session;
}

const SIGNED_OUT: Session = {
  ready: true,
  authenticated: false,
  profile: null,
  address: undefined,
  loading: false,
  error: null,
  signIn: () => {},
  signOut: async () => {},
  refresh: () => {},
};

/// For when there is no Privy app id. Everything renders in its signed-out state, which is what
/// makes a fresh clone useful before anyone has touched configuration.
export function AnonymousSessionProvider({children}: {children: ReactNode}) {
  return <SessionContext.Provider value={SIGNED_OUT}>{children}</SessionContext.Provider>;
}

export function PrivySessionProvider({children}: {children: ReactNode}) {
  const session = usePrivySession();
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

function usePrivySession(): Session {
  const {ready, authenticated, user, login} = usePrivy();
  const {logout} = useLogout();
  const {wallets} = useWallets();
  const api = useApi();
  const queryClient = useQueryClient();

  const wallet = getEmbeddedConnectedWallet(wallets);
  const address = wallet?.address as Address | undefined;

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["session", user?.id],
    queryFn: async () => (await api.createSession({body: {}})).profile,
    enabled: ready && authenticated,
    staleTime: 5 * 60_000,
    // Creating the account is the server's job and it is idempotent, so a transient failure is
    // worth retrying rather than showing as a broken sign-in.
    retry: 2,
  });

  const signOut = useCallback(async () => {
    await logout();
    // Everything cached was scoped to the person who has just left.
    queryClient.clear();
  }, [logout, queryClient]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({queryKey: ["session"]});
  }, [queryClient]);

  return {
    ready,
    authenticated,
    profile: profile ?? null,
    address,
    loading: (ready && authenticated && isLoading) || !ready,
    error,
    signIn: login,
    signOut,
    refresh,
  };
}

/// True when the app is running as an installed PWA rather than in a browser tab.
///
/// It matters for sign-in: X's OAuth flow leaves and returns to the app, and on iOS a standalone
/// window handles that badly enough that the honest advice is to sign in before installing.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as {standalone?: boolean}).standalone === true
  );
}
