"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DefangedText } from "@/components/ui/DefangedText";
import type { RegistryEntityType, Verdict } from "@/types";

const entityTypes: Array<{ value: RegistryEntityType; label: string }> = [
  { value: "phone", label: "Phone number" },
  { value: "upi", label: "UPI ID" },
  { value: "url", label: "Link" },
  { value: "domain", label: "Domain" },
];

function isEntityType(value: string): value is RegistryEntityType {
  return entityTypes.some((option) => option.value === value);
}

interface ReportEntityFormProps {
  verdict: Verdict;
}

export function ReportEntityForm({ verdict }: ReportEntityFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<RegistryEntityType>("phone");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReport = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (
      !window.confirm(
        "Submit this report? The value will be hashed. Supabase stores a masked display, category, and report count, not the full value or message.",
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value,
          category: verdict.scamType,
        }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "This value was already reported recently from this network."
            : "The report could not be submitted. Please try again later.",
        );
      }
      setStatus(
        "Report recorded. The registry stores a salted hash, masked display, category, and report count, not the full value or message.",
      );
      setValue("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The report could not be submitted. Please try again later.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verdict.label === "safe") {
    return null;
  }

  return (
    <Card className="p-4 sm:p-5">
      <Button
        aria-expanded={isOpen}
        className="w-full sm:w-auto"
        onClick={() => {
          setIsOpen((open) => !open);
          setError(null);
        }}
        type="button"
        variant="outline"
      >
        <ShieldAlert aria-hidden="true" size={17} />
        Report this number / UPI / link to protect others
      </Button>
      {isOpen && (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submitReport(event)}>
          <p className="text-sm leading-5 text-muted">
            The registry stores only a salted hash, a masked display value, and
            the scam category. It never stores your message or the full value.
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
            <label className="sr-only" htmlFor="registry-report-type">
              Report type
            </label>
            <select
              id="registry-report-type"
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              disabled={isSubmitting}
              onChange={(event) => {
                if (isEntityType(event.target.value)) {
                  setType(event.target.value);
                }
              }}
              value={type}
            >
              {entityTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="registry-report-value">
              Value to report
            </label>
            <input
              id="registry-report-value"
              autoComplete="off"
              className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20"
              disabled={isSubmitting}
              maxLength={512}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                type === "phone"
                  ? "Phone number"
                  : type === "upi"
                    ? "name@upi"
                    : type === "url"
                      ? "https://example.com/path"
                      : "example.com"
              }
              required
              value={value}
            />
          </div>
          <p className="text-xs text-muted">
            Category: <DefangedText text={verdict.scamType} />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : "Confirm report"}
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => setIsOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
          {status && (
            <p aria-live="polite" className="text-sm text-status-safe">
              {status}
            </p>
          )}
          {error && (
            <p aria-live="polite" className="text-sm text-status-scam">
              {error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
