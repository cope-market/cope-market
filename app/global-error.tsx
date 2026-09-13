"use client";

/// The last resort: an error in the root layout itself, which means the providers never mounted.
/// It has to carry its own html and body, and it cannot use anything from the component library,
/// because the stylesheet is part of what failed to render.

export default function GlobalError({error}: {error: Error & {digest?: string}}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#08090b",
          color: "#e9ebef",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{fontSize: "1rem", fontWeight: 600, margin: 0}}>Cope Market failed to load</p>
          <p style={{fontSize: "0.8125rem", color: "#8d94a1", marginTop: "0.5rem"}}>
            Reload the page. Nothing on-chain is affected.
          </p>
          {error.digest ? (
            <p style={{fontSize: "0.6875rem", color: "#767d8a", marginTop: "0.75rem"}}>
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
