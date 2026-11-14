"use client";

import { useEffect } from "react";
import { useScanStore } from "@/store/useScanStore";

export function StoreHydration() {
  useEffect(() => {
    const startedAt = performance.now();
    void Promise.resolve(useScanStore.persist.rehydrate()).catch(
      () => {
        console.error(
          JSON.stringify({
            requestId: crypto.randomUUID(),
            route: "client-store-hydration",
            status: 500,
            latencyMs: Math.round(performance.now() - startedAt),
            label: null,
          }),
        );
        useScanStore.getState().setHasHydrated(true);
      },
    );
  }, []);

  return null;
}
