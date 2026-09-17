"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useMounted } from "@/components/useMounted";
import { dayKey, dayLabel } from "@/lib/day";
import type { AccountSummary } from "@/lib/admin";
import { setDailyCapAction } from "./actions";

const GOAL_LABELS = { lose: "Lose", maintain: "Maintain", gain: "Gain" } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function planText(plan: AccountSummary["plan"]) {
  return plan
    ? `${GOAL_LABELS[plan.goal]} · ${fmt(plan.calorieTarget)} kcal · ${plan.proteinTarget} g`
    : "Not set up yet";
}

/** The cap field and its Save button; the admin's own row has no cap. */
function CapEditor({ account }: { account: AccountSummary }) {
  const [value, setValue] = useState(String(account.dailyCap ?? ""));
  const [pending, startTransition] = useTransition();
  if (account.dailyCap === null) return <span className="font-mono text-sm">∞</span>;

  function handleSave() {
    startTransition(async () => {
      const result = await setDailyCapAction(account.userId, Number(value));
      if (result.error) toast.error(result.error);
      else toast.success(`${account.email}: ${value} analyses a day`);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        value={value}
        disabled={pending}
        aria-label={`Daily AI cap for ${account.email}`}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded-md border border-line bg-background px-1.5 py-1 text-right font-mono text-xs tabular-nums text-foreground focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        disabled={pending || value === String(account.dailyCap)}
        onClick={handleSave}
        className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-accent transition-colors hover:border-accent disabled:text-muted disabled:hover:border-line"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </span>
  );
}

function aiToday(account: AccountSummary) {
  return account.dailyCap === null
    ? `${account.aiUsedToday} · no cap`
    : `${account.aiUsedToday} / ${account.dailyCap}`;
}

/**
 * Accounts as a table on desktop and as cards on phones. "Last active" is the
 * newest logged meal, in the viewer's timezone.
 */
export function AdminUsers({
  accounts,
  viewerId,
}: {
  accounts: AccountSummary[];
  viewerId: string;
}) {
  // "Yesterday" depends on the viewer's timezone, so it waits for the browser
  const mounted = useMounted();
  const lastActive = (account: AccountSummary) =>
    account.lastMealAt && mounted ? dayLabel(dayKey(account.lastMealAt)) : "—";
  const tag = (account: AccountSummary) =>
    [account.userId === viewerId && "you", account.isAdmin && "admin"].filter(Boolean).join(" · ");

  return (
    <>
      <div className="hidden overflow-hidden rounded-panel border border-line bg-surface lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-raised text-left text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="px-4 py-2.5 font-semibold">Account</th>
              <th className="px-3 py-2.5 font-semibold">Plan</th>
              <th className="px-3 py-2.5 font-semibold">Last active</th>
              <th className="px-3 py-2.5 font-semibold">AI today</th>
              <th className="px-3 py-2.5 font-semibold">Daily cap</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.userId} className="border-t border-line align-middle">
                <td className="px-4 py-3 font-semibold">
                  {account.email}
                  {tag(account) && (
                    <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted">
                      {tag(account)}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-3 ${account.plan ? "" : "text-muted"}`}>
                  {planText(account.plan)}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{lastActive(account)}</td>
                <td className="px-3 py-3 font-mono text-xs">{aiToday(account)}</td>
                <td className="px-3 py-3">
                  <CapEditor account={account} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${account.userId}`}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {accounts.map((account) => (
          <article
            key={account.userId}
            className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words text-sm font-semibold">
                {account.email}
                {tag(account) && (
                  <span className="ml-1.5 text-xs text-muted">({tag(account)})</span>
                )}
              </span>
              <Link
                href={`/admin/users/${account.userId}`}
                className="shrink-0 text-xs font-semibold text-accent hover:underline"
              >
                View
              </Link>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted">Plan</dt>
              <dd>{planText(account.plan)}</dd>
              <dt className="text-muted">Last active</dt>
              <dd className="font-mono">{lastActive(account)}</dd>
              <dt className="text-muted">AI today</dt>
              <dd className="font-mono">{aiToday(account)}</dd>
            </dl>
            {account.dailyCap !== null && (
              <div className="flex items-center gap-3 text-xs text-muted">
                Daily cap
                <CapEditor account={account} />
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
