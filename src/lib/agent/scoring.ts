import type { AgentEvidence, Label } from "@/types";

export function calculateToolScore(evidence: AgentEvidence): number {
  const blendedScore =
    0.5 * evidence.classifierScore +
    0.3 * evidence.senderScore +
    0.2 * Math.max(evidence.urlScore, evidence.threatIntel.score);
  return Math.min(100, blendedScore + (evidence.injectionDetected ? 15 : 0));
}

export function labelFromScore(score: number): Label {
  if (score <= 34) {
    return "safe";
  }
  if (score <= 64) {
    return "suspicious";
  }
  return "scam";
}
