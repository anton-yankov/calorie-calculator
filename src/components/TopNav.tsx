"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const tabs = [
  { href: "/", label: "Analyze" },
  { href: "/log", label: "Log" },
  { href: "/products", label: "Products" },
  { href: "/stats", label: "Stats" },
] as const;

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[15px] w-[15px]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function TopNav() {
  const pathname = usePathname();
  // The login screen keeps only the wordmark. Onboarding drops the tabs too —
  // every destination would bounce back until there's a plan — but keeps Log
  // out, in case it's the wrong account. Log out otherwise lives in Settings.
  const onLogin = pathname === "/login";
  const onOnboarding = pathname === "/onboarding";
  const onSettings = pathname === "/settings";

  return (
    <nav className="sticky top-0 z-30 border-b border-line/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3 sm:gap-5 sm:px-6 lg:max-w-5xl">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-foreground">
          <span className="sm:hidden">Calories</span>
          <span className="hidden sm:inline">Calorie Calculator</span>
        </Link>

        {onOnboarding ? (
          <form action={logout}>
            <button
              type="submit"
              className="px-2 text-[11px] font-semibold text-muted transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </form>
        ) : (
          <div className={`flex items-center gap-1.5 sm:gap-2 ${onLogin ? "invisible" : ""}`}>
            <div className="flex rounded-full border border-line bg-surface p-1">
              {tabs.map((tab) => {
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    // Four tabs plus the gear only fit beside the wordmark on a 375px phone at this tighter size
                    className={`rounded-full px-2 py-1.5 text-center text-[11px] font-semibold transition-colors sm:px-4 sm:text-xs ${
                      active ? "bg-accent text-background" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={onSettings ? "page" : undefined}
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                onSettings
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              <GearIcon />
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
