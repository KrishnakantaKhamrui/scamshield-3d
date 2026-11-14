"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DefangedText } from "@/components/ui/DefangedText";
import { DeleteMyDataButton } from "@/components/layout/DeleteMyDataButton";
import { useScanStore } from "@/store/useScanStore";

export default function DashboardPage() {
  const scans = useScanStore((state) => state.scans);
  const hasHydrated = useScanStore((state) => state.hasHydrated);

  return (
    <section className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            This device only
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
            Scan history
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Only redacted messages and their verdicts are saved in this
            browser&apos;s local storage.
          </p>
        </div>
        <DeleteMyDataButton />
      </div>

      {!hasHydrated ? (
        <Card className="p-5 text-sm text-muted">Loading saved scans…</Card>
      ) : scans.length === 0 ? (
        <Card className="p-5 text-sm text-muted">
          No scans are saved on this device.
        </Card>
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => (
            <li key={scan.id}>
              <Card className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={scan.verdict.label}>
                    {scan.verdict.label}
                  </Badge>
                  <time
                    className="text-xs text-muted"
                    dateTime={scan.createdAt}
                  >
                    {new Date(scan.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  <DefangedText text={scan.redactedText} />
                </p>
                <p className="text-xs text-muted">
                  Score: {scan.verdict.score}/100 ·{" "}
                  <DefangedText text={scan.verdict.scamType} />
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
