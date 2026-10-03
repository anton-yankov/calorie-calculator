"use client";

import { usePathname } from "next/navigation";

/**
 * Settings' two levels. Phones: the list is its own screen, and each section
 * opens as the next screen. Desktop: the list stays on the left and the plan
 * card plus the open section sit on the right.
 */
export function SettingsShell({
  menu,
  planCard,
  children,
}: {
  menu: React.ReactNode;
  planCard: React.ReactNode;
  children?: React.ReactNode;
}) {
  const atList = usePathname() === "/settings";
  return (
    <main className="page-enter mx-auto w-full max-w-md px-4 pt-4 pb-32 lg:grid lg:max-w-5xl lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-8 lg:pt-2 lg:pb-16">
      <div className={`${atList ? "" : "hidden"} lg:sticky lg:top-6 lg:block`}>{menu}</div>
      <div className={`${atList ? "hidden" : "flex"} min-w-0 flex-col gap-3.5 lg:flex`}>
        <div className="hidden lg:block">{planCard}</div>
        {children}
      </div>
    </main>
  );
}
