import withSerwistInit from "@serwist/next";
import type {NextConfig} from "next";

/// The backend lives in its own repository and its own deployment. Proxying it under our own
/// origin means the browser never makes a cross-origin request, so CORS configuration stops being
/// something two repositories have to agree on, and the service worker sees API traffic on the
/// same origin as the shell.
const backendOrigin = process.env["BACKEND_ORIGIN"] ?? "http://localhost:4000";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // A service worker in development caches the thing you just changed. Register it only in a
  // production build, and test the PWA against `npm run build && npm start`.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev overlay's badge sits exactly where the first tab is, which makes every screenshot of
  // the bottom bar wrong.
  devIndicators: false,
  /// Privy's bundle reaches for Solana packages from screens this app never opens — it is
  /// configured `walletChainType: "ethereum-only"` and Arc is an EVM chain. They are optional
  /// peers that webpack still tries to resolve, so they are resolved to nothing. Installing them
  /// instead would put a megabyte of unreachable Solana code in a progressive web app.
  webpack(config: {resolve: {alias: Record<string, unknown>}}) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@solana/kit": false,
      "@solana-program/system": false,
      "@solana-program/token": false,
    };
    return config;
  },
  async rewrites() {
    return [{source: "/api/v1/:path*", destination: `${backendOrigin}/api/v1/:path*`}];
  },
};

export default withSerwist(nextConfig);
