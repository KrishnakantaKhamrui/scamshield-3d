import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { DeleteMyDataButton } from "@/components/layout/DeleteMyDataButton";
import {
  CYBERCRIME_REPORT_URL,
  EMERGENCY_PHONE_NUMBER,
} from "@/lib/constants";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 md:py-5">
        <p className="inline-flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="shrink-0 text-status-suspicious" size={15} />
          Not a substitute for official advice.
        </p>
        <p>
          For fraud call{" "}
          <a
            className="font-semibold text-foreground hover:text-accent"
            href={`tel:${EMERGENCY_PHONE_NUMBER}`}
          >
            {EMERGENCY_PHONE_NUMBER}
          </a>
          {" "}or visit{" "}
          <a
            className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:text-accent"
            href={CYBERCRIME_REPORT_URL}
            target="_blank"
            rel="noreferrer"
          >
            cybercrime.gov.in
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            className="underline decoration-border underline-offset-4 hover:text-accent"
            href="/privacy"
          >
            Privacy
          </Link>
          <DeleteMyDataButton />
        </div>
      </div>
    </footer>
  );
}
