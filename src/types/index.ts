export type Label = "safe" | "suspicious" | "scam";
export type BackdropMood = "idle" | Label;
export type KillChainStep =
  | "hook"
  | "authority"
  | "urgency"
  | "isolation"
  | "payment_ask";

export interface ScamPattern {
  id: string;
  type: string;
  title: string;
  description: string;
  examplePhrases: string[];
  redFlags: string[];
  whatToDo: string[];
  severity: number;
}

export interface ThreatIntelSource {
  name: string;
  hit: boolean;
  detail?: string;
}

export interface ThreatIntelEvidence {
  score: number;
  flags: string[];
  sources: ThreatIntelSource[];
  skipped: string[];
}

export type RegistryEntityType = "phone" | "upi" | "url" | "domain";

export interface RegistryEntityHash {
  type: RegistryEntityType;
  valueHash: string;
}

export interface RegistryHit {
  type: RegistryEntityType;
  displayValue: string;
  category: string;
  count: number;
}

export interface ToolEvidence {
  tool: string;
  status: "safe" | "suspicious" | "scam" | "unknown";
  summary: string;
  details: string[];
  score?: number;
  threatIntel?: ThreatIntelEvidence;
  registry?: RegistryHit[];
}

export interface Verdict {
  label: Label;
  score: number;
  confidence: number;
  scamType: string;
  highlightedPhrases: string[];
  redFlags: string[];
  greenFlags: string[];
  killChain: KillChainStep[];
  reasons: string[];
  explanation: {
    en: string;
    hi: string;
    bn: string;
  };
  toolEvidence: ToolEvidence[];
  meta: {
    redactedCount: number;
    injectionDetected: boolean;
    latencyMs: number;
    usedFallback: boolean;
  };
}

export interface AgentEvidence {
  redactedText: string;
  redactedCount: number;
  redactedTypes: string[];
  injectionDetected: boolean;
  injectionMatches: string[];
  urls: string[];
  urlScore: number;
  urlFlags: string[];
  threatIntel: ThreatIntelEvidence;
  registryHits: RegistryHit[];
  senderScore: number;
  senderFlags: string[];
  classifierScore: number;
  matchedPhrases: string[];
  categories: string[];
  safeSignals: string[];
  retrievedPatterns: Array<{
    pattern: ScamPattern;
    similarity: number;
  }>;
  skippedTools: Array<
    | "urlChecker"
    | "threatIntel"
    | "registry"
    | "senderChecker"
    | "classifier"
    | "rag"
  >;
}

export interface PipelineOptions {
  toolsOnly?: boolean;
  llmOnly?: boolean;
  threatIntelEnabled?: boolean;
  registryEnabled?: boolean;
}

export interface TraceStep {
  name: string;
  status: "pending" | "running" | "done" | "error";
  detail: string;
  ms: number;
}

export type TraceEmitter = (step: TraceStep) => void | Promise<void>;

export interface EvalItem {
  id: string;
  label: Label;
  category: string;
  split: "tune" | "holdout";
  text: string;
  adversarial?: boolean;
}
