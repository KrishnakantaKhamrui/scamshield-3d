import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { defang, findUrlRanges } from "@/lib/security/defang";
import type { Label } from "@/types";

interface HighlightRange {
  start: number;
  end: number;
}

interface HighlightedTextProps {
  text: string;
  phrases: string[];
  label: Label;
}

function findHighlightRanges(text: string, phrases: string[]): HighlightRange[] {
  const normalizedText = text.toLowerCase();
  const uniquePhrases = [
    ...new Map(
      phrases
        .map((phrase) => phrase.trim())
        .filter(Boolean)
        .map((phrase) => [phrase.toLowerCase(), phrase] as const),
    ).values(),
  ].sort((a, b) => b.length - a.length);
  const ranges: HighlightRange[] = [];

  for (const phrase of uniquePhrases) {
    const normalizedPhrase = phrase.toLowerCase();
    let start = normalizedText.indexOf(normalizedPhrase);
    while (start !== -1) {
      const end = start + normalizedPhrase.length;
      const overlaps = ranges.some(
        (range) => start < range.end && range.start < end,
      );
      if (!overlaps) {
        ranges.push({ start, end });
      }
      start = normalizedText.indexOf(normalizedPhrase, start + normalizedPhrase.length);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

export function HighlightedText({
  text,
  phrases,
  label,
}: HighlightedTextProps) {
  const urlRanges = findUrlRanges(text);
  const highlightRanges = findHighlightRanges(text, phrases).filter(
    (highlight) =>
      !urlRanges.some(
        (url) => highlight.start < url.end && url.start < highlight.end,
      ),
  );
  const ranges = [
    ...urlRanges.map((range) => ({ ...range, kind: "url" as const })),
    ...highlightRanges.map((range) => ({ ...range, kind: "highlight" as const })),
  ].sort((a, b) => a.start - b.start);
  const highlightClass =
    label === "scam"
      ? "bg-status-scam/20 decoration-status-scam/60"
      : "bg-status-suspicious/25 decoration-status-suspicious/70";
  const content: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      content.push(text.slice(cursor, range.start));
    }
    const phrase = text.slice(range.start, range.end);
    content.push(
      range.kind === "url" ? (
        <code
          key={`${range.start}-${range.end}`}
          className="break-all rounded bg-surface px-1 font-mono text-xs text-accent"
        >
          {defang(phrase)}
        </code>
      ) : (
        <mark
          key={`${range.start}-${range.end}`}
          className={`rounded px-0.5 text-foreground underline decoration-2 underline-offset-2 ${highlightClass}`}
        >
          {phrase}
        </mark>
      ),
    );
    cursor = range.end;
    if (index === ranges.length - 1 && cursor < text.length) {
      content.push(text.slice(cursor));
    }
  });
  if (ranges.length === 0) {
    content.push(text);
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Redacted message
      </h2>
      <p
        aria-label="Redacted message with highlighted phrases"
        className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted"
        dir="auto"
      >
        {content}
      </p>
    </Card>
  );
}
