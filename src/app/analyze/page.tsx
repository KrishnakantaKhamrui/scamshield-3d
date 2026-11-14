"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  LoaderCircle,
  ScanSearch,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTrace, createPendingTrace, upsertTraceStep } from "@/components/analyze/AgentTrace";
import { AnalyzeInput } from "@/components/analyze/AnalyzeInput";
import { FlagsPanel } from "@/components/analyze/FlagsPanel";
import { HighlightedText } from "@/components/analyze/HighlightedText";
import { PrivacyBadge } from "@/components/analyze/PrivacyBadge";
import { RegistryLookup } from "@/components/analyze/RegistryLookup";
import { ReportEntityForm } from "@/components/analyze/ReportEntityForm";
import { SampleScams } from "@/components/analyze/SampleScams";
import { VerdictCard } from "@/components/analyze/VerdictCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { analyzeStream } from "@/lib/analyzeClient";
import { redactPII } from "@/lib/agent/privacy";
import { useScanStore } from "@/store/useScanStore";
import type { TraceStep, Verdict } from "@/types";

type AnalysisMode = "message" | "transcript";
type ExplanationLanguage = keyof Verdict["explanation"];

function EmptyState() {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <ScanSearch aria-hidden="true" size={24} />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
        Your results will appear here
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        Paste a message or choose one of the samples to see an explainable
        analysis.
      </p>
    </Card>
  );
}

function RunningState() {
  return (
    <Card
      aria-live="polite"
      className="flex min-h-40 items-center gap-3 p-5"
    >
      <LoaderCircle
        aria-hidden="true"
        className="shrink-0 animate-spin text-accent"
        size={21}
      />
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Analysis in progress
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted">
          Follow the agent trace below as each check completes.
        </p>
      </div>
    </Card>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Card
      aria-live="assertive"
      className="border-status-scam/25 p-5"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-status-scam"
          size={20}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            We couldn&apos;t finish the analysis
          </h2>
          <p className="mt-1 break-words text-sm leading-5 text-muted">
            {message}
          </p>
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            onClick={onRetry}
          >
            Retry analysis
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AnalysisMode>("message");
  const [language, setLanguage] = useState<ExplanationLanguage>("en");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [redactedText, setRedactedText] = useState("");
  const [steps, setSteps] = useState<TraceStep[]>(createPendingTrace);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const handledShare = useRef(false);
  const addScan = useScanStore((state) => state.addScan);
  const setMood = useScanStore((state) => state.setMood);

  const resetResult = () => {
    setVerdict(null);
    setRedactedText("");
    setError(null);
    setSteps(createPendingTrace());
  };

  const handleAnalyze = useCallback(async (analysisText = text): Promise<void> => {
    if (analysisText.trim().length === 0 || isRunning) {
      return;
    }

    const textForDisplay = redactPII(analysisText).redacted;
    setIsRunning(true);
    setError(null);
    setVerdict(null);
    setRedactedText("");
    setSteps(createPendingTrace());

    try {
      await analyzeStream(
        { text: analysisText, mode, language },
        {
          onStep: (step) => {
            setSteps((current) => upsertTraceStep(current, step));
          },
          onFinal: (result) => {
            setVerdict(result);
            setRedactedText(textForDisplay);
            addScan(textForDisplay, result);
            setMood(result.label);
          },
          onError: (message) => {
            setError(message);
          },
        },
      );
    } catch {
      setError("Please check your connection and try the analysis again.");
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, language, mode, addScan, setMood, text]);

  useEffect(() => {
    if (handledShare.current) {
      return;
    }

    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get("autoAnalyze") !== "1") {
      return;
    }

    handledShare.current = true;
    const sharedText = (parameters.get("text") ?? "").slice(0, 4000);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );

    if (!sharedText.trim()) {
      return;
    }

    setText(sharedText);
    void handleAnalyze(sharedText);
  }, [handleAnalyze]);

  const handleTextChange = (nextText: string) => {
    setText(nextText);
    if (verdict || error) {
      resetResult();
    }
  };

  const handleSampleSelect = (sample: string) => {
    setText(sample);
    resetResult();
  };

  const handleClear = () => {
    setText("");
    resetResult();
    setMood("idle");
  };

  const resultState = verdict
    ? "verdict"
    : error
      ? "error"
      : isRunning
        ? "running"
        : "empty";

  return (
    <motion.div
      className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
    >
      <section aria-labelledby="analyze-title" className="min-w-0">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            ScamShield investigation
          </p>
          <h1
            id="analyze-title"
            className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Analyze a message
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Check suspicious messages and call transcripts without sharing
            unredacted sensitive details with the AI.
          </p>
        </div>

        <AnalyzeInput
          isRunning={isRunning}
          language={language}
          mode={mode}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
          onLanguageChange={setLanguage}
          onModeChange={setMode}
          onTextChange={handleTextChange}
          text={text}
        />
        <RegistryLookup />
        <SampleScams disabled={isRunning} onSelect={handleSampleSelect} />
      </section>

      <section
        aria-label="Analysis results"
        className="min-w-0 space-y-4"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={resultState}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            {verdict ? (
              <div className="space-y-4">
                <PrivacyBadge
                  injectionDetected={verdict.meta.injectionDetected}
                  redactedCount={verdict.meta.redactedCount}
                />
                <VerdictCard language={language} verdict={verdict} />
                <ReportEntityForm verdict={verdict} />
                <HighlightedText
                  label={verdict.label}
                  phrases={verdict.highlightedPhrases}
                  text={redactedText}
                />
                <FlagsPanel verdict={verdict} />
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={() => void handleAnalyze()} />
            ) : isRunning ? (
              <RunningState />
            ) : (
              <EmptyState />
            )}
          </motion.div>
        </AnimatePresence>

        <Card className="p-4 sm:p-5">
          <AgentTrace steps={steps} />
        </Card>
      </section>
    </motion.div>
  );
}
