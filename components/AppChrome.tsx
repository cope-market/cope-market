"use client";

import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {TabBar} from "./TabBar";

/// Sign-in owns the whole screen. Everything else sits above the tab bar.
///
/// The clearance for the bar lives here rather than on `body`, so the one screen without a bar
/// does not carry an inch of dead space at the bottom of it.
const FULL_SCREEN = ["/login"];

export function AppChrome({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const bare = FULL_SCREEN.some((route) => pathname.startsWith(route));

  return (
    <>
      <div
        className="mx-auto min-h-dvh max-w-lg"
        style={bare ? undefined : {paddingBottom: "calc(4.25rem + env(safe-area-inset-bottom))"}}
      >
        {children}
      </div>
      {bare ? null : <TabBar />}
    </>
  );
}
