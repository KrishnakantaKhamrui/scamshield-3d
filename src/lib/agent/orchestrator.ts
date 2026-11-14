import { VerdictSchema } from "@/lib/agent/schemas";
import { buildFallbackVerdict, evidenceToToolEvidence } from "@/lib/agent/fallback";
import { detectInjection } from "@/lib/agent/injectionGuard";
import { classify } from "@/lib/agent/classifier";
import { redactPII } from "@/lib/agent/privacy";
import { runReasoner } from "@/lib/agent/reasoner";
import { retrieveSimilar } from "@/lib/agent/rag";
import { calculateToolScore, labelFromScore } from "@/lib/agent/scoring";
import { checkThreatIntel } from "@/lib/agent/threatIntel";
import { extractEntityHashes } from "@/lib/agent/entityExtractor";
import { lookupEntitiesWithStatus } from "@/lib/registry";
import { findUrlRanges, defangText } from "@/lib/security/defang";
import { checkSender } from "@/lib/agent/senderChecker";
import { checkUrls } from "@/lib/agent/urlChecker";
import type {
  AgentEvidence,
  PipelineOptions,
  TraceEmitter,
  Verdict,
} from "@/types";
import type { ReasonerOutput } from "@/lib/agent/schemas";

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function summarizeFlags(flags: string[]): string {
  if (flags.length === 0) {
    return "No flags found.";
  }
  const sample = flags.slice(0, 2).join("; ");
  return `${flags.length} flag(s): ${sample}`;
}

async function runStep<T>(
  name: string,
  work: () => T | Promise<T>,
  describe: (result: T) => string,
  emit: TraceEmitter,
): Promise<T> {
  const start = Date.now();
  await emit({ name, status: "running", detail: `Running ${name}.`, ms: 0 });

  try {
    const result = await work();
    await emit({
      name,
      status: "done",
      detail: describe(result),
      ms: Date.now() - start,
    });
    return result;
  } catch (error) {
    await emit({
      name,
      status: "error",
      detail: `${name} failed.`,
      ms: Date.now() - start,
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`${name} failed.`, { cause: error });
  }
}

async function skipStep(
  name: string,
  reason: string,
  emit: TraceEmitter,
): Promise<void> {
  await emit({ name, status: "running", detail: `Running ${name}.`, ms: 0 });
  await emit({ name, status: "done", detail: reason, ms: 0 });
}

export async function runPipeline(
  rawText: string,
  options: PipelineOptions = {},
  emit: TraceEmitter = () => {},
): Promise<Verdict> {
  if (options.toolsOnly && options.llmOnly) {
    throw new Error("toolsOnly and llmOnly cannot both be enabled.");
  }

  const llmDisabled = process.env.LLM_DISABLED === "true";
  const threatIntelEnabled =
    options.threatIntelEnabled ?? process.env.THREAT_INTEL_ENABLED === "true";
  const registryEnabled = options.registryEnabled ?? true;
  const pipelineStart = Date.now();
  const entityHashes = options.llmOnly
    ? []
    : await extractEntityHashes(rawText);
  const privacy = await runStep(
    "privacy",
    () => redactPII(rawText),
    (result) =>
      result.count === 0
        ? "No sensitive values were redacted."
        : `Redacted ${result.count} item(s): ${result.types.join(", ")}.`,
    emit,
  );
  const injection = await runStep(
    "injection",
    () => detectInjection(rawText),
    (result) =>
      result.detected
        ? `Detected ${result.matches.length} injection pattern(s).`
        : "No injection patterns detected.",
    emit,
  );

  const skippedTools: AgentEvidence["skippedTools"] = [];
  let urlResult = { urls: [] as string[], score: 0, flags: [] as string[] };
  let threatIntel: AgentEvidence["threatIntel"] = {
    score: 0,
    flags: [],
    sources: [],
    skipped: [],
  };
  let registryHits: AgentEvidence["registryHits"] = [];
  let senderResult = { score: 0, flags: [] as string[] };
  let classification = {
    score: 0,
    matchedPhrases: [] as string[],
    categories: [] as string[],
    safeSignals: [] as string[],
  };
  let retrievedPatterns: AgentEvidence["retrievedPatterns"] = [];

  if (options.llmOnly) {
    skippedTools.push(
      "urlChecker",
      "threatIntel",
      "registry",
      "senderChecker",
      "classifier",
    );
    await skipStep("urlChecker", "Skipped in llmOnly mode.", emit);
    await skipStep("threatIntel", "Skipped in llmOnly mode.", emit);
    await skipStep("registry", "Skipped in llmOnly mode.", emit);
    await skipStep("senderChecker", "Skipped in llmOnly mode.", emit);
    await skipStep("classifier", "Skipped in llmOnly mode.", emit);
  } else {
    urlResult = await runStep(
      "urlChecker",
      () => checkUrls(rawText),
      (result) => summarizeFlags(result.flags),
      emit,
    );
    if (threatIntelEnabled) {
      threatIntel = await runStep(
        "threatIntel",
        () => checkThreatIntel(urlResult.urls, true),
        (result) => {
          const checkedDatabases = result.sources.filter(
            (source) => !result.skipped.includes(source.name),
          ).length;
          const hitCount = result.sources.filter((source) => source.hit).length;
          const skippedDetail =
            result.skipped.length > 0
              ? ` Skipped: ${result.skipped.join(", ")}.`
              : "";
          return `Checked ${urlResult.urls.length} URL(s) against ${checkedDatabases} database(s), ${hitCount} hit(s).${skippedDetail}`;
        },
        emit,
      );
    } else {
      skippedTools.push("threatIntel");
      await skipStep(
        "threatIntel",
        "Skipped because THREAT_INTEL_ENABLED is not true.",
        emit,
      );
    }
    senderResult = await runStep(
      "senderChecker",
      () => checkSender(rawText),
      (result) => summarizeFlags(result.flags),
      emit,
    );
    classification = await runStep(
      "classifier",
      () => classify(rawText),
      (result) =>
        result.categories.length === 0
          ? `Score ${result.score}; no categories matched.`
          : `Score ${result.score}; categories: ${result.categories.join(", ")}.`,
      emit,
    );
  }

  if (!options.llmOnly && !registryEnabled) {
    skippedTools.push("registry");
    await skipStep("registry", "Skipped in this configuration.", emit);
  } else if (!options.llmOnly) {
    const registryResult = await runStep(
      "registry",
      () => lookupEntitiesWithStatus(entityHashes),
      (result) => {
        if (!result.available) {
          return "Community registry unavailable; continuing without it.";
        }
        if (entityHashes.length === 0) {
          return "No supported entities found to check.";
        }
        const strongHits = result.hits.filter((hit) => hit.count >= 3);
        const hitDetail =
          strongHits.length > 0
            ? ` ${strongHits
                .map((hit) => `Reported by ${hit.count} users.`)
                .join(" ")}`
            : "";
        const entityWord = entityHashes.length === 1 ? "entity" : "entities";
        return `Checked ${entityHashes.length} hashed ${entityWord}; found ${result.hits.length} report match(es).${hitDetail}`;
      },
      emit,
    );
    registryHits = registryResult.hits;
    if (!registryResult.available) {
      skippedTools.push("registry");
    }
  }

  if (options.toolsOnly || options.llmOnly || llmDisabled) {
    skippedTools.push("rag");
    const reason = llmDisabled
      ? "Skipped because LLM_DISABLED is true; embedding retrieval is disabled."
      : `Skipped in ${options.toolsOnly ? "toolsOnly" : "llmOnly"} mode.`;
    await skipStep("rag", reason, emit);
  } else {
    retrievedPatterns = await runStep(
      "rag",
      () => retrieveSimilar(privacy.redacted),
      (results) =>
        results.length === 0
          ? "No similar scam patterns retrieved."
          : `Retrieved ${results.length} pattern(s): ${results
              .slice(0, 3)
              .map(({ pattern }) => pattern.type)
              .join(", ")}.`,
      emit,
    );
  }

  const evidence: AgentEvidence = {
    redactedText: privacy.redacted,
    redactedCount: privacy.count,
    redactedTypes: privacy.types,
    injectionDetected: injection.detected,
    injectionMatches: injection.matches,
    urls: urlResult.urls,
    urlScore: urlResult.score,
    urlFlags: urlResult.flags,
    threatIntel,
    registryHits,
    senderScore: senderResult.score,
    senderFlags: senderResult.flags,
    classifierScore: classification.score,
    matchedPhrases: classification.matchedPhrases.filter((phrase) =>
      privacy.redacted.includes(phrase),
    ),
    categories: classification.categories,
    safeSignals: classification.safeSignals,
    retrievedPatterns,
    skippedTools,
  };

  let reasonerOutput: ReasonerOutput | undefined;
  let fallback: Verdict | undefined;

  if (options.toolsOnly) {
    await skipStep("reasoner", "Skipped in toolsOnly mode.", emit);
  } else if (llmDisabled) {
    await skipStep("reasoner", "Skipped because LLM_DISABLED is true.", emit);
  } else {
    try {
      reasonerOutput = await runStep(
        "reasoner",
        () => runReasoner(evidence),
        () => "Gemini returned a schema-valid verdict.",
        emit,
      );
    } catch {
      reasonerOutput = undefined;
    }
  }

  if (!reasonerOutput) {
    fallback = await runStep(
      "fallback",
      () => buildFallbackVerdict(evidence),
      () =>
        llmDisabled
          ? "LLM_DISABLED is true; using deterministic tool evidence."
          : "Using a verdict built from deterministic tool evidence.",
      emit,
    );
  }

  const toolScore = calculateToolScore(evidence);
  const llmScore = reasonerOutput?.score ?? fallback?.score ?? toolScore;
  const score = Math.max(
    evidence.threatIntel.score > 0 ? 35 : 0,
    Math.round(0.4 * toolScore + 0.6 * llmScore),
  );
  const baseVerdict = reasonerOutput ?? fallback;

  if (!baseVerdict) {
    throw new Error("Neither the reasoner nor fallback produced a verdict.");
  }

  const combinedHighlights = unique([
    ...baseVerdict.highlightedPhrases,
    ...classification.matchedPhrases,
  ]).filter(
    (phrase) =>
      evidence.redactedText.includes(phrase) &&
      findUrlRanges(phrase).length === 0 &&
      phrase.length > 0,
  );
  const toolEvidence = evidenceToToolEvidence(evidence).map((item) => ({
    ...item,
    summary: defangText(item.summary),
    details: item.details.map(defangText),
  }));
  const verdictCandidate: Verdict = {
    ...baseVerdict,
    label: labelFromScore(score),
    score,
    scamType: defangText(baseVerdict.scamType),
    highlightedPhrases: combinedHighlights,
    redFlags: unique([
      ...baseVerdict.redFlags,
      ...registryHits
        .filter((hit) => hit.count >= 3)
        .map((hit) => `Reported by ${hit.count} users in the community registry.`),
      ...threatIntel.flags,
      ...urlResult.flags,
      ...senderResult.flags,
    ]).map(defangText),
    greenFlags: unique([
      ...baseVerdict.greenFlags,
      ...classification.safeSignals,
    ]).map(defangText),
    reasons: unique(baseVerdict.reasons).map(defangText),
    explanation: {
      en: defangText(baseVerdict.explanation.en),
      hi: defangText(baseVerdict.explanation.hi),
      bn: defangText(baseVerdict.explanation.bn),
    },
    toolEvidence,
    meta: {
      redactedCount: privacy.count,
      injectionDetected: injection.detected,
      latencyMs: Date.now() - pipelineStart,
      usedFallback: fallback !== undefined,
    },
  };

  return runStep(
    "validation",
    () => VerdictSchema.parse(verdictCandidate),
    (verdict) => `Final score ${verdict.score}; label ${verdict.label}.`,
    emit,
  );
}
