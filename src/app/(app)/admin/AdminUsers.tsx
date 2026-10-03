"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMounted } from "@/components/useMounted";
import type { AccountSummary } from "@/lib/admin";
import { dayKey, daysBetween } from "@/lib/day";
import { CapButton } from "./CapSheet";

/** At this many analyses left or fewer, the bar turns amber (as the user's own counter does). */
const LOW_LEFT = 3;
const GOAL_LABELS = { lose: "Lose", maintain: "Maintain", gain: "Gain" } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** How recently the account logged a meal, as a coloured dot and a few words. */
function activity(account: AccountSummary, today: string | null): { dot: string; text: string } {
  if (!account.plan) return { dot: "bg-line-strong", text: "Hasn't finished setup" };
  if (!account.lastMealAt || !today) return { dot: "bg-muted", text: "No meals yet" };
  const days = daysBetween(dayKey(account.lastMealAt), today);
  if (days === 0) return { dot: "bg-success", text: "Last meal today" };
  return {
    dot: "bg-muted",
    text: days === 1 ? "Last meal yesterday" : `Last meal ${days} days ago`,
  };
}

function tags(account: AccountSummary, viewerId: string) {
  return [account.userId === viewerId && "you", account.isAdmin && "admin"]
    .filter(Boolean)
    .join(" · ");
}

function planLine(account: AccountSummary) {
  return account.plan ? (
    <>
      <b className="font-bold text-foreground">{GOAL_LABELS[account.plan.goal]}</b> ·{" "}
      {fmt(account.plan.calorieTarget)} kcal · {account.plan.proteinTarget} g protein
    </>
  ) : (
    "No plan yet"
  );
}

/** Today's AI use against the cap, as a bar; words for no cap and paused. */
function AiUse({ account }: { account: AccountSummary }) {
  const { aiUsedToday: used, dailyCap: cap } = account;
  if (cap === null) return <span className="text-[13px] text-muted">{used} used · no cap</span>;
  if (cap === 0) return <span className="text-[13px] font-bold text-danger">Paused</span>;
  const left = cap - used;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line-strong">
        <span
          className={`block h-full rounded-full ${left <= 0 ? "bg-danger" : left <= LOW_LEFT ? "bg-amber" : "bg-accent"}`}
          style={{ width: `${Math.min(used / cap, 1) * 100}%` }}
        />
      </span>
      <span className="shrink-0 text-[13px] font-bold tabular-nums">
        {used} / {cap}
      </span>
    </span>
  );
}

/**
 * Every account: totals on top, then one card per account on phones and a
 * table on desktop. "Last meal" is in the viewer's timezone, so it waits for
 * the browser. Only the cap can be changed here.
 */
export function AdminUsers({
  accounts,
  viewerId,
}: {
  accounts: AccountSummary[];
  viewerId: string;
}) {
  const today = useMounted() ? dayKey(new Date()) : null;
  const activeToday = today
    ? accounts.filter((a) => a.lastMealAt && dayKey(a.lastMealAt) === today).length
    : null;
  const aiToday = accounts.reduce((sum, a) => sum + a.aiUsedToday, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 lg:ml-auto lg:w-[460px]">
        {(
          [
            ["Accounts", accounts.length],
            ["Active today", activeToday ?? "—"],
            ["AI used today", aiToday],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-[18px] bg-surface p-3">
            <span className="block text-xs text-muted">{label}</span>
            <b className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</b>
          </div>
        ))}
      </div>

      {/* Phones: one card per account */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {accounts.map((account) => {
          const { dot, text } = activity(account, today);
          const tag = tags(account, viewerId);
          return (
            <article
              key={account.userId}
              className="flex flex-col gap-3 rounded-[22px] bg-surface p-3.5"
            >
              <Link href={`/admin/users/${account.userId}`} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-raised text-[17px] font-extrabold text-accent uppercase">
                  {account.email.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-bold">
                  <span className="block truncate">{account.email}</span>
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
                    {text}
                    {tag && <b className="text-foreground"> · {tag}</b>}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              </Link>
              <p className="text-[13.5px] text-muted">{planLine(account)}</p>
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[12.5px] text-muted">AI today</span>
                <span className="min-w-0 flex-1">
                  <AiUse account={account} />
                </span>
                <CapButton
                  userId={account.userId}
                  email={account.email}
                  cap={account.dailyCap}
                  usedToday={account.aiUsedToday}
                />
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop: a table, one row per account */}
      <div className="hidden overflow-hidden rounded-[22px] bg-surface lg:block">
        <div className="grid grid-cols-[2.2fr_1.7fr_1.2fr_1.5fr_auto_32px] items-center gap-4 px-5 pt-3.5 pb-2 text-[12.5px] font-bold text-muted">
          <span>Account</span>
          <span>Plan</span>
          <span>Last meal</span>
          <span>AI today</span>
          <span>Daily cap</span>
          <span />
        </div>
        {accounts.map((account) => {
          const { dot, text } = activity(account, today);
          const tag = tags(account, viewerId);
          return (
            <div
              key={account.userId}
              className="grid grid-cols-[2.2fr_1.7fr_1.2fr_1.5fr_auto_32px] items-center gap-4 border-t border-line px-5 py-3 text-sm"
            >
              <Link
                href={`/admin/users/${account.userId}`}
                className="flex min-w-0 items-center gap-2.5 font-bold hover:text-accent"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-raised text-sm font-extrabold text-accent uppercase">
                  {account.email.charAt(0)}
                </span>
                <span className="min-w-0 truncate">{account.email}</span>
                {tag && (
                  <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-bold text-muted">
                    {tag}
                  </span>
                )}
              </Link>
              <span className="text-muted">{planLine(account)}</span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                {text.replace("Last meal ", "").replace(/^today$/, "Today")}
              </span>
              <AiUse account={account} />
              <CapButton
                userId={account.userId}
                email={account.email}
                cap={account.dailyCap}
                usedToday={account.aiUsedToday}
              />
              <Link
                href={`/admin/users/${account.userId}`}
                aria-label={`Open ${account.email}`}
                className="flex h-8 w-8 items-center justify-center text-muted hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
