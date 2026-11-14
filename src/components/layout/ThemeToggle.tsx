"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/70 text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <motion.span
        key={isDark ? "moon" : "sun"}
        initial={
          prefersReducedMotion
            ? false
            : { opacity: 0, rotate: -70, scale: 0.7 }
        }
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
      >
        <Icon aria-hidden="true" size={19} />
      </motion.span>
    </button>
  );
}
