# TODO

Working list for the PWA. Cross items out as they land.

**Status:** every screen is built and renders against the live chain, both subgraphs and the
backend mock. `npm run check` is green (types, lint, format, 86 tests, API drift). Production build
succeeds and the service worker registers. Nothing has been committed yet.

**The one thing blocking everything else:** all four price feeds are stale, so no trade can open or
close. The pusher needs two keys from you.

---

## 1. Blocked on you

- [ ] **`PYTH_API_KEY`** — Hermes key for `contracts/script/price-pusher.sh`.
- [ ] **A pusher key.** `PushOracle.owner()` is `0xeeb3e0999D01f0d1Ed465513E414725a357F6ae4`;
      pushing needs an address allowlisted via `setPusher`. Either that key, or allowlist a fresh
      one. It needs testnet USDC for gas from `faucet.circle.com`.
- [ ] **Privy dashboard, app `cmtydcbsd02f00cjkdaadli5p`** — only you can change these:
  - [ ] add `http://localhost:3000` (and later the Vercel origin) to allowed origins
  - [ ] add Arc testnet (5042002, `https://rpc.testnet.arc.io`, native USDC 18-dec) to supported
        chains — without this the embedded wallet cannot sign an Arc transaction at all (risk R8)
- [ ] **Backend base URL** once the other dev deploys, plus a funded test account on it.
- [ ] **`cp env.example .env.local`** — I can't write `.env*` files.
- [ ] *Nice to have:* a second X account and a second funded testnet key, so the copy flow is
      demonstrated with two real users rather than described.
- [ ] *Separate from the app:* `cope-market/subgraphs` is private, and The Graph's Track 1 needs a
      public repo at submission (noted in `SUBGRAPH-PLAN.md`).

## 2. Unblocked the moment those land

- [ ] Run `price-pusher.sh --interval 60 --stamp-now` and confirm markets go Live.
- [ ] Verify sign-in end to end: X login → embedded wallet → `POST auth/session` → real account.
- [ ] Open a long and a short on BTC from the app; check the live P&L moves.
- [ ] Close both; assert the payout matches `lib/trade/pnl.ts` to the base unit.
- [ ] Copy from the second account; confirm `copiedFrom` is set and a profitable close pays the
      author on-chain.
- [ ] LP deposit and withdraw; confirm the receipt matches `previewRedeem` exactly.
- [ ] Point `BACKEND_ORIGIN` at the deployed backend and re-run the above.

## 3. Gaps found while building

- [ ] **Dangling route.** `components/PositionCard.tsx` links a copied position to
      `/p/token/<tokenId>`, which does not exist. Either build it (look the thesis up by token id)
      or link to the origin author's profile instead.
- [ ] **Edit your bio.** `PATCH me` is live and nothing calls it — there is no settings screen.
- [ ] **Abandoned quotes are never cancelled.** `cancelTrade` exists; backing out of the confirm
      panel should call it so the intent is not left pending.
- [ ] **Tweet embeds degrade.** The embed runs in a sandboxed iframe without `allow-same-origin`,
      which blocks X's `widgets.js` (it assigns `document.domain`). The fallback is a styled quote
      card, which looks deliberate. Decide whether that is good enough for the demo — the only way
      to get the full rendered tweet is to weaken the sandbox, and I would not.
- [ ] **Notifications inbox** is mock-only and unwired. `PLAN.md` puts push delivery out of scope;
      confirm the in-app inbox is out too, or build it.

## 4. Hardening (M7)

- [ ] **E2E signer mode.** `NEXT_PUBLIC_E2E=1` injects a funded testnet key via viem in place of
      the Privy UI. Needs a key; unblocks the whole Playwright journey.
- [ ] **Playwright suite** — signed-out shell and every error state against the mock, then the full
      journey under E2E mode: login → thesis → open → P&L → copy → close → leaderboard.
- [ ] **Lighthouse PWA audit** — must pass.
- [ ] **iOS device pass** — install to home screen, and the X OAuth round trip from a standalone
      window. The login screen already warns about this; confirm the warning is right.
- [ ] **Bundle size.** ~540 kB first load on trading screens, mostly Privy. Lazy-load `TradeSheet`
      and the chain layer off the feed.
- [ ] Error states swept once more with a real backend attached, especially `INSUFFICIENT_LIQUIDITY`
      and `QUOTE_EXPIRED`, which are hard to trigger against the mock.

## 5. Ship

- [ ] Commit and push (18 paths currently uncommitted).
- [ ] Deploy to Vercel; add the origin to Privy; point at the deployed backend.
- [ ] Architecture diagram and demo video (M7 deliverables).
- [ ] **M8 mainnet cutover, Sept 28–30** — `eth_getCode` on Pyth at `0x2880aB…` on chain 5042,
      deploy, seed the pool, enable the mainnet asset list, $1 smoke trade, submit.
