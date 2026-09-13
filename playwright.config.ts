import {defineConfig, devices} from "@playwright/test";

/// End-to-end tests run against the app as a phone, because that is what it is.
///
/// Everything in `tests/e2e` runs signed out, against the backend mock and the live chain. The
/// signed-in journey needs a funded key and a Privy app configured for this origin, so it lives
/// behind `NEXT_PUBLIC_E2E=1` and is not part of this suite yet.
///
/// These run against a production build, not the dev server, and that is not incidental: Next's
/// development chunk loading is cancelled by WebKit, so every page renders its shell and never
/// hydrates. The same pages are perfect once built. Testing the dev server would have meant
/// chasing a bug that does not exist in the thing we ship — and it is the built output that has a
/// service worker, which is half of what a PWA is.

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3100",
    trace: "on-first-retry",
    colorScheme: "dark",
  },
  projects: [
    {name: "phone", use: {...devices["iPhone 13"]}},
    {name: "desktop", use: {...devices["Desktop Chrome"]}},
  ],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      // The mock, not the live tunnel: these tests assert on fixture content, and a tunnel URL
      // that changes when it restarts is not something a suite should depend on. Override
      // BACKEND_ORIGIN to point a run at the real backend.
      BACKEND_ORIGIN: process.env["BACKEND_ORIGIN"] ?? "http://localhost:4000",
      // Built without a Privy app id on purpose. This suite is entirely signed out, and the
      // alternative is every test pulling in a third party's script, cookies and CSP — which makes
      // a CI run depend on someone else's uptime to assert that a tab bar works. It also keeps the
      // no-app-id path exercised, which is the path a fresh clone takes.
      //
      // The signed-in journey needs the real app id and a funded key, and lives behind
      // NEXT_PUBLIC_E2E=1 instead.
      NEXT_PUBLIC_PRIVY_APP_ID: "",
    },
  },
});
