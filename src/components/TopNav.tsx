"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Analyze" },
  { href: "/log", label: "Log" },
  { href: "/products", label: "Products" },
  { href: "/stats", label: "Stats" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  // The locked screen keeps the wordmark but drops the tabs — every
  // destination would just bounce back to /login anyway
  const locked = pathname === "/login";

  return (
    <nav className="sticky top-0 z-30 border-b border-line/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-5 px-5 py-3 sm:px-6 lg:max-w-5xl">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-foreground">
          <span className="sm:hidden">Calories</span>
          <span className="hidden sm:inline">Calorie Calculator</span>
        </Link>
        <div
          className={`flex rounded-full border border-line bg-surface p-1 ${locked ? "invisible" : ""}`}
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                // Four tabs only fit beside the wordmark on a 375px phone at this tighter size
                className={`rounded-full px-2.5 py-1.5 text-center text-[11px] font-semibold transition-colors sm:px-4 sm:text-xs ${
                  active ? "bg-accent text-background" : "text-muted hover:text-foreground"
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
