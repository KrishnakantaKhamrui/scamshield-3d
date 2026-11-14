import {
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Radar,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DefangedText } from "@/components/ui/DefangedText";
import type { Verdict } from "@/types";

interface FlagsPanelProps {
  verdict: Verdict;
}

function FlagList({
  title,
  flags,
  kind,
}: {
  title: string;
  flags: string[];
  kind: "red" | "green";
}) {
  const Icon = kind === "red" ? CircleX : CircleCheck;
  const color =
    kind === "red" ? "text-status-scam" : "text-status-safe";

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon aria-hidden="true" className={color} size={17} />
        {title}
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
          {flags.length}
        </span>
      </h3>
      {flags.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {flags.map((flag, index) => (
            <li
              key={`${flag}-${index}`}
              className="flex gap-2 text-sm leading-5 text-muted"
            >
              <Icon
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${color}`}
                size={15}
              />
              <DefangedText className="break-words" text={flag} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-5 text-muted">No {kind} flags found.</p>
      )}
    </Card>
  );
}

export function FlagsPanel({ verdict }: FlagsPanelProps) {
  const ragMatch = verdict.toolEvidence.find((item) => item.tool === "rag");
  const urlEvidence = verdict.toolEvidence.find(
    (item) => item.tool === "urlChecker",
  );
  const threatIntel = verdict.toolEvidence.find(
    (item) => item.tool === "threatIntel",
  )?.threatIntel;
  const registryHits =
    verdict.toolEvidence.find((item) => item.tool === "registry")?.registry ?? [];
  const foundUrls =
    urlEvidence?.details
      .filter((detail) => detail.startsWith("URL: "))
      .map((detail) => detail.slice("URL: ".length)) ?? [];
  const whatToDo =
    ragMatch?.details
      .filter((detail) => detail.startsWith("What to do: "))
      .map((detail) => detail.slice("What to do: ".length)) ?? [];
  const patternFlags =
    ragMatch?.details
      .filter((detail) => detail.startsWith("Red flag: "))
      .map((detail) => detail.slice("Red flag: ".length)) ?? [];

  return (
    <section aria-labelledby="flags-title" className="space-y-3">
      <h2 id="flags-title" className="font-display text-lg font-semibold text-foreground">
        Signals &amp; guidance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <FlagList kind="red" title="Red flags" flags={verdict.redFlags} />
        <FlagList kind="green" title="Green flags" flags={verdict.greenFlags} />
      </div>

      {foundUrls.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">Links found</h3>
          <ul className="mt-3 space-y-2">
            {foundUrls.map((url, index) => (
              <li key={`${url}-${index}`} className="break-all text-sm">
                <DefangedText text={url} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {threatIntel && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert aria-hidden="true" className="text-accent" size={17} />
              Threat intelligence
            </h3>
            <Badge variant={threatIntel.score > 0 ? "scam" : "neutral"}>
              Score {threatIntel.score}
            </Badge>
          </div>
          <ul className="mt-3 space-y-2">
            {threatIntel.sources.map((source) => {
              const isSkipped = threatIntel.skipped.includes(source.name);
              const status = source.hit
                ? isSkipped
                  ? "Hit; some lookups skipped"
                  : "Hit"
                : isSkipped
                  ? "Skipped"
                  : "No match";
              const statusColor = source.hit
                ? "text-status-scam"
                : isSkipped
                  ? "text-status-suspicious"
                  : "text-muted";

              return (
                <li
                  key={source.name}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"
                >
                  <span className="font-medium text-foreground">
                    <DefangedText text={source.name} />
                  </span>
                  <span className={statusColor}>{status}</span>
                  {source.detail && (
                    <DefangedText
                      className="basis-full break-words text-xs leading-5 text-muted"
                      text={source.detail}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {registryHits.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert aria-hidden="true" className="text-accent" size={17} />
              Community registry
            </h3>
            <Badge variant="neutral">{registryHits.length} match(es)</Badge>
          </div>
          <ul className="mt-3 space-y-3">
            {registryHits.map((hit, index) => (
              <li
                key={`${hit.type}-${hit.displayValue}-${index}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
              >
                <DefangedText
                  className="font-medium text-foreground"
                  text={hit.displayValue}
                />
                <Badge variant={hit.count >= 3 ? "suspicious" : "neutral"}>
                  {hit.count >= 3
                    ? `Reported by ${hit.count} users`
                    : `Reported ${hit.count} time(s)`}
                </Badge>
                <p className="basis-full text-xs leading-5 text-muted">
                  {hit.type} · <DefangedText text={hit.category} />
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Reports are user-submitted signals, not proof.
          </p>
        </Card>
      )}

      {ragMatch && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Radar aria-hidden="true" className="text-accent" size={17} />
              Top RAG match
            </h3>
            {typeof ragMatch.score === "number" && (
              <Badge variant="neutral">
                Similarity {ragMatch.score}%
              </Badge>
            )}
          </div>
          <DefangedText
            className="mt-2 text-sm leading-5 text-muted"
            text={ragMatch.summary}
          />
          {patternFlags.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Related pattern flags
              </h4>
              <ul className="mt-2 space-y-1.5">
                {patternFlags.slice(0, 3).map((flag, index) => (
                  <li
                    key={`${flag}-${index}`}
                    className="flex gap-2 text-sm leading-5 text-muted"
                  >
                    <CircleX
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-status-scam"
                      size={15}
                    />
                    <DefangedText text={flag} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {whatToDo.length > 0 && (
            <div className="mt-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <ClipboardCheck aria-hidden="true" size={15} />
                What to do
              </h4>
              <ul className="mt-2 space-y-1.5">
                {whatToDo.slice(0, 3).map((action, index) => (
                  <li
                    key={`${action}-${index}`}
                    className="flex gap-2 text-sm leading-5 text-muted"
                  >
                    <CircleCheck
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-status-safe"
                      size={15}
                    />
                    <DefangedText text={action} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
