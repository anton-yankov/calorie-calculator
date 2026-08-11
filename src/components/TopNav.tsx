"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Analyze" },
  { href: "/log", label: "Log" },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-5 px-5 py-3.5 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          <span className="sm:hidden">Calories</span>
          <span className="hidden sm:inline">Calorie Calculator</span>
        </Link>
        <div className="flex rounded-lg bg-surface-raised p-0.5">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-4 py-1.5 text-center text-xs font-semibold transition-colors ${
                  active
                    ? "bg-control text-foreground"
                    : "text-muted hover:bg-control/70 hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
