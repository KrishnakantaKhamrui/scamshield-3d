import {
  hasPaidSocialTaskOffer,
  hasUpiCollectPinToReceive,
  isNegatedAt,
} from "@/lib/agent/textSignals";

export type ScamCategory =
  | "urgency"
  | "threat/arrest"
  | "reward/lottery"
  | "money request"
  | "credentials request"
  | "KYC/account-block"
  | "job/earning promises"
  | "investment guarantees"
  | "secrecy";

export interface ClassificationResult {
  score: number;
  matchedPhrases: string[];
  categories: ScamCategory[];
  safeSignals: string[];
}

interface CategoryRule {
  category: ScamCategory;
  weight: number;
  patterns: RegExp[];
}

const categoryRules: CategoryRule[] = [
  {
    category: "urgency",
    weight: 12,
    patterns: [
      /\b(?:urgent(?:ly)?|immediately|right\s+now|act\s+now|today\s+only|within\s+\d+\s*(?:hours?|days?)|in\s+\d+\s*(?:hours?|days?)|last\s+chance|turant|abhi|jaldi|aaj[- ]i|aaj\s+hi|ekhoni|shighroi|jogajog)\b/gi,
    ],
  },
  {
    category: "threat/arrest",
    weight: 18,
    patterns: [
      /\b(?:arrest(?:ed)?|under\s+arrest|police|cbi|customs|warrant|legal\s+action|fine|penalty|disconnect(?:ed|ion)?|suspend(?:ed|ion)?|freeze|frozen|block(?:ed)?|band\s+ho\s+jayega)\b/gi,
    ],
  },
  {
    category: "reward/lottery",
    weight: 14,
    patterns: [
      /\b(?:won|winner|prize|lottery|lucky\s+draw|claim\s+(?:your\s+)?(?:prize|reward)|gift\s+voucher|reward|jitechen|jiten|inaam)\b/gi,
    ],
  },
  {
    category: "money request",
    weight: 20,
    patterns: [
      /\b(?:pay|send|transfer|deposit|remit|processing\s+fee|claim\s+fee|gst\s+fee|taka\s+pathan|taka\s+din)\b|\btaka\b.{0,35}\b(?:pathan|din|send|pay|transfer|fee)\b|\b(?:approve|accept)\s+(?:the\s+)?collect\s+request\b|\b(?:upi\s+)?pin\s+to\s+receive\b/gi,
    ],
  },
  {
    category: "credentials request",
    weight: 22,
    patterns: [
      /\b(?:share|send|tell|provide|read\s+out|enter|give)\s+(?:(?:me|your|the)\s+)?(?:one[- ]time\s+password|otp|(?:upi\s+)?pin|cvv|password|passcode|security\s+code)\b/gi,
    ],
  },
  {
    category: "KYC/account-block",
    weight: 18,
    patterns: [
      /\b(?:kyc|pan|aadhaar|account)\b.{0,45}\b(?:block(?:ed)?|freeze|suspend(?:ed)?|deactivat\w*|expir\w*|update|verify|band\s+ho\s+jayega)\b/gi,
      /\b(?:block(?:ed)?|freeze|suspend(?:ed)?|deactivat\w*|expir\w*)\b.{0,35}\b(?:kyc|pan|aadhaar|account)\b/gi,
    ],
  },
  {
    category: "job/earning promises",
    weight: 12,
    patterns: [
      /\b(?:work\s+from\s+home|part[- ]time\s+job|remote\s+role|earn\s+(?:rs\.?\s*)?[\d,]+\s*(?:daily|per\s+day)|easy\s+income|like[- ]and[- ]earn|task[- ]based\s+job|commission|kamai|naukri)\b/gi,
    ],
  },
  {
    category: "investment guarantees",
    weight: 16,
    patterns: [
      /\b(?:guaranteed?\s+(?:returns?|profit|income)|\d{1,3}%\s+returns?|assured\s+(?:returns?|profit|ipo)|double\s+your\s+money|vip\s+stock\s+tips|investment\s+opportunity)\b/gi,
    ],
  },
  {
    category: "secrecy",
    weight: 16,
    patterns: [
      /\b(?:do\s+not\s+tell\s+anyone|don't\s+tell\s+anyone|tell\s+no\s+one|keep\s+(?:this\s+)?(?:it\s+)?secret|do\s+not\s+disconnect|don't\s+disconnect|kisi\s+ko\s+mat\s+batana|kauke\s+bolben\s+na)\b/gi,
    ],
  },
];

const safeSignalPatterns = [
  /\b(?:do\s+not|don't|never)\s+share\s+(?:the\s+)?(?:otp|pin|cvv|password|code)\b/gi,
  /\bif\s+not\s+done\s+by\s+you\b.{0,45}\b(?:call|contact)\b.{0,35}\b(?:number|card)\b/gi,
  /\bofficial(?:\s+\w+){0,2}\s+(?:app|website|site)\b/gi,
  /\b(?:banks?|we)\s+never\s+ask\s+for\s+(?:otp|pin|cvv|password)\b/gi,
  /\bshare\s+(?:the\s+)?otp\b.{0,30}\bonly\s+with\s+(?:the\s+)?(?:driver|delivery\s+person)\b/gi,
];

function addUnique(matches: Map<string, string>, value: string): void {
  const key = value.toLowerCase();
  if (!matches.has(key)) {
    matches.set(key, value);
  }
}

export function classify(text: string): ClassificationResult {
  const matchedPhrases = new Map<string, string>();
  const safeSignals = new Map<string, string>();
  const categoryHits = new Map<ScamCategory, number>();
  const weights = new Map(
    categoryRules.map(({ category, weight }) => [category, weight]),
  );

  for (const rule of categoryRules) {
    for (const pattern of rule.patterns) {
      for (const match of text.matchAll(pattern)) {
        if (isNegatedAt(text, match.index)) {
          continue;
        }
        if (
          rule.category === "credentials request" &&
          /\bonly\s+with\s+(?:the\s+)?(?:driver|delivery\s+person)\b/i.test(
            text.slice(match.index, match.index + 100),
          )
        ) {
          continue;
        }

        addUnique(matchedPhrases, match[0]);
        categoryHits.set(
          rule.category,
          (categoryHits.get(rule.category) ?? 0) + 1,
        );
      }
    }
  }

  for (const pattern of safeSignalPatterns) {
    for (const match of text.matchAll(pattern)) {
      addUnique(safeSignals, match[0]);
    }
  }

  let score = 0;
  for (const [category, hits] of categoryHits) {
    const weight = weights.get(category) ?? 0;
    for (let hit = 0; hit < Math.min(hits, 4); hit += 1) {
      score += weight / (1 + hit * 0.8);
    }
  }

  if (categoryHits.size >= 3) {
    score += Math.min(20, (categoryHits.size - 2) * 5);
  }
  if (hasUpiCollectPinToReceive(text)) {
    score += 40;
  }
  if (hasPaidSocialTaskOffer(text)) {
    score = Math.max(score, 90);
  }
  score -= safeSignals.size * 20;

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    matchedPhrases: [...matchedPhrases.values()],
    categories: [...categoryHits.keys()],
    safeSignals: [...safeSignals.values()],
  };
}
