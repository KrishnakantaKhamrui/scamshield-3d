"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { redactPII } from "@/lib/agent/privacy";
import { SCAN_STORE_STORAGE_KEY } from "@/lib/constants";
import type { BackdropMood, Verdict } from "@/types";

export interface ScanRecord {
  id: string;
  createdAt: string;
  redactedText: string;
  verdict: Verdict;
}

interface ScanStore {
  scans: ScanRecord[];
  mood: BackdropMood;
  hasHydrated: boolean;
  addScan: (redactedText: string, verdict: Verdict) => void;
  clearScans: () => void;
  setMood: (mood: BackdropMood) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useScanStore = create<ScanStore>()(
  persist(
    (set) => ({
      scans: [],
      mood: "idle",
      hasHydrated: false,
      addScan: (redactedText, verdict) => {
        const scan: ScanRecord = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          redactedText: redactPII(redactedText).redacted,
          verdict,
        };
        set((state) => ({ scans: [scan, ...state.scans], mood: verdict.label }));
      },
      clearScans: () => {
        set({ scans: [], mood: "idle" });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SCAN_STORE_STORAGE_KEY);
        }
      },
      setMood: (mood) => set({ mood }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: SCAN_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        scans: state.scans,
        mood: state.mood,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
