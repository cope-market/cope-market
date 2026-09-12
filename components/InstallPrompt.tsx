"use client";

import {useEffect, useState} from "react";
import {isStandalone} from "@/lib/auth/session";
import {Button, Card} from "./ui";

/// Offers installation, once, after the user has had a reason to want it.
///
/// The advice differs by platform for a real reason rather than a cosmetic one: Chrome fires
/// `beforeinstallprompt` and can be asked directly, while iOS has no such event and the user has
/// to go through the share sheet. And on iOS the order matters — signing in with X leaves the app
/// and comes back, which a standalone window handles badly, so the prompt says to sign in first.

const DISMISSED_KEY = "cope.install.dismissed";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

export function InstallPrompt({signedIn}: {signedIn: boolean}) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Private browsing, or site data blocked. Showing the prompt is the safe default.
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    setHidden(false);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do. It will be offered again next time, which is a small cost.
    }
  }

  if (hidden || (!deferred && !ios)) return null;

  return (
    <Card className="mb-3 p-3.5">
      <p className="text-[0.875rem] font-medium">Install Cope Market</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        {ios ? (
          <>
            Tap Share, then &ldquo;Add to Home Screen&rdquo;.
            {!signedIn
              ? " Sign in first — an installed window on iOS handles the X login poorly."
              : ""}
          </>
        ) : (
          "Add it to your home screen and it opens like an app."
        )}
      </p>
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <Button
            className="h-9 flex-1 text-[0.8125rem]"
            onClick={() => {
              void deferred.prompt();
              dismiss();
            }}
          >
            Install
          </Button>
        ) : null}
        <Button tone="quiet" className="h-9 flex-1 text-[0.8125rem]" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
