"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

/// Four destinations, fixed to the bottom where a thumb reaches. The bar sits above the home
/// indicator on iOS, which is what `env(safe-area-inset-bottom)` is for.
///
/// The liquidity pool is deliberately not among them. It is counterparty to every position and the
/// team seeds it, so supplying it is not something a trader here does — putting it in the bar asked
/// beginners to have an opinion about a vault before they had one about a market. `/lp` still
/// works; it is reached by URL, which is the right amount of effort for the people who want it.

const TABS = [
  {href: "/feed", label: "Feed", icon: FeedIcon},
  {href: "/markets", label: "Markets", icon: MarketsIcon},
  {href: "/leaderboard", label: "Board", icon: BoardIcon},
  {href: "/wallet", label: "Wallet", icon: WalletIcon},
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground/95 backdrop-blur-md"
      style={{paddingBottom: "env(safe-area-inset-bottom)"}}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.625rem] font-medium tracking-wide transition-colors ${
                  active ? "text-accent" : "text-dim hover:text-muted"
                }`}
              >
                <Icon active={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = {active: boolean};

function frame(children: React.ReactNode) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function FeedIcon({active}: IconProps) {
  return frame(
    <>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.15"
      />
      <path d="M7 9h10M7 13h7" />
    </>,
  );
}

function MarketsIcon({active}: IconProps) {
  return frame(
    <>
      <path d="M3 17l5-6 4 3 5-8" />
      <circle cx="17" cy="6" r="2" fill={active ? "currentColor" : "none"} />
    </>,
  );
}

function BoardIcon({active}: IconProps) {
  return frame(
    <>
      <rect
        x="4"
        y="12"
        width="4"
        height="8"
        rx="1"
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.2"
      />
      <rect
        x="10"
        y="7"
        width="4"
        height="13"
        rx="1"
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.2"
      />
      <rect
        x="16"
        y="14"
        width="4"
        height="6"
        rx="1"
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.2"
      />
    </>,
  );
}

function WalletIcon({active}: IconProps) {
  return frame(
    <>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2.5"
        fill={active ? "currentColor" : "none"}
        fillOpacity="0.15"
      />
      <path d="M3 10h18M16.5 14.5h.01" />
    </>,
  );
}
