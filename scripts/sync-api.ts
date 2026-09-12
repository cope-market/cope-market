#!/usr/bin/env tsx
/// Copies the API contract out of the backend repository and into `lib/api`.
///
/// The backend is private, has no build step and no `exports` field, so it cannot be an npm
/// dependency without granting the deploy pipeline access to a private repository. Vendoring the
/// six files it actually defines keeps the zod schemas — and therefore runtime response validation
/// and exact types — while leaving this repository able to build on its own.
///
/// Vendored code drifts silently, so this script is also the guard. `--check` re-derives every
/// file and fails if what is on disk differs, which runs in CI.
///
///   npm run api:sync     overwrite lib/api from the backend
///   npm run api:check    fail if lib/api is not what the backend would produce

import {execFile} from "node:child_process";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {promisify} from "node:util";

const run = promisify(execFile);

const REPO = "cope-market/backend";

interface Vendored {
  /// Path in the backend repository.
  from: string;
  /// Path in this repository.
  to: string;
  /// Applied after fetching, so `--check` reproduces exactly what sync wrote.
  rewrite?: (source: string) => string;
}

const BANNER = `/// Vendored from ${REPO}. Do not edit here.
/// Run \`npm run api:sync\` to update; \`npm run api:check\` fails if this has drifted.
`;

/// The typed client sits one directory up from the schemas in the backend and one directory down
/// from them here, so its three relative imports are the only thing that has to change.
const clientImports = (source: string) => source.replaceAll("../api-schema/", "./schema/");

const FILES: Vendored[] = [
  {from: "lib/api-schema/primitives.ts", to: "lib/api/schema/primitives.ts"},
  {from: "lib/api-schema/entities.ts", to: "lib/api/schema/entities.ts"},
  {from: "lib/api-schema/route.ts", to: "lib/api/schema/route.ts"},
  {from: "lib/api-schema/routes.ts", to: "lib/api/schema/routes.ts"},
  {from: "lib/api-client/client.ts", to: "lib/api/client.ts", rewrite: clientImports},
  // Quote arithmetic has to agree with the contract to the wei, and the backend's copy is the one
  // with fixtures generated from the real contract. Sharing the file is how the sheet's preview
  // and the server's quote stay the same number.
  {from: "lib/trading/quote.ts", to: "lib/trade/quote.ts"},
  {from: "lib/trading/fixtures/quotes.json", to: "lib/trade/fixtures/quotes.json"},
  // Not imported. Kept so the frozen contract is readable in this repository and a shape change
  // shows up as a diff here.
  {from: "public/openapi.json", to: "lib/api/openapi.json"},
];

async function fetchFile(path: string): Promise<string> {
  const {stdout} = await run("gh", ["api", `repos/${REPO}/contents/${path}`, "--jq", ".content"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return Buffer.from(stdout.replaceAll("\n", ""), "base64").toString("utf8");
}

function render(file: Vendored, source: string): string {
  const rewritten = file.rewrite ? file.rewrite(source) : source;
  // JSON has nowhere to put a comment, so it is vendored bare.
  return file.to.endsWith(".json") ? rewritten : BANNER + rewritten;
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const drifted: string[] = [];

  for (const file of FILES) {
    const expected = render(file, await fetchFile(file.from));

    if (check) {
      const actual = await readFile(file.to, "utf8").catch(() => null);
      if (actual === null) drifted.push(`${file.to} is missing`);
      else if (actual !== expected) drifted.push(`${file.to} differs from ${REPO}/${file.from}`);
      continue;
    }

    await mkdir(dirname(file.to), {recursive: true});
    await writeFile(file.to, expected);
    console.log(`  ${file.to.padEnd(34)} <- ${file.from}`);
  }

  if (!check) {
    console.log(`\n${FILES.length} files synced from ${REPO}.`);
    return;
  }

  if (drifted.length > 0) {
    console.error("The vendored API contract has drifted:\n");
    for (const line of drifted) console.error(`  ${line}`);
    console.error("\nRun `npm run api:sync` and commit the result.");
    process.exit(1);
  }
  console.log(`lib/api matches ${REPO}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    `\nThis needs \`gh\` authenticated against ${REPO}, which is private. ` +
      "Run `gh auth status` to check.",
  );
  process.exit(1);
});
