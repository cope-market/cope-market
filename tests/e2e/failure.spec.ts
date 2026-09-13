import {expect, test} from "@playwright/test";

/// Service workers are blocked for this file. `page.route` cannot intercept a request that a
/// service worker makes on the page's behalf, so without this the mocked failures never happen and
/// every test here passes against the real API — which is the worst kind of green.
test.use({serviceWorkers: "block"});

/// How the app behaves when something it depends on is unavailable.
///
/// The two cases are deliberately different, and that difference is the point. A leaderboard built
/// from missing data is a wrong order presented as a right one, so it refuses; a profile is worth
/// showing without its P&L figure, so it degrades. Testing them together stops one drifting into
/// the other.

test("the leaderboard refuses rather than ranking on data it does not have", async ({page}) => {
  await page.route("**/api/v1/leaderboard*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({error: {code: "INTERNAL", message: "subgraph unavailable"}}),
    }),
  );

  await page.goto("/leaderboard");

  await expect(page.getByText("The board is unavailable")).toBeVisible();
  await expect(page.getByText(/showing nothing/)).toBeVisible();
});

test("a profile still renders when the subgraph is gone", async ({page}) => {
  await page.route("**/api.studio.thegraph.com/**", (route) => route.abort());

  await page.goto("/u/alice_macro");

  // Identity and follow counts come from the API and survive.
  await expect(page.getByRole("heading", {name: "Alice"})).toBeVisible();
  await expect(page.getByText("Followers")).toBeVisible();
  // The results do not, and the screen says so rather than printing zeros.
  await expect(page.getByText(/results are unavailable/i)).toBeVisible({timeout: 15_000});
});

test("the feed reports an unreachable API instead of looking empty", async ({page}) => {
  await page.route("**/api/v1/feed*", (route) => route.abort());

  await page.goto("/feed");
  await expect(page.getByText(/Cannot reach the server|Something broke/)).toBeVisible();
});

test("a thesis that never got a position says so", async ({page}) => {
  await page.goto("/feed");
  // The second fixture thesis has a null tokenId.
  await expect(page.getByText("No position").first()).toBeVisible();
});

test("an unknown thesis is handled, not crashed", async ({page}) => {
  await page.route("**/api/v1/theses/**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({error: {code: "NOT_FOUND", message: "no such thesis"}}),
    }),
  );

  await page.goto("/p/6f1c9f40-0000-4000-8000-000000000009");
  await expect(page.getByText("Not found")).toBeVisible();
});
