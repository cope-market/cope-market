import {describe, expect, it} from "vitest";
import {ApiRequestError} from "./client";
import {describeApiError, isApiError} from "./errors";
import {ErrorCode} from "./schema/primitives";

describe("describeApiError", () => {
  it("has copy for every code the server can return", () => {
    for (const code of ErrorCode.options) {
      const copy = describeApiError(new ApiRequestError(code, "", 400));
      expect(copy.title, code).toBeTruthy();
      expect(copy.detail, code).toBeTruthy();
    }
  });

  it("separates the two 401 causes, which mean different things to the user", () => {
    const noAccount = describeApiError(
      new ApiRequestError("UNAUTHORIZED", "No account exists for this token", 401),
    );
    const noToken = describeApiError(new ApiRequestError("UNAUTHORIZED", "No token provided", 401));

    expect(noAccount.title).not.toBe(noToken.title);
    // A token that has not yet become an account resolves itself; being signed out does not.
    expect(noAccount.retryable).toBe(true);
    expect(noToken.retryable).toBe(false);
  });

  /// The messages the server actually sends, verbatim. The case above passes against "No token
  /// provided", which the server never says — so the missing-token branch stopped matching without
  /// a test noticing, and a signed-out user was told their session could not be verified.
  it("reads the server's real missing-token wording as being signed out", () => {
    for (const message of [
      "getMe requires a bearer token.",
      "createSession requires a bearer token.",
    ]) {
      const copy = describeApiError(new ApiRequestError("UNAUTHORIZED", message, 401));
      expect(copy.detail).toBe("You are signed out.");
      expect(copy.retryable).toBe(false);
    }
  });

  it("keeps a rejected token distinct from a missing one", () => {
    const rejected = describeApiError(
      new ApiRequestError("UNAUTHORIZED", "Access token is not valid.", 401),
    );
    const absent = describeApiError(
      new ApiRequestError("UNAUTHORIZED", "getMe requires a bearer token.", 401),
    );

    // Same dead end for the user, but they are not the same fault and must not read alike.
    expect(rejected.detail).not.toBe(absent.detail);
    expect(rejected.detail).toBe("Your session could not be verified.");
    expect(rejected.retryable).toBe(false);
  });

  it("says a refused winning close leaves the position open", () => {
    const copy = describeApiError(new ApiRequestError("INSUFFICIENT_LIQUIDITY", "", 409));
    expect(copy.detail).toMatch(/stays open/i);
  });

  it("describes a closed market as closed rather than as a failure", () => {
    expect(describeApiError(new ApiRequestError("PRICE_STALE", "", 409)).title).toMatch(/closed/i);
  });
});

describe("isApiError", () => {
  it("narrows on the code, never on the message", () => {
    const error = new ApiRequestError("QUOTE_EXPIRED", "anything at all", 409);
    expect(isApiError(error, "QUOTE_EXPIRED")).toBe(true);
    expect(isApiError(error, "PRICE_STALE")).toBe(false);
    expect(isApiError(new Error("QUOTE_EXPIRED"), "QUOTE_EXPIRED")).toBe(false);
  });
});
