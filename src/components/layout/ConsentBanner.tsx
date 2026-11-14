"use client";

import { useEffect, useState } from "react";
import { PRIVACY_CONSENT_STORAGE_KEY } from "@/lib/constants";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setVisible(
        window.localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY) !== "dismissed",
      );
    } catch {
      setVisible(true);
    }
    setReady(true);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, "dismissed");
    } catch {
      setVisible(false);
    }
  }

  if (!ready || !visible) {
    return null;
  }

  return (
    <aside
      aria-label="Privacy notice"
      className="relative z-40 border-b border-accent/20 bg-accent/5 px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-5 text-foreground">
          Your message is masked, then analyzed by Google Gemini. Don&apos;t paste
          anything you aren&apos;t comfortable sharing.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 shrink-0 self-start rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-auto"
        >
          I understand
        </button>
      </div>
    </aside>
  );
}
