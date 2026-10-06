import type { Metadata } from "next";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { SkeletonAccountHeader } from "@/components/loaders";
import { loadAccount, loadDailyCap, loadPlans, loadUsage, requireAdminOnce } from "./data";
import { Tabs } from "./Tabs";

export const metadata: Metadata = { title: "User — Calorie Calculator" };

const GOAL_LABELS = { lose: "Lose", maintain: "Maintain", gain: "Gain" } as const;

/** "3 Oct", in Sofia time: this renders on the server, which runs in UTC. */
const sofiaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "short",
  });

/**
 * Admin only: one account, read-only. The header and tabs live here, so
 * switching tabs keeps them on screen and loads only the tab's own data.
 * Each tab reuses the page the user sees, with its edit controls switched
 * off, and reads that user's rows with the secret key (still filtered by
 * their id).
 */
export default async function AdminUserLayout({
  children,
  params,
}: LayoutProps<"/admin/users/[userId]">) {
  const { userId } = await params;
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3.5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
      <Suspense fallback={<SkeletonAccountHeader />}>
        <Header userId={userId} />
      </Suspense>
      <Tabs userId={userId} />
      {children}
    </main>
  );
}

/** The email and key numbers; they need the plan and today's AI use on every tab. */
async function Header({ userId }: { userId: string }) {
  const viewer = await requireAdminOnce();
  const [account, plans, usage, dailyCap] = await Promise.all([
    loadAccount(userId),
    loadPlans(userId),
    loadUsage(userId),
    loadDailyCap(userId),
  ]);
  const plan = plans.at(-1) ?? null;
  const usedToday = usage.at(-1)?.used ?? 0;

  return (
    <>
      <div className="flex items-center gap-3">
        <ButtonLink href="/admin" variant="outline" size="icon" aria-label="Back to users">
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </ButtonLink>
        <p className="min-w-0 break-words text-lg font-extrabold tracking-tight">{account.email}</p>
      </div>

      <span className="self-start rounded-full bg-[#33291a] px-3 py-1 text-xs font-bold text-amber">
        {account.userId === viewer.userId
          ? "Your own account, shown read-only"
          : "Read-only · only the AI cap can be changed"}
      </span>

      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-[18px] bg-surface p-3">
          <span className="block text-xs text-muted">Plan</span>
          <b className="block truncate text-[17px] font-extrabold">
            {plan ? GOAL_LABELS[plan.goal] : "None yet"}
          </b>
          {plan && (
            <span className="block truncate text-xs text-muted tabular-nums">
              {plan.calorieTarget.toLocaleString("en-US")} · {plan.proteinTarget} g
            </span>
          )}
        </div>
        <div className="min-w-0 rounded-[18px] bg-surface p-3">
          <span className="block text-xs text-muted">Last login</span>
          <b className="block truncate text-[17px] font-extrabold">
            {account.lastSignInAt ? sofiaDate(account.lastSignInAt) : "Never"}
          </b>
        </div>
        <div className="min-w-0 rounded-[18px] bg-surface p-3">
          <span className="block text-xs text-muted">AI today</span>
          <b className="block text-[17px] font-extrabold tabular-nums">
            {dailyCap === null ? usedToday : `${usedToday} / ${dailyCap}`}
          </b>
          <span className="block text-xs text-muted">
            {dailyCap === null
              ? "No cap"
              : dailyCap === 0
                ? "Paused"
                : `${Math.max(dailyCap - usedToday, 0)} left`}
          </span>
        </div>
      </div>
    </>
  );
}
