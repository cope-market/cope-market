import {expect, test} from "@playwright/test";

/// The progressive web app parts: the manifest a phone installs from, and the promise that a price
/// or a trade is never served from a cache.

test("the manifest describes an installable app", async ({request}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();

  const manifest = (await response.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: {sizes: string; purpose?: string}[];
  };

  expect(manifest.name).toBe("Cope Market");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/feed");

  // Android needs a maskable icon, and both platforms need 192 and 512.
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
});

test("the icons the manifest names actually exist", async ({request}) => {
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("the viewport is set up for a phone", async ({page}) => {
  await page.goto("/feed");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  // viewport-fit=cover is what lets the tab bar sit correctly above the home indicator.
  expect(viewport).toContain("viewport-fit=cover");
});

test("the service worker never answers an API request from its cache", async ({page}) => {
  await page.goto("/feed");

  // Wait for the worker to install and take control before judging what it cached.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  });

  // Visit screens that fetch from every part of the API, so anything cacheable would be cached.
  for (const route of ["/leaderboard", "/markets", "/feed"]) {
    await page.goto(route);
    await page.waitForTimeout(1_500);
  }

  // Serwist's default runtime caching puts same-origin /api/ GETs in a cache called "apis" with a
  // 24-hour expiry. Nothing of ours may end up there: a stale leaderboard is a wrong ranking
  // presented as a right one, and a stale quote is one the contract will reject.
  const cachedApiRequests = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith("/api/")) urls.push(request.url);
      }
    }
    return urls;
  });

  expect(cachedApiRequests).toEqual([]);
});
