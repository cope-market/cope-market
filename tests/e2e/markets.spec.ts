import {expect, test} from "@playwright/test";

/// Markets read straight from the contracts, so these assert against the live Arc testnet
/// deployment rather than against a fixture. The list itself comes from `enabledFeeds()`.

const BTC = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

test("every enabled market is listed with a price", async ({page}) => {
  await page.goto("/markets");

  for (const symbol of ["EUR/USD", "XAU/USD", "BTC/USD", "TSLA/USD"]) {
    await expect(page.getByText(symbol, {exact: true})).toBeVisible();
  }

  // Whatever the price is, it is a grouped decimal rather than a raw wad.
  await expect(page.locator(".num").first()).toHaveText(/^[\d,]+\.\d+$/);
});

test("a market states whether it can be traded, and the trade buttons follow", async ({page}) => {
  await page.goto(`/markets/${BTC}`);

  await expect(page.getByRole("heading", {name: "BTC/USD"})).toBeVisible();

  const long = page.getByRole("button", {name: "Long", exact: true});
  const badge = page.getByText(/Live|Closed|Paused|No price/).first();
  await expect(badge).toBeVisible();

  // The button's state must agree with the badge. A closed market that still offers a trade would
  // send the user into a revert.
  const closed = await page.getByText(/Market closed|not open for new positions/).count();
  if (closed > 0) {
    await expect(long).toBeDisabled();
  } else {
    await expect(long).toBeEnabled();
  }
});

test("risk parameters are shown as read from the contract", async ({page}) => {
  await page.goto(`/markets/${BTC}`);

  await expect(page.getByText("Risk parameters")).toBeVisible();
  await expect(page.getByText("Max position")).toBeVisible();
  await expect(page.getByText(/enforced by the contract, not by this screen/)).toBeVisible();
});

test("an unknown feed is not a crash", async ({page}) => {
  await page.goto(`/markets/0x${"ab".repeat(32)}`);
  await expect(page.getByText("Not a live market")).toBeVisible();
});
