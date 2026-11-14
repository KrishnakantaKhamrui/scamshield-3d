import { findUrls } from "@/lib/agent/urlChecker";

export interface UrlRange {
  start: number;
  end: number;
}

const defangedUrlPattern =
  /\bhxxps?:\/\/[^\s<>"'`]+|\b(?:[a-z0-9-]+\[\.\])+(?:[a-z0-9-]+)(?::\d+)?(?:\/[^\s<>"'`]*)?/gi;

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,!?;:)}\]]+$/g, "");
}

export function defang(url: string): string {
  return url
    .replace(/^https?/i, (scheme) =>
      scheme.toLowerCase() === "https" ? "hxxps" : "hxxp",
    )
    .replace(/(?<!\[)\.(?!\])/g, "[.]");
}

export function findUrlRanges(text: string): UrlRange[] {
  const ranges: UrlRange[] = [];
  let cursor = 0;

  for (const url of findUrls(text)) {
    const start = text.indexOf(url, cursor);
    if (start !== -1) {
      ranges.push({ start, end: start + url.length });
      cursor = start + url.length;
    }
  }

  for (const match of text.matchAll(defangedUrlPattern)) {
    if (match.index === undefined) {
      continue;
    }
    const url = trimTrailingPunctuation(match[0]);
    if (!url) {
      continue;
    }
    const range = { start: match.index, end: match.index + url.length };
    if (
      !ranges.some(
        (existing) => range.start < existing.end && existing.start < range.end,
      )
    ) {
      ranges.push(range);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

export function defangText(text: string): string {
  const ranges = findUrlRanges(text);
  if (ranges.length === 0) {
    return text;
  }

  let cursor = 0;
  let result = "";
  for (const range of ranges) {
    result += text.slice(cursor, range.start);
    result += defang(text.slice(range.start, range.end));
    cursor = range.end;
  }
  return `${result}${text.slice(cursor)}`;
}
