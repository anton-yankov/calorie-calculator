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
    <nav>
      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="flex rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
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
