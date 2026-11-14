"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  House,
  LayoutDashboard,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const tabs = [
  { label: "Home", href: "/", Icon: House },
  { label: "Analyze", href: "/analyze", Icon: ScanSearch },
  { label: "Eval", href: "/eval", Icon: ClipboardList },
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex w-full max-w-lg items-center justify-around">
        {tabs.map(({ label, href, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-auto flex min-h-11 min-w-11 max-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium leading-none text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active && "bg-accent/10 text-accent",
                )}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={active ? 2.4 : 1.8} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <div className="mx-auto flex min-h-11 min-w-11 max-w-[5.5rem] flex-col items-center justify-center gap-1 text-[10px] font-medium leading-none text-muted">
            <ThemeToggle className="border-0 bg-transparent hover:bg-accent/10" />
            <span>Theme</span>
          </div>
        </li>
      </ul>
    </nav>
  );
}
