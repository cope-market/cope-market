"use client";

import {createContext, useContext, useMemo} from "react";
import type {ReactNode} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {createApiClient} from "./client";
import type {ApiClient} from "./client";
import {ApiRequestError} from "./client";

/// The typed client, built once and handed to the tree.
///
/// `getAccessToken` is passed in rather than imported so this module knows nothing about Privy:
/// the client sends the token whenever one is available, including on public routes, because that
/// is what populates `viewerHasLiked` and the feed's following tab.

const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside <ApiProvider>.");
  return client;
}

/// Relative by default, so requests are same-origin and the rewrite in next.config.ts reaches the
/// backend. CORS then never becomes something two repositories have to agree about.
function baseUrl(): string {
  return process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "/api/v1";
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Retrying a rejection the server has already decided on just delays the message.
          if (error instanceof ApiRequestError && error.status < 500 && error.status !== 429) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

export function ApiProvider({
  children,
  getAccessToken,
}: {
  children: ReactNode;
  getAccessToken: () => Promise<string | null>;
}) {
  const queryClient = useMemo(makeQueryClient, []);
  const api = useMemo(
    () => createApiClient({baseUrl: baseUrl(), getAccessToken}),
    [getAccessToken],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}
