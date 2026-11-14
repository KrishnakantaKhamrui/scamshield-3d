"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Circle,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DefangedText } from "@/components/ui/DefangedText";
import type { TraceStep } from "@/types";

const stepOrder = [
  "privacy",
  "injection",
  "urlChecker",
  "threatIntel",
  "senderChecker",
  "classifier",
  "registry",
  "rag",
  "reasoner",
  "fallback",
  "validation",
];

const stepLabels: Record<string, string> = {
  privacy: "Privacy Shield",
  injection: "Injection Guard",
  urlChecker: "URL Checker",
  threatIntel: "Threat Intelligence",
  registry: "Community Registry",
  senderChecker: "Sender & UPI Checker",
  classifier: "Heuristic Classifier",
  rag: "RAG Retriever",
  reasoner: "Gemini Reasoner",
  fallback: "Deterministic Fallback",
  validation: "Validator",
};

export function createPendingTrace(): TraceStep[] {
  return stepOrder
    .filter((name) => name !== "fallback")
    .map((name) => ({
      name,
      status: "pending",
      detail: "Waiting to start.",
      ms: 0,
    }));
}

export function upsertTraceStep(
  current: TraceStep[],
  next: TraceStep,
): TraceStep[] {
  const steps = current.filter((step) => step.name !== next.name);
  steps.push(next);
  return steps.sort(
    (a, b) => stepOrder.indexOf(a.name) - stepOrder.indexOf(b.name),
  );
}

interface AgentTraceProps {
  steps: TraceStep[];
}

export function AgentTrace({ steps }: AgentTraceProps) {
  const prefersReducedMotion = useReducedMotion();
  const orderedSteps = [...steps].sort(
    (a, b) => stepOrder.indexOf(a.name) - stepOrder.indexOf(b.name),
  );

  return (
    <section aria-labelledby="agent-trace-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2
            id="agent-trace-title"
            className="font-display text-lg font-semibold text-foreground"
          >
            Agent trace
          </h2>
          <p className="mt-1 text-xs text-muted">
            See how each check contributes to the result.
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted">
          {orderedSteps.filter((step) => step.status === "done").length}/
          {orderedSteps.length} complete
        </span>
      </div>

      <ol className="relative space-y-0">
        <AnimatePresence initial={false}>
          {orderedSteps.map((step, index) => {
            const Icon =
              step.status === "running"
                ? LoaderCircle
                : step.status === "done"
                  ? Check
                  : step.status === "error"
                    ? CircleAlert
                    : Circle;
            const statusColor =
              step.status === "done"
                ? "text-status-safe"
                : step.status === "error"
                  ? "text-status-scam"
                  : step.status === "running"
                    ? "text-accent"
                    : "text-muted/60";

            return (
              <motion.li
                key={step.name}
                aria-label={`${stepLabels[step.name] ?? step.name}: ${step.status}`}
                className="relative flex gap-3 py-2.5"
                initial={
                  prefersReducedMotion ? false : { opacity: 0, x: 10 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -8 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.2,
                  delay: prefersReducedMotion ? 0 : index * 0.035,
                }}
              >
                {index < orderedSteps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[9px] top-8 h-[calc(100%-0.5rem)] w-px bg-border"
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-background",
                    statusColor,
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={
                      step.status === "running" ? "animate-spin" : undefined
                    }
                    size={step.status === "pending" ? 15 : 17}
                    strokeWidth={2.2}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {stepLabels[step.name] ?? step.name}
                    </h3>
                    {(step.status === "done" || step.status === "error") && (
                      <span className="text-[11px] tabular-nums text-muted">
                        {step.ms} ms
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 break-words text-xs leading-5 text-muted">
                    <DefangedText text={step.detail} />
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
