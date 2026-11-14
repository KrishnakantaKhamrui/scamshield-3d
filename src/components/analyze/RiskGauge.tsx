"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";
import type { Label } from "@/types";

interface RiskGaugeProps {
  score: number;
  label: Label;
}

const strokeColors: Record<Label, string> = {
  safe: "var(--status-safe)",
  suspicious: "var(--status-suspicious)",
  scam: "var(--status-scam)",
};

export function RiskGauge({ score, label }: RiskGaugeProps) {
  const prefersReducedMotion = useReducedMotion();
  const scoreValue = useMotionValue(0);
  const displayScore = useTransform(scoreValue, (value) =>
    Math.round(value).toString(),
  );

  useEffect(() => {
    const controls = animate(scoreValue, score, {
      duration: prefersReducedMotion ? 0 : 0.9,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [prefersReducedMotion, score, scoreValue]);

  return (
    <div className="mx-auto w-full max-w-[220px]">
      <svg
        aria-label={`Risk score ${score} out of 100`}
        className="block h-auto w-full"
        role="img"
        viewBox="0 0 200 122"
      >
        <path
          d="M 14 100 A 86 86 0 0 1 186 100"
          fill="none"
          pathLength="100"
          stroke="var(--border)"
          strokeDasharray="100"
          strokeLinecap="round"
          strokeWidth="13"
        />
        <motion.path
          animate={{ strokeDashoffset: 100 - score }}
          d="M 14 100 A 86 86 0 0 1 186 100"
          fill="none"
          initial={{ strokeDashoffset: 100 }}
          pathLength="100"
          stroke={strokeColors[label]}
          strokeDasharray="100"
          strokeLinecap="round"
          strokeWidth="13"
          transition={{
            duration: prefersReducedMotion ? 0 : 0.9,
            ease: "easeOut",
          }}
        />
        <motion.text
          className="fill-foreground font-display text-[2.4rem] font-semibold"
          textAnchor="middle"
          x="100"
          y="91"
        >
          {displayScore}
        </motion.text>
        <text
          className="fill-muted text-[0.65rem] font-medium tracking-[0.18em]"
          textAnchor="middle"
          x="100"
          y="111"
        >
          RISK SCORE
        </text>
      </svg>
    </div>
  );
}
