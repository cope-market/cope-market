/// The three counts a thesis carries. Drawn rather than set in emoji, which render at a different
/// weight and baseline on every platform and made the row look broken on Android.

function icon(path: React.ReactNode, filled = false) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export function HeartIcon({filled = false}: {filled?: boolean}) {
  return icon(
    <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z" />,
    filled,
  );
}

export function CommentIcon() {
  return icon(
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.5A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.5a8.4 8.4 0 0 1 8.5 8.4z" />,
  );
}

export function CopyIcon() {
  return icon(
    <>
      <path d="M20 11A8 8 0 1 0 18.6 16" />
      <path d="M20 4v5h-5" />
    </>,
  );
}
