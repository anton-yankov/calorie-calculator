"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { path: "", label: "Overview" },
  { path: "/log", label: "Log" },
  { path: "/stats", label: "Stats" },
  { path: "/products", label: "Products" },
] as const;

/** The section switcher; a client component because the layout around it doesn't rerender on navigation. */
export function Tabs({ userId }: { userId: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="grid grid-cols-4 gap-1 rounded-[16px] bg-surface p-1 lg:w-[480px]"
    >
      {TABS.map((t) => {
        const href = `/admin/users/${userId}${t.path}`;
        const current = pathname === href;
        return (
          <Link
            key={t.path}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex h-10 items-center justify-center rounded-[12px] text-[13px] font-bold transition-colors ${
              current ? "bg-accent text-[#241a15]" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
