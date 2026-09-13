#!/usr/bin/env tsx
/// Screenshots a route at phone size, and reports anything the page logged while doing it.
///
///   npm run shot -- /markets [name]
///
/// A PWA is a phone application that happens to run in a browser, so the default viewport is a
/// phone. Console errors are printed because a client-rendered screen can look finished and be
/// throwing on every refetch.

import {chromium} from "@playwright/test";
import {mkdir} from "node:fs/promises";

const route = process.argv[2] ?? "/feed";
const slug = route.replace(/\W+/g, "-").replace(/^-|-$/g, "");
const name = process.argv[3] ?? (slug === "" ? "root" : slug);
const baseUrl = process.env["SHOT_BASE_URL"] ?? "http://localhost:3000";

async function main(): Promise<void> {
  await mkdir("screenshots", {recursive: true});

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: {width: 390, height: 844}, // iPhone 15
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

  // Not `networkidle`: prices poll and Privy holds a connection open, so the network is never
  // idle by design. Load, then give the first multicall and the first API call time to land.
  await page.goto(`${baseUrl}${route}`, {waitUntil: "domcontentloaded", timeout: 45_000});
  // Long enough for the first multicall and the API call behind it. A development build compiles
  // the route on first request, so this is generous on purpose.
  await page.waitForTimeout(12_000);

  const path = `screenshots/${name}.png`;
  await page.screenshot({path, fullPage: true});
  console.log(`${path}  ${route}`);

  if (problems.length > 0) {
    console.log("\nthe page complained:");
    for (const problem of [...new Set(problems)]) console.log(`  ${problem}`);
  }

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
