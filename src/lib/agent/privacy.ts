export interface RedactionResult {
  redacted: string;
  count: number;
  types: string[];
}

interface TextRange {
  start: number;
  end: number;
}

interface RedactionCandidate extends TextRange {
  type: string;
  placeholder: string;
  priority: number;
}

function trimLinkPunctuation(value: string): string {
  return value.replace(/[.,!?;:)}\]]+$/g, "");
}

function addLinkCandidates(
  text: string,
  pattern: RegExp,
  type: string,
  placeholder: string,
  priority: number,
  candidates: RedactionCandidate[],
): void {
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const value = trimLinkPunctuation(match[0]);
    if (start === undefined || !value) {
      continue;
    }
    candidates.push({
      start,
      end: start + value.length,
      type,
      placeholder,
      priority,
    });
  }
}

function findRanges(text: string, pattern: RegExp): TextRange[] {
  const ranges: TextRange[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match.index !== undefined) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function overlaps(a: TextRange, b: TextRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function isProtected(
  candidate: TextRange,
  protectedRanges: TextRange[],
): boolean {
  return protectedRanges.some((range) => overlaps(candidate, range));
}

function hasAdjacentNumberGroup(
  text: string,
  range: TextRange,
): boolean {
  const before = text.slice(Math.max(0, range.start - 2), range.start);
  const after = text.slice(range.end, range.end + 2);
  return /\d[ -]$/.test(before) || /^[ -]\d/.test(after);
}

function addMatches(
  text: string,
  pattern: RegExp,
  type: string,
  placeholder: string,
  priority: number,
  candidates: RedactionCandidate[],
  predicate: (match: RegExpMatchArray, start: number) => boolean = () => true,
): void {
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined || !predicate(match, start)) {
      continue;
    }

    candidates.push({
      start,
      end: start + match[0].length,
      type,
      placeholder,
      priority,
    });
  }
}

export function redactPII(text: string): RedactionResult {
  const domainPattern =
    /(?<![@\w.-])(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})?(?:\/[^\s<>"']*)?/gi;
  const protectedRanges = [
    ...findRanges(text, /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi),
    ...findRanges(text, domainPattern),
    ...findRanges(text, /\b[\w.+-]+@[\w.-]+\b/gi),
  ];
  const candidates: RedactionCandidate[] = [];

  addMatches(
    text,
    /(?<![\w.+-])[a-z0-9._+-]{2,64}@[a-z0-9.-]{2,64}(?![\w.-])/gi,
    "UPI / EMAIL",
    "[UPI/EMAIL]",
    0,
    candidates,
  );
  addLinkCandidates(
    text,
    /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi,
    "URL",
    "[URL]",
    0,
    candidates,
  );
  addLinkCandidates(
    text,
    domainPattern,
    "DOMAIN",
    "[DOMAIN]",
    1,
    candidates,
  );

  addMatches(
    text,
    /(?<![A-Z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Z0-9])/gi,
    "PAN",
    "[PAN]",
    0,
    candidates,
  );
  addMatches(
    text,
    /(?<!\d)(?<!\d )\d(?: ?\d){11}(?!\d)(?! \d)/g,
    "AADHAAR",
    "[AADHAAR]",
    2,
    candidates,
    (_match, start) => text[start - 1] !== "+",
  );
  addMatches(
    text,
    /(?<!\d)(?<!\d[ -])\d(?:[ -]?\d){12,18}(?!\d)(?![ -]\d)/g,
    "CARD",
    "[CARD]",
    3,
    candidates,
  );
  addMatches(
    text,
    /(?<![A-Za-z0-9])(?:\+91[ -]?|0[ -]?)?[6-9](?:[ -]?\d){9}(?!\d)(?![ -]\d)/g,
    "PHONE",
    "[PHONE]",
    4,
    candidates,
    (match, start) =>
      !hasAdjacentNumberGroup(text, {
        start,
        end: start + match[0].length,
      }),
  );
  addMatches(
    text,
    /(?<!\d)(?:\d[ -]?){8,17}\d(?!\d)/g,
    "ACCOUNT",
    "[ACCOUNT]",
    1,
    candidates,
    (match, start) => {
      const end = start + match[0].length;
      if (hasAdjacentNumberGroup(text, { start, end })) {
        return false;
      }

      const contextBefore = text.slice(Math.max(0, start - 24), start);
      const contextAfter = text.slice(end, end + 16);
      return (
        /\b(?:bank\s+account|account|acct|a\/c)\b/i.test(contextBefore) ||
        /^\s*(?:bank\s+)?(?:account|acct|a\/c)\b/i.test(contextAfter)
      );
    },
  );
  addMatches(
    text,
    /(?<!\d)\d{4,8}(?!\d)/g,
    "OTP",
    "[OTP]",
    5,
    candidates,
    (match, start) => {
      const end = start + match[0].length;
      const context = text.slice(Math.max(0, start - 32), end + 24);
      return /\b(?:otp|one[- ]time\s+password|code|pin|cvv)\b/i.test(context);
    },
  );

  const accepted: RedactionCandidate[] = [];
  for (const candidate of candidates
    .filter(
      (item) =>
        item.type === "UPI / EMAIL" ||
        item.type === "URL" ||
        item.type === "DOMAIN" ||
        !isProtected(item, protectedRanges),
    )
    .sort((a, b) => a.priority - b.priority || a.start - b.start)) {
    if (!accepted.some((item) => overlaps(candidate, item))) {
      accepted.push(candidate);
    }
  }

  const redacted = accepted
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, item) =>
        `${result.slice(0, item.start)}${item.placeholder}${result.slice(item.end)}`,
      text,
    );

  return {
    redacted,
    count: accepted.length,
    types: [...new Set(accepted.map((item) => item.type))],
  };
}
