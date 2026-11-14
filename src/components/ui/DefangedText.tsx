import type { ReactNode } from "react";
import { defang, findUrlRanges } from "@/lib/security/defang";

interface DefangedTextProps {
  text: string;
  className?: string;
}

export function DefangedText({ text, className }: DefangedTextProps) {
  const ranges = findUrlRanges(text);
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const content: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      content.push(text.slice(cursor, range.start));
    }
    content.push(
      <code
        key={`${range.start}-${range.end}`}
        className="break-all rounded bg-surface px-1 font-mono text-xs text-accent"
      >
        {defang(text.slice(range.start, range.end))}
      </code>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) {
    content.push(text.slice(cursor));
  }

  return <span className={className}>{content}</span>;
}
