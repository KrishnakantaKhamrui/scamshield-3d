import {
  labelFromScore,
  calculateToolScore,
} from "@/lib/agent/scoring";
import type {
  AgentEvidence,
  KillChainStep,
  ToolEvidence,
  Verdict,
} from "@/types";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function statusFromScore(score: number): ToolEvidence["status"] {
  if (score >= 65) {
    return "scam";
  }
  if (score >= 35) {
    return "suspicious";
  }
  return "safe";
}

export function evidenceToToolEvidence(
  evidence: AgentEvidence,
): ToolEvidence[] {
  const toolEvidence: ToolEvidence[] = [
    {
      tool: "privacy",
      status: "unknown",
      summary: `Redacted ${evidence.redactedCount} sensitive item(s).`,
      details: evidence.redactedTypes,
    },
    {
      tool: "injection",
      status: evidence.injectionDetected ? "suspicious" : "safe",
      summary: evidence.injectionDetected
        ? "Instruction-like content detected."
        : "No instruction-like content detected.",
      details: evidence.injectionDetected ? ["Injection pattern detected"] : [],
      score: evidence.injectionDetected ? 15 : 0,
    },
  ];

  if (!evidence.skippedTools.includes("urlChecker")) {
    toolEvidence.push({
      tool: "urlChecker",
      status: statusFromScore(evidence.urlScore),
      summary: `${evidence.urlFlags.length} URL flag(s).`,
      details: [
        ...evidence.urls.map((url) => `URL: ${url}`),
        ...evidence.urlFlags,
      ],
      score: evidence.urlScore,
    });
  }
  if (!evidence.skippedTools.includes("senderChecker")) {
    toolEvidence.push({
      tool: "senderChecker",
      status: statusFromScore(evidence.senderScore),
      summary: `${evidence.senderFlags.length} sender flag(s).`,
      details: evidence.senderFlags,
      score: evidence.senderScore,
    });
  }
  if (!evidence.skippedTools.includes("classifier")) {
    toolEvidence.push({
      tool: "classifier",
      status: statusFromScore(evidence.classifierScore),
      summary: `${evidence.categories.length} category hit(s).`,
      details: unique([
        ...evidence.categories,
        ...evidence.matchedPhrases.filter((phrase) =>
          evidence.redactedText.includes(phrase),
        ),
        ...evidence.safeSignals,
      ]),
      score: evidence.classifierScore,
    });
  }
  if (
    !evidence.skippedTools.includes("rag") &&
    evidence.retrievedPatterns.length > 0
  ) {
    const topPattern = evidence.retrievedPatterns[0];
    toolEvidence.push({
      tool: "rag",
      status: "unknown",
      summary: `Closest pattern: ${topPattern.pattern.type}.`,
      details: unique([
        ...topPattern.pattern.redFlags.map((flag) => `Red flag: ${flag}`),
        ...topPattern.pattern.whatToDo.map((action) => `What to do: ${action}`),
      ]),
      score: Math.round(topPattern.similarity * 100),
    });
  }

  if (!evidence.skippedTools.includes("threatIntel")) {
    toolEvidence.push({
      tool: "threatIntel",
      status: statusFromScore(evidence.threatIntel.score),
      summary: `${evidence.threatIntel.flags.length} threat intelligence hit(s).`,
      details: [
        ...evidence.threatIntel.flags,
        ...evidence.threatIntel.sources.map(
          (source) =>
            `${source.name}: ${
              source.hit
                ? "hit"
                : evidence.threatIntel.skipped.includes(source.name)
                  ? "skipped"
                  : "no match"
            }${source.detail ? `: ${source.detail}` : ""}`,
        ),
      ],
      score: evidence.threatIntel.score,
      threatIntel: evidence.threatIntel,
    });
  }
  if (!evidence.skippedTools.includes("registry")) {
    const strongHits = evidence.registryHits.filter((hit) => hit.count >= 3);
    toolEvidence.push({
      tool: "registry",
      status: strongHits.length > 0 ? "suspicious" : "unknown",
      summary: `${evidence.registryHits.length} community registry match(es).`,
      details:
        evidence.registryHits.length > 0
          ? evidence.registryHits.map(
              (hit) =>
                `Reported ${hit.count} time(s): ${hit.displayValue} (${hit.category}).`,
            )
          : ["No matching community reports."],
      registry: evidence.registryHits,
    });
  }

  return toolEvidence;
}

function fallbackKillChain(evidence: AgentEvidence): KillChainStep[] {
  const steps: KillChainStep[] = [];
  const add = (step: KillChainStep) => {
    if (!steps.includes(step)) {
      steps.push(step);
    }
  };

  for (const category of evidence.categories) {
    if (
      category === "reward/lottery" ||
      category === "job/earning promises" ||
      category === "investment guarantees"
    ) {
      add("hook");
    }
    if (category === "threat/arrest" || category === "KYC/account-block") {
      add("authority");
    }
    if (category === "urgency" || category === "KYC/account-block") {
      add("urgency");
    }
    if (category === "secrecy") {
      add("isolation");
    }
    if (
      category === "money request" ||
      category === "credentials request"
    ) {
      add("payment_ask");
    }
  }

  return steps;
}

function fallbackExplanation(
  label: Verdict["label"],
  scamType: string,
  action: string,
): Verdict["explanation"] {
  if (label === "scam") {
    return {
      en: `The message shows multiple signs associated with ${scamType}. ${action}`,
      hi: "इस संदेश में धोखाधड़ी के कई संकेत मिले। पैसे न भेजें और ओटीपी या पिन साझा न करें।",
      bn: "বার্তাটিতে প্রতারণার একাধিক লক্ষণ আছে। টাকা পাঠাবেন না এবং ওটিপি বা পিন শেয়ার করবেন না।",
    };
  }
  if (label === "suspicious") {
    return {
      en: `The message contains warning signs associated with ${scamType}. ${action}`,
      hi: "इस संदेश में कुछ चेतावनी संकेत हैं। कोई कदम उठाने से पहले आधिकारिक माध्यम से पुष्टि करें।",
      bn: "বার্তাটিতে কিছু সতর্কতার লক্ষণ আছে। কোনো পদক্ষেপের আগে অফিসিয়াল মাধ্যমে যাচাই করুন।",
    };
  }
  return {
    en: "The available checks found few scam indicators. Verify unexpected requests through an official channel.",
    hi: "इस संदेश में धोखाधड़ी के स्पष्ट संकेत नहीं मिले। निजी जानकारी साझा करने से पहले आधिकारिक ऐप से पुष्टि करें।",
    bn: "বার্তাটিতে প্রতারণার স্পষ্ট লক্ষণ পাওয়া যায়নি। ব্যক্তিগত তথ্য দেওয়ার আগে সরকারি অ্যাপে যাচাই করুন।",
  };
}

export function buildFallbackVerdict(evidence: AgentEvidence): Verdict {
  const toolScore = Math.round(calculateToolScore(evidence));
  const score = Math.max(evidence.threatIntel.score > 0 ? 35 : 0, toolScore);
  const label = labelFromScore(score);
  const topPattern = evidence.retrievedPatterns[0]?.pattern;
  const scamType =
    topPattern?.type ?? evidence.categories[0] ?? "Unknown scam pattern";
  const recommendation =
    topPattern?.whatToDo[0] ??
    "Verify the sender using an official channel before taking action.";
  const action = recommendation.endsWith(".")
    ? recommendation
    : `${recommendation}.`;
  const redFlags = unique([
    ...evidence.threatIntel.flags,
    ...evidence.registryHits
      .filter((hit) => hit.count >= 3)
      .map((hit) => `Reported by ${hit.count} users in the community registry.`),
    ...evidence.urlFlags,
    ...evidence.senderFlags,
    ...evidence.categories,
    ...(topPattern?.redFlags ?? []),
    ...(evidence.injectionDetected ? ["Instruction-like content detected"] : []),
  ]);
  const reasons = unique([
    ...evidence.threatIntel.flags,
    ...evidence.registryHits
      .filter((hit) => hit.count >= 3)
      .map((hit) => `Reported by ${hit.count} users in the community registry.`),
    ...(topPattern ? [topPattern.description] : []),
    ...evidence.categories,
    ...evidence.urlFlags,
    ...evidence.senderFlags,
  ]).slice(0, 5);

  return {
    label,
    score,
    confidence:
      evidence.urlScore +
        evidence.threatIntel.score +
        evidence.senderScore +
        evidence.classifierScore >
      0
        ? 0.55
        : 0.4,
    scamType,
    highlightedPhrases: unique(evidence.matchedPhrases).filter((phrase) =>
      evidence.redactedText.includes(phrase),
    ),
    redFlags,
    greenFlags: unique(evidence.safeSignals),
    killChain: fallbackKillChain(evidence),
    reasons,
    explanation: fallbackExplanation(label, scamType, action),
    toolEvidence: evidenceToToolEvidence(evidence),
    meta: {
      redactedCount: evidence.redactedCount,
      injectionDetected: evidence.injectionDetected,
      latencyMs: 0,
      usedFallback: true,
    },
  };
}
