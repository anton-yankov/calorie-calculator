"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { AiCounterCard } from "@/components/AiAllowance";
import { inAccountArea, PAGES } from "@/components/nav";

const item = (active: boolean) =>
  `flex h-12 items-center gap-3 rounded-panel px-3 text-[15px] font-bold transition-colors ${
    active ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
  }`;

/**
 * Desktop navigation: the four pages, today's AI analyses and Settings, in a
 * column that stays put while the page scrolls. Phones use the tabs in the top
 * bar instead.
 */
export function Sidebar() {
  const pathname = usePathname();
  // Nothing to navigate to before logging in or finishing setup
  if (pathname === "/login" || pathname === "/onboarding") return null;
  const accountArea = inAccountArea(pathname);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-black/15 px-3.5 py-6 lg:flex">
      <Link href="/" className="px-3 pb-5 text-[21px] font-extrabold tracking-tight">
        Calories
      </Link>
      <nav aria-label="Pages" className="flex flex-col gap-1">
        {PAGES.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={item(active)}
            >
              <Icon
                className={`h-[22px] w-[22px] ${active ? "text-accent" : ""}`}
                strokeWidth={1.9}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <AiCounterCard />
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={`mt-1 ${item(accountArea)}`}
      >
        <Settings
          className={`h-[22px] w-[22px] ${accountArea ? "text-accent" : ""}`}
          strokeWidth={1.9}
          aria-hidden
        />
        Settings
      </Link>
    </aside>
  );
}
