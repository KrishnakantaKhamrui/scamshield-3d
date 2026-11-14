"use client";

import { useScanStore } from "@/store/useScanStore";
import type { BackdropMood } from "@/types";

interface AnimatedBackdropProps {
  mood?: BackdropMood;
}

export function AnimatedBackdrop({ mood }: AnimatedBackdropProps) {
  const storedMood = useScanStore((state) => state.mood);

  return (
    <div
      aria-hidden="true"
      className="animated-backdrop"
      data-mood={mood ?? storedMood}
    >
      <span className="backdrop-blob backdrop-blob-one" />
      <span className="backdrop-blob backdrop-blob-two" />
      <span className="backdrop-blob backdrop-blob-three" />
    </div>
  );
}
