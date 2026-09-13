import {expect, test} from "@playwright/test";

/// The signed-out shell: what someone sees before they have an account, and what the tab bar does.

test("the feed lists theses and switches tabs", async ({page}) => {
  await page.goto("/feed");

  await expect(page.getByRole("heading", {name: "Cope Market"})).toBeVisible();
  await expect(page.getByRole("heading", {name: /Cuts are coming/})).toBeVisible();

  await page.getByRole("button", {name: "Top"}).click();
  await expect(page.getByRole("button", {name: "Top"})).toHaveAttribute("aria-pressed", "true");
});

test("the following tab asks a signed-out reader to sign in, rather than showing an empty feed", async ({
  page,
}) => {
  await page.goto("/feed");
  await page.getByRole("button", {name: "Following"}).click();

  await expect(page.getByText("Sign in to follow people")).toBeVisible();
});

test("the tab bar reaches every screen", async ({page}) => {
  await page.goto("/feed");

  // Asserting on the route rather than on a heading: the wallet is behind an auth gate and shows
  // a sign-in card instead of its title when signed out, which is correct and would otherwise
  // make this test demand the wrong thing.
  for (const [label, path] of [
    ["Markets", "/markets"],
    ["Board", "/leaderboard"],
    ["Pool", "/lp"],
    ["Wallet", "/wallet"],
    ["Feed", "/feed"],
  ] as const) {
    await page.getByRole("link", {name: label}).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("a screen that needs an account says so instead of failing", async ({page}) => {
  await page.goto("/wallet");
  await expect(page.getByText("Sign in to continue")).toBeVisible();
});

test("the offline page explains why nothing is cached", async ({page}) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", {name: "You are offline"})).toBeVisible();
  await expect(page.getByText(/stale price is worse than no price/)).toBeVisible();
});

test("the root redirects to the feed", async ({page}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/feed$/);
});
