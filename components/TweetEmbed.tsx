"use client";

import {useEffect, useRef, useState} from "react";

/// Renders X's oEmbed HTML.
///
/// The markup and the script that hydrates it come from a third party, so they run inside an
/// iframe with `allow-scripts` but deliberately without `allow-same-origin`. That combination puts
/// the frame in an opaque origin: widgets.js can do its work, and it cannot read a cookie, reach
/// our DOM, or see the Privy token. The frame measures itself and posts its height out, because a
/// cross-origin frame cannot be measured from the outside.
///
/// The HTML is fetched and cached by our server rather than by the browser, because X's oEmbed
/// endpoint sends no CORS headers.

const FRAME_DOC = (html: string) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  :root {color-scheme: dark;}
  html, body {margin:0; padding:0; background:#161921;}
  body {
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #e9ebef;
  }
  /* How the quote looks when X's script does not run. Its own script replaces this wholesale when
     it does; until then the blockquote already carries the text and the link, so the fallback is a
     readable quoted post rather than an empty white slab. */
  blockquote {
    margin: 0;
    padding: 14px 16px;
    border-left: 2px solid #8b7cff;
  }
  blockquote p {margin: 0 0 8px;}
  a {color: #8d94a1; text-decoration: none; font-size: 13px;}
  .twitter-tweet {margin: 0 !important;}
  iframe {max-width: 100% !important;}
</style>
</head>
<body>
${html}
<script async src="https://platform.twitter.com/widgets.js"></script>
<script>
  var last = 0;
  function report() {
    var height = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight
    );
    if (height !== last) {
      last = height;
      parent.postMessage({source: 'cope-tweet', height: height}, '*');
    }
  }
  new ResizeObserver(report).observe(document.body);
  setInterval(report, 400);
  report();
</script>
</body></html>`;

export function TweetEmbed({html, authorHandle}: {html: string; authorHandle: string}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(96);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // The frame is cross-origin so the event has no useful origin to check; identify it by the
      // element it came from instead, and accept nothing that is not a plausible height.
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as {source?: string; height?: number};
      if (data?.source !== "cope-tweet" || typeof data.height !== "number") return;
      setHeight(Math.min(Math.max(data.height, 64), 900));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      title={`Post by @${authorHandle}`}
      srcDoc={FRAME_DOC(html)}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
      className="w-full rounded-xl border border-line bg-raised"
      style={{height}}
    />
  );
}
