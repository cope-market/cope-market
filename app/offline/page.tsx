export const metadata = {title: "Offline"};

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-lg font-semibold">You are offline</h1>
      <p className="text-sm text-muted">
        Prices, positions and the feed all need a connection. Nothing is cached for this screen on
        purpose — a stale price is worse than no price.
      </p>
    </main>
  );
}
