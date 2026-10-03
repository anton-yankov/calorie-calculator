"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { inAccountArea, PAGES, pageTitle } from "@/components/nav";
import { useMounted } from "@/components/useMounted";

/**
 * The top of every page: the page's title row and, on phones, the four tabs
 * underneath it. On desktop the tabs live in the sidebar, so only the title
 * row is shown here.
 */
export function TopNav() {
  const pathname = usePathname();
  // "Saturday, 3 October" depends on the viewer's timezone, so it waits for the browser
  const mounted = useMounted();
  const today = mounted
    ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "";

  // Login and setup have their own full-page design, with no pages to go to yet
  if (pathname === "/login" || pathname === "/onboarding") return null;
  const { sub, title } = pageTitle(pathname, today);
  const accountArea = inAccountArea(pathname);

  // The installed app draws under the status bar (viewport-fit=cover in the
  // root layout), so the bar pads itself by the top inset; without it the
  // tabs sit in the status bar strip, where iOS swallows the taps. The inset is
  // 0px anywhere the system isn't covering the top. On desktop the header
  // scrolls away with the page, since the sidebar holds the navigation.
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:static lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto w-full max-w-2xl px-4 lg:max-w-5xl lg:px-8 lg:pt-6">
        <div className="flex items-center justify-between gap-3 pt-2 pb-2.5">
          <div className="min-w-0">
            <p className="min-h-[1.25em] truncate text-[13px] font-medium text-muted">{sub}</p>
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight lg:text-[30px]">
              {title}
            </h1>
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-panel transition-colors lg:hidden ${
              accountArea
                ? "bg-accent text-background"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            <UserRound className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden />
          </Link>
        </div>
        <nav aria-label="Pages" className="-mx-2 flex lg:hidden">
          {PAGES.map((page) => {
            const active = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-11 flex-1 items-center justify-center text-sm font-bold transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {page.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-[22%] -bottom-px h-[3px] rounded-full bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
