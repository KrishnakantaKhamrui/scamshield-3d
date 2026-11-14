"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Bot,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  ExternalLink,
  Fingerprint,
  Globe2,
  Link2,
  LockKeyhole,
  MessageSquareText,
  ScanSearch,
  ShieldAlert,
  Siren,
  Sparkles,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  CYBERCRIME_REPORT_URL,
  EMERGENCY_PHONE_NUMBER,
} from "@/lib/constants";
import { useScanStore } from "@/store/useScanStore";

interface PipelineStep {
  title: string;
  detail: string;
  Icon: LucideIcon;
}

interface Difference {
  title: string;
  detail: string;
  Icon: LucideIcon;
}

const pipelineSteps: PipelineStep[] = [
  {
    title: "Privacy Shield",
    detail: "Masks sensitive details before AI analysis.",
    Icon: LockKeyhole,
  },
  {
    title: "Injection Guard",
    detail: "Treats message instructions as untrusted.",
    Icon: ShieldAlert,
  },
  {
    title: "URL & Sender Tools",
    detail: "Checks links, sender cues, and requests.",
    Icon: Link2,
  },
  {
    title: "Heuristic Classifier",
    detail: "Scores explainable scam indicators.",
    Icon: ScanSearch,
  },
  {
    title: "RAG over 25 India scam patterns",
    detail: "Finds relevant patterns and guidance.",
    Icon: Fingerprint,
  },
  {
    title: "Gemini Reasoner",
    detail: "Weighs the evidence in context.",
    Icon: Bot,
  },
  {
    title: "Verified Verdict",
    detail: "Returns a validated label and next steps.",
    Icon: BadgeCheck,
  },
];

const differences: Difference[] = [
  {
    title: "Privacy Shield",
    detail:
      "Sensitive details are redacted before analysis and only redacted message text is saved on this device.",
    Icon: LockKeyhole,
  },
  {
    title: "Prompt-injection defense",
    detail:
      "Suspicious message content is treated as data, never as instructions for the AI to follow.",
    Icon: ShieldAlert,
  },
  {
    title: "Evidence-based trace",
    detail:
      "Review the checks, signals, and reasons behind each result instead of relying on a label alone.",
    Icon: Waypoints,
  },
  {
    title: "Measured accuracy",
    detail:
      "Compare heuristics, model reasoning, and the complete pipeline on a labeled demonstration set.",
    Icon: ChartNoAxesCombined,
  },
];

function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.4,
        delay: prefersReducedMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

function AgentPreview() {
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Investigation preview
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            Evidence, not guesswork
          </h2>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Sparkles aria-hidden="true" size={20} />
        </span>
      </div>

      <div className="relative mt-5 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/75 p-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <MessageSquareText aria-hidden="true" size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Suspicious message
            </p>
            <p className="text-xs text-muted">Private details are masked first</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-5 text-accent">
          <span className="h-5 w-px bg-accent/40" />
          <ArrowDown aria-hidden="true" size={15} />
          <span className="text-xs font-medium">Agent checks the evidence</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-surface/60 p-3">
            <div className="flex items-center gap-2 text-status-suspicious">
              <CircleAlert aria-hidden="true" size={16} />
              <span className="text-xs font-semibold">Risk signals</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Links, requests, and scam patterns
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-3">
            <div className="flex items-center gap-2 text-status-safe">
              <Check aria-hidden="true" size={16} />
              <span className="text-xs font-semibold">Clear reasons</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              Review what influenced the result
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <BadgeCheck aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Explainable verdict
            </p>
            <p className="text-xs text-muted">
              Risk label, evidence, and safer next steps
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PipelineSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section aria-labelledby="how-it-works" className="space-y-5">
      <FadeUp>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            One step at a time
          </p>
          <h2
            id="how-it-works"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            How the investigation works
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A layered pipeline checks the message before producing a
            human-readable verdict.
          </p>
        </div>
      </FadeUp>

      <ol className="relative grid grid-cols-1 gap-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-border lg:grid-cols-7 lg:gap-2 lg:before:bottom-auto lg:before:left-0 lg:before:right-0 lg:before:top-[19px] lg:before:h-px lg:before:w-auto">
        {pipelineSteps.map(({ title, detail, Icon }, index) => (
          <motion.li
            key={title}
            className="relative flex min-w-0 items-start gap-3 lg:flex-col lg:items-center lg:gap-2 lg:text-center"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.35,
              delay: prefersReducedMotion ? 0 : index * 0.04,
            }}
          >
            <span className="relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-background text-accent shadow-sm lg:size-10">
              <Icon aria-hidden="true" size={18} />
            </span>
            <Card className="min-w-0 flex-1 p-3 lg:w-full lg:flex-none lg:p-3">
              <p className="text-sm font-semibold leading-5 text-foreground lg:min-h-10 lg:text-xs xl:text-sm">
                {title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
            </Card>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function DifferenceSection() {
  return (
    <section aria-labelledby="why-different" className="space-y-5">
      <FadeUp>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Designed for clarity
            </p>
            <h2
              id="why-different"
              className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Why it&apos;s different
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-surface/65 px-3 py-2 text-xs font-medium text-muted sm:self-auto">
            <Globe2 aria-hidden="true" className="text-accent" size={15} />
            English, Hindi, and Bengali
          </div>
        </div>
      </FadeUp>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {differences.map(({ title, detail, Icon }, index) => {
          const content = (
            <Card className="h-full p-4 transition-colors hover:border-accent/35 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon aria-hidden="true" size={19} />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{detail}</p>
                </div>
              </div>
              {title === "Measured accuracy" && (
                <span className="mt-3 inline-flex items-center gap-1.5 pl-[52px] text-sm font-semibold text-accent">
                  Explore the evaluation
                  <ArrowRight aria-hidden="true" size={15} />
                </span>
              )}
            </Card>
          );

          return (
            <FadeUp key={title} delay={index * 0.04}>
              {title === "Measured accuracy" ? (
                <Link
                  href="/eval"
                  className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </FadeUp>
          );
        })}
      </div>
    </section>
  );
}

function LocalCounter() {
  const scansAnalyzed = useScanStore((state) =>
    state.hasHydrated ? state.scans.length : 0,
  );
  const scamsCaught = useScanStore((state) =>
    state.hasHydrated
      ? state.scans.filter((scan) => scan.verdict.label === "scam").length
      : 0,
  );

  return (
    <section aria-label="Your activity on this device">
      <FadeUp>
        <Card className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <BellRing aria-hidden="true" size={18} />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                {scansAnalyzed}
              </p>
              <p className="text-xs leading-5 text-muted sm:text-sm">
                Scans on this device
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-scam/10 text-status-scam">
              <ShieldAlert aria-hidden="true" size={18} />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                {scamsCaught}
              </p>
              <p className="text-xs leading-5 text-muted sm:text-sm">
                Scams caught
              </p>
            </div>
          </div>
        </Card>
      </FadeUp>
    </section>
  );
}

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full space-y-12 pb-4 sm:space-y-16">
      <section
        aria-labelledby="hero-title"
        className="grid w-full items-center gap-8 py-4 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
        >
          <Badge variant="neutral" className="mb-4">
            Private, explainable scam investigation
          </Badge>
          <h1
            id="hero-title"
            className="max-w-3xl font-display text-[clamp(2.25rem,8vw,4.5rem)] font-semibold leading-[1.08] tracking-tight text-foreground"
          >
            Don&apos;t get <span className="text-accent">scammed.</span>{" "}
            <span className="text-accent">Investigate it.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            An AI agent that investigates suspicious messages like a cyber
            analyst, with evidence you can verify.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/analyze"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Analyze a message
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link
              href="/eval"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View evaluation
              <ChartNoAxesCombined aria-hidden="true" size={17} />
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden="true" className="text-status-safe" size={14} />
              Sensitive details masked first
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden="true" className="text-status-safe" size={14} />
              Explanations in 3 languages
            </span>
          </div>
        </motion.div>

        <FadeUp delay={0.08}>
          <AgentPreview />
        </FadeUp>
      </section>

      <PipelineSection />
      <DifferenceSection />
      <LocalCounter />

      <FadeUp>
        <section
          aria-label="Emergency fraud reporting"
          className="flex flex-col gap-4 rounded-2xl border border-status-scam/25 bg-status-scam/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-scam/10 text-status-scam">
              <Siren aria-hidden="true" size={20} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Lost money to a scam?
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Call {EMERGENCY_PHONE_NUMBER} and report at cybercrime.gov.in.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`tel:${EMERGENCY_PHONE_NUMBER}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-status-scam/30 bg-surface/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-status-scam/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-scam"
            >
              <Siren aria-hidden="true" size={16} />
              Call {EMERGENCY_PHONE_NUMBER}
            </a>
            <a
              href={CYBERCRIME_REPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-status-scam/30 bg-surface/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-status-scam/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-scam"
            >
              Report online
              <ExternalLink aria-hidden="true" size={15} />
            </a>
          </div>
        </section>
      </FadeUp>
    </div>
  );
}
