import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

/// Proxies `/api/v1/*` to the backend, so the browser only ever talks to this origin.
///
/// This replaces the plain rewrite in next.config.ts because a rewrite cannot add a request
/// header, and one header is needed: ngrok's free tier answers browser-looking requests with an
/// HTML interstitial rather than proxying them, and a rewrite forwards the browser's own
/// User-Agent. The typed client sets the same header when it is pointed straight at a tunnel, but
/// it keys that off the base URL's hostname, and ours is a relative path by design.
///
/// Staying same-origin is worth the extra file. It means the backend's CORS allowlist does not
/// have to name every port we develop and test on — it currently allows `localhost:3000` only,
/// which would exclude the port the end-to-end suite runs a production build on. It also keeps the
/// tunnel URL server-side, so it is not baked into the client bundle and can change without one.
///
/// Pointing `NEXT_PUBLIC_API_BASE_URL` at an absolute URL bypasses all of this and talks to the
/// backend directly, which is the documented path and needs that origin on their allowlist.

const BACKEND_ORIGIN = process.env["BACKEND_ORIGIN"] ?? "http://localhost:4000";

export function middleware(request: NextRequest) {
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, BACKEND_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set("ngrok-skip-browser-warning", "1");
  // The upstream decides its own Host; forwarding ours makes a tunnel route to the wrong place.
  headers.delete("host");

  return NextResponse.rewrite(target, {request: {headers}});
}

export const config = {matcher: "/api/v1/:path*"};
