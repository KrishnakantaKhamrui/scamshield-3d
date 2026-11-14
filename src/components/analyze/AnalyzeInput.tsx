"use client";

import {
  ArrowRight,
  Eraser,
  LoaderCircle,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzeRequestBody } from "@/lib/analyzeClient";
import { Button } from "@/components/ui/Button";

type AnalysisMode = NonNullable<AnalyzeRequestBody["mode"]>;
type AnalysisLanguage = NonNullable<AnalyzeRequestBody["language"]>;

interface AnalyzeInputProps {
  text: string;
  mode: AnalysisMode;
  language: AnalysisLanguage;
  isRunning: boolean;
  onTextChange: (text: string) => void;
  onModeChange: (mode: AnalysisMode) => void;
  onLanguageChange: (language: AnalysisLanguage) => void;
  onAnalyze: () => Promise<void>;
  onClear: () => void;
}

const modes: Array<{ value: AnalysisMode; label: string }> = [
  { value: "message", label: "Message" },
  { value: "transcript", label: "Call transcript" },
];

const languages: Array<{ value: AnalysisLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "bn", label: "বাংলা" },
];

export function AnalyzeInput({
  text,
  mode,
  language,
  isRunning,
  onTextChange,
  onModeChange,
  onLanguageChange,
  onAnalyze,
  onClear,
}: AnalyzeInputProps) {
  const isTranscript = mode === "transcript";

  return (
    <form
      className="glass rounded-2xl p-4 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void onAnalyze();
      }}
    >
      <div
        aria-label="Analysis input mode"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/70 p-1"
        role="group"
      >
        {modes.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            className={cn(
              "min-h-11 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              mode === value && "bg-surface text-foreground shadow-sm",
            )}
            disabled={isRunning}
            onClick={() => onModeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <label
        htmlFor="analysis-message"
        className="mb-2 block text-sm font-semibold text-foreground"
      >
        {isTranscript ? "Call transcript" : "Suspicious message"}
      </label>
      <textarea
        id="analysis-message"
        autoComplete="off"
        className="min-h-56 w-full resize-y rounded-xl border border-border bg-background/80 px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted/80 focus:border-accent/70 focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-64"
        disabled={isRunning}
        maxLength={4000}
        placeholder={
          isTranscript
            ? "Paste or type the call transcript here..."
            : "Paste or type the suspicious message here..."
        }
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p id="analysis-character-count" className="text-xs text-muted">
          {text.length}/4000 characters
        </p>
        <span className="text-xs text-muted">Your text is redacted before AI analysis.</span>
      </div>

      <fieldset className="mt-5" disabled={isRunning}>
        <legend className="mb-2 text-sm font-semibold text-foreground">
          Explanation language
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {languages.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={language === value}
              className={cn(
                "min-h-11 rounded-xl border border-border px-2 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                language === value &&
                  "border-accent/40 bg-accent/10 text-accent",
              )}
              onClick={() => onLanguageChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Button
          className="w-full"
          disabled={isRunning || text.trim().length === 0}
          type="submit"
        >
          {isRunning ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          ) : (
            <ScanSearch aria-hidden="true" size={18} />
          )}
          {isRunning ? "Analyzing..." : "Analyze message"}
          {!isRunning && <ArrowRight aria-hidden="true" size={16} />}
        </Button>
        <Button
          className="w-full sm:w-auto"
          disabled={isRunning || text.length === 0}
          type="button"
          variant="outline"
          onClick={onClear}
        >
          <Eraser aria-hidden="true" size={16} />
          Clear
        </Button>
      </div>
    </form>
  );
}
