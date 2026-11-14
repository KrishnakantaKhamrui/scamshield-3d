"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const links = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Eval", href: "/eval" },
  { label: "Dashboard", href: "/dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 hidden border-b border-border/70 bg-background/65 backdrop-blur-xl md:block">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between gap-6 px-6"
      >
        <Link
          href="/"
          className="inline-flex min-w-0 items-center gap-2.5 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ShieldCheck aria-hidden="true" size={23} />
          </span>
          <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight">
            ScamShield <span className="text-accent">3D</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ label, href }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active && "bg-accent/10 text-accent",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <ThemeToggle />
      </nav>
    </header>
  );
}
