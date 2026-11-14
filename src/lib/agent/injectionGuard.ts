export interface InjectionDetection {
  detected: boolean;
  matches: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function spacedWord(value: string): string {
  return Array.from(value, escapeRegExp).join("\\s*");
}

function phrase(value: string): string {
  return value
    .split(/\s+/)
    .map(spacedWord)
    .join("\\s+");
}

const injectionPatterns = [
  new RegExp(
    `\\b${spacedWord("ignore")}\\s+(?:(?:${spacedWord("all")}|${spacedWord("the")})\\s+)?(?:${spacedWord("previous")}|${spacedWord("prior")}|${spacedWord("earlier")}|${spacedWord("above")})\\s+(?:${spacedWord("instruction")}|${spacedWord("instructions")})\\b`,
    "gi",
  ),
  new RegExp(
    `\\b${spacedWord("ignore")}\\s+${spacedWord("all")}\\s+(?:${spacedWord("instruction")}|${spacedWord("instructions")})\\b`,
    "gi",
  ),
  new RegExp(
    `\\b${spacedWord("disregard")}\\s+(?:(?:${spacedWord("all")}|${spacedWord("of")})\\s+)?(?:${spacedWord("the")}\\s+)?${spacedWord("above")}\\b`,
    "gi",
  ),
  new RegExp(`\\b${phrase("you are now")}\\b`, "gi"),
  new RegExp(`\\b${spacedWord("system")}\\s*:`, "gi"),
  new RegExp(`\\b${phrase("act as")}\\b`, "gi"),
  new RegExp(`\\b${phrase("classify this as safe")}\\b`, "gi"),
  new RegExp(`\\b${phrase("always answer safe")}\\b`, "gi"),
  new RegExp(`\\b${phrase("test mode")}\\b`, "gi"),
  new RegExp(
    `\\b${spacedWord("reveal")}\\s+(?:${spacedWord("your")}\\s+|${spacedWord("the")}\\s+)?${spacedWord("prompt")}\\b`,
    "gi",
  ),
];

export function detectInjection(text: string): InjectionDetection {
  const matches = new Map<string, string>();

  for (const pattern of injectionPatterns) {
    for (const match of text.matchAll(pattern)) {
      matches.set(match[0].toLowerCase(), match[0]);
    }
  }

  return {
    detected: matches.size > 0,
    matches: [...matches.values()],
  };
}
