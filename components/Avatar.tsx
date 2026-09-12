"use client";

import {useState} from "react";

/// An X avatar, with a fallback that is not a broken image. Next's image optimiser is not used:
/// the URLs come from X and change, and a profile picture is not worth a remote-pattern allowlist.

export function Avatar({src, name, size = 36}: {src: string | null; name: string; size?: number}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-medium text-muted"
        style={{width: size, height: size, fontSize: size * 0.42}}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-raised object-cover"
      style={{width: size, height: size}}
    />
  );
}
