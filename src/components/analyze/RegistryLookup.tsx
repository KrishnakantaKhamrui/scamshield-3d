"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type LookupType = "phone" | "upi";

export function RegistryLookup() {
  const [type, setType] = useState<LookupType>("phone");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const query = new URLSearchParams({ type, value });
      const response = await fetch(`/api/lookup?${query}`, {
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error("Lookup is temporarily unavailable. Please try again.");
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("count" in result) ||
        typeof result.count !== "number"
      ) {
        throw new Error("Lookup is temporarily unavailable. Please try again.");
      }
      setMessage(
        result.count > 0
          ? `Reported ${result.count} time(s).`
          : "No reports yet (not proof it is safe).",
      );
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Lookup is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-4 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">
        Check a number or UPI ID
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        We hash the value before checking. A match is a signal, not proof.
      </p>
      <form className="mt-3 space-y-3" onSubmit={(event) => void handleLookup(event)}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
          <label className="sr-only" htmlFor="registry-lookup-type">
            Value type
          </label>
          <select
            id="registry-lookup-type"
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            disabled={isLoading}
            onChange={(event) =>
              setType(event.target.value === "upi" ? "upi" : "phone")
            }
            value={type}
          >
            <option value="phone">Phone number</option>
            <option value="upi">UPI ID</option>
          </select>
          <label className="sr-only" htmlFor="registry-lookup-value">
            Phone number or UPI ID
          </label>
          <input
            id="registry-lookup-value"
            autoComplete="off"
            className="min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20"
            disabled={isLoading}
            maxLength={256}
            onChange={(event) => setValue(event.target.value)}
            placeholder={type === "phone" ? "Phone number" : "name@upi"}
            required
            value={value}
          />
        </div>
        <Button className="w-full sm:w-auto" disabled={isLoading} type="submit" variant="outline">
          <Search aria-hidden="true" size={16} />
          {isLoading ? "Checking..." : "Check reports"}
        </Button>
      </form>
      {message && (
        <p aria-live="polite" className="mt-3 text-sm font-medium text-foreground">
          {message}
        </p>
      )}
      {error && (
        <p aria-live="polite" className="mt-3 text-sm text-status-scam">
          {error}
        </p>
      )}
    </Card>
  );
}
