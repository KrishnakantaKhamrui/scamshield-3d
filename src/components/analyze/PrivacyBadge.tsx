import { ShieldCheck, TriangleAlert } from "lucide-react";

interface PrivacyBadgeProps {
  redactedCount: number;
  injectionDetected: boolean;
}

export function PrivacyBadge({
  redactedCount,
  injectionDetected,
}: PrivacyBadgeProps) {
  const itemLabel = redactedCount === 1 ? "item" : "items";

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-status-safe/25 bg-status-safe/10 px-3 text-xs font-medium text-status-safe">
        <ShieldCheck aria-hidden="true" size={16} />
        {redactedCount} sensitive {itemLabel} masked before AI analysis
      </span>
      {injectionDetected && (
        <span
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-status-suspicious/30 bg-status-suspicious/10 px-3 text-xs font-semibold text-status-suspicious"
        >
          <TriangleAlert aria-hidden="true" size={16} />
          Prompt-injection attempt detected
        </span>
      )}
    </div>
  );
}
