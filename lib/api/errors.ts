import {ApiRequestError} from "./client";
import type {ErrorCode} from "./schema/primitives";

/// What each error code means to a person.
///
/// The codes are a closed set and the server's `message` is explicitly not for switching on, so
/// this is the one place that decides what a rejection looks like. Several of these describe the
/// protocol working correctly — a closed market, a full side of the book — and reading as a
/// malfunction would be wrong.

type Copy = {title: string; detail: string; retryable: boolean};

const COPY: Record<ErrorCode | "NETWORK" | "MALFORMED_RESPONSE", Copy> = {
  UNAUTHORIZED: {
    title: "Sign in to continue",
    detail: "Your session has expired or was never started.",
    retryable: false,
  },
  FORBIDDEN: {title: "Not allowed", detail: "This is not yours to change.", retryable: false},
  NOT_FOUND: {title: "Not found", detail: "This no longer exists.", retryable: false},
  VALIDATION: {
    title: "Check the details",
    detail: "Something in that request was not valid.",
    retryable: false,
  },
  CONFLICT: {title: "Already done", detail: "That has already happened.", retryable: false},
  RATE_LIMITED: {
    title: "Slow down",
    detail: "Too many requests. Try again in a moment.",
    retryable: true,
  },
  INTERNAL: {
    title: "Something broke",
    detail: "That failed on our side. Try again.",
    retryable: true,
  },

  PRICE_STALE: {
    title: "Market closed",
    detail: "Prices have stopped publishing for this asset. Crypto markets trade around the clock.",
    retryable: false,
  },
  PRICE_UNAVAILABLE: {
    title: "No price yet",
    detail: "This asset has no price to trade against.",
    retryable: true,
  },
  ASSET_DISABLED: {
    title: "Market paused",
    detail: "This market is not open for new positions. Existing positions can still be closed.",
    retryable: false,
  },
  CONFIDENCE_TOO_WIDE: {
    title: "Price too uncertain",
    detail: "The oracle is not confident enough right now. Try again shortly.",
    retryable: true,
  },
  POSITION_CAP_EXCEEDED: {
    title: "Above the position cap",
    detail: "Reduce the size and try again.",
    retryable: false,
  },
  OPEN_INTEREST_CAP_EXCEEDED: {
    title: "This side is full",
    detail: "Open interest is at its cap. Try the other side, or a smaller size.",
    retryable: false,
  },
  INSUFFICIENT_LIQUIDITY: {
    title: "Pool cannot cover this",
    detail:
      "The liquidity pool cannot fund this payout yet. Your position stays open and can be closed later.",
    retryable: true,
  },
  INSUFFICIENT_BALANCE: {
    title: "Not enough USDC",
    detail: "Top up from the faucet and try again.",
    retryable: false,
  },
  QUOTE_EXPIRED: {
    title: "Quote expired",
    detail: "Prices move. Request a fresh quote.",
    retryable: true,
  },
  GEO_BLOCKED: {
    title: "Not available here",
    detail: "This is not available in your region.",
    retryable: false,
  },

  NETWORK: {
    title: "Cannot reach the server",
    detail: "Check your connection and try again.",
    retryable: true,
  },
  MALFORMED_RESPONSE: {
    title: "Unexpected response",
    detail: "The server answered with something this app could not read.",
    retryable: true,
  },
};

/// A 401 has two distinct causes and they deserve different things said about them. The server
/// separates them in its message on purpose: a valid Privy token is not yet an account.
function unauthorizedCopy(message: string): Copy {
  if (/no account exists/i.test(message)) {
    return {
      title: "Finishing sign-in",
      detail: "Your account is still being created. This resolves on its own in a moment.",
      retryable: true,
    };
  }
  if (/no token|missing/i.test(message)) {
    return {title: "Sign in to continue", detail: "You are signed out.", retryable: false};
  }
  return {
    title: "Sign in again",
    detail: "Your session could not be verified.",
    retryable: false,
  };
}

export function describeApiError(error: unknown): Copy {
  if (error instanceof ApiRequestError) {
    if (error.code === "UNAUTHORIZED") return unauthorizedCopy(error.message);
    return COPY[error.code];
  }
  if (error instanceof Error && /fetch|network/i.test(error.message)) return COPY.NETWORK;
  return {title: "Something broke", detail: "That did not work. Try again.", retryable: true};
}

export function isApiError(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiRequestError && error.code === code;
}
