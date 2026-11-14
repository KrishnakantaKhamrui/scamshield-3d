import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  CYBERCRIME_REPORT_URL,
  EMERGENCY_PHONE_NUMBER,
} from "@/lib/constants";

const dataLocations = [
  {
    place: "Your browser",
    detail:
      "Only redacted scans and their verdicts are saved in local storage on this device. Use Delete my data to remove them.",
  },
  {
    place: "ScamShield server",
    detail:
      "The server processes a request in memory and does not store messages. Logs contain request metadata only, not message text or request headers.",
  },
  {
    place: "Google Gemini",
    detail:
      "Redacted message text is sent to Google Gemini for analysis when AI is enabled. Sensitive details are masked first, but pattern-based masking can miss names and addresses.",
  },
  {
    place: "Community registry (Supabase)",
    detail:
      "During analysis, phone, UPI, and URL/domain values are normalized and hashed in memory before lookup. For an explicit report or lookup, the selected value is sent to our server only to hash it. Supabase stores a salted hash, masked or defanged display value, scam category, count, and timestamps; it never stores the raw value or message text.",
  },
  {
    place: "Screenshots",
    detail:
      "Screenshot analysis is not enabled in this version. If screenshot support is enabled, screenshots will be sent unredacted to Gemini; crop out personal information before submitting one.",
  },
];

export default function PrivacyPage() {
  return (
    <article className="w-full space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Data use and limits
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Privacy and safety
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          ScamShield is a demonstration tool. Do not paste information you are
          not comfortable sharing with an AI service.
        </p>
      </header>

      <section aria-label="Where information goes" className="grid gap-3">
        {dataLocations.map(({ place, detail }) => (
          <Card key={place} className="p-4 sm:p-5">
            <h2 className="font-display text-base font-semibold text-foreground">
              {place}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
          </Card>
        ))}
      </section>

      <Card className="p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Limits and safe use
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>
            Masking is pattern-based and may miss names, addresses, or other
            identifying details.
          </li>
          <li>
            A safe label is not a guarantee. Verify unexpected requests using
            an official channel.
          </li>
          <li>
            Rate limits are best-effort and may vary between server instances.
          </li>
          <li>
            Anyone can submit a false community report. Counts are submissions,
            not verified unique people, and are a signal rather than proof.
          </li>
          <li>
            UPI IDs and email addresses look alike, so some email-shaped values
            may also be masked or checked as UPI-like entities.
          </li>
        </ul>
      </Card>

      <p className="text-sm leading-6 text-muted">
        For fraud in India, call{" "}
        <a
          className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent"
          href={`tel:${EMERGENCY_PHONE_NUMBER}`}
        >
          {EMERGENCY_PHONE_NUMBER}
        </a>{" "}
        or report at{" "}
        <a
          className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent"
          href={CYBERCRIME_REPORT_URL}
          target="_blank"
          rel="noreferrer"
        >
          cybercrime.gov.in
        </a>
        . Return to <Link className="text-accent hover:underline" href="/">ScamShield</Link>.
      </p>
    </article>
  );
}
