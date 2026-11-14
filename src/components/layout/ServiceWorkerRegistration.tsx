"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const startedAt = performance.now();
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      console.error(
        JSON.stringify({
          requestId: crypto.randomUUID(),
          route: "service-worker-registration",
          status: 500,
          latencyMs: Math.round(performance.now() - startedAt),
          label: null,
        }),
      );
    });
  }, []);

  return null;
}
