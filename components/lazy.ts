"use client";

import dynamic from "next/dynamic";

/// Sheets are mounted closed and opened on a tap, so nothing in them is needed for a first paint.
/// Loading them on demand keeps the trade machinery — viem encoding, the quote maths, the
/// countdown — out of the bundle a screen has to parse before it can show a price.
///
/// `ssr: false` because every one of them is behind a user action and none has a server-rendered
/// state worth producing.

export const TradeSheet = dynamic(
  () => import("./TradeSheet").then((module) => module.TradeSheet),
  {ssr: false},
);

export const ClosePositionSheet = dynamic(
  () => import("./ClosePositionSheet").then((module) => module.ClosePositionSheet),
  {ssr: false},
);

export const EditBioSheet = dynamic(
  () => import("./EditBioSheet").then((module) => module.EditBioSheet),
  {ssr: false},
);
