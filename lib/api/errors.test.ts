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
