import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { notFound } from "next/navigation";
import { WaterTrackingProvider } from "@/components/WaterTracking";
import { aiUsageHistory, dailyCapOf, getAccount, requireAdmin } from "@/lib/admin";
import { listSavedBarcodeProducts } from "@/lib/barcode-products";
import { listMeals, listMealTotals } from "@/lib/meals";
import { listPlans } from "@/lib/plan-history";
import { activeWaterGoal, getProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase-admin";
import { listWeights } from "@/lib/weights";
import { LogList } from "@/app/(app)/log/LogList";
import { ProductList } from "@/app/(app)/products/ProductList";
import { StatsView } from "@/app/(app)/stats/StatsView";
import { Overview } from "./Overview";

export const metadata: Metadata = { title: "User — Calorie Calculator" };

const GOAL_LABELS = { lose: "Lose", maintain: "Maintain", gain: "Gain" } as const;

/** "3 Oct", in Sofia time: this renders on the server, which runs in UTC. */
const sofiaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "short",
  });

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Log" },
  { id: "stats", label: "Stats" },
  { id: "products", label: "Products" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// The same two-column grids the Log and Stats pages use, so their views drop in as-is
const GRID =
  "flex flex-col gap-3 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-6 lg:gap-y-3";
const LOG_GRID =
  "flex flex-col gap-3 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-6";

/**
 * Admin only: one account, read-only. Each tab reuses the page the user sees,
 * with its edit controls switched off, and reads that user's rows with the
 * secret key (still filtered by their id).
 */
export default async function AdminUserPage(props: PageProps<"/admin/users/[userId]">) {
  const viewer = await requireAdmin();
  const { userId } = await props.params;
  const { tab: requested } = await props.searchParams;
  const tab: TabId = TABS.find((t) => t.id === requested)?.id ?? "overview";

  const account = await getAccount(userId);
  if (!account) notFound();

  const db = createAdminClient();
  // The header's key numbers need the plan and today's AI use on every tab
  const [profile, plans, usage, dailyCap] = await Promise.all([
    getProfile(userId, db),
    listPlans(userId, db),
    aiUsageHistory(userId, 14),
    dailyCapOf(account),
  ]);
  const waterGoalMl = activeWaterGoal(profile);
  const plan = plans.at(-1) ?? null;
  const usedToday = usage.at(-1)?.used ?? 0;

  let content: React.ReactNode;
  if (tab === "log") {
    content = (
      <div className={LOG_GRID}>
        <LogList
          meals={await listMeals(userId, db)}
          plans={plans}
          waterGoalMl={waterGoalMl}
          readOnly
        />
      </div>
    );
  } else if (tab === "stats") {
    const [rows, weights] = await Promise.all([
      listMealTotals(userId, db),
      listWeights(userId, db),
    ]);
    content = (
      <div className={GRID}>
        <StatsView rows={rows} plans={plans} waterGoalMl={waterGoalMl} weights={weights} readOnly />
      </div>
    );
  } else if (tab === "products") {
    content = <ProductList products={await listSavedBarcodeProducts(userId, db)} readOnly />;
  } else {
    const weights = await listWeights(userId, db);
    content = (
      <Overview
        account={account}
        profile={profile}
        plans={plans}
        latestWeighIn={weights.at(-1) ?? null}
        usage={usage}
        dailyCap={dailyCap}
      />
    );
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3.5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
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

      <nav
        aria-label="Sections"
        className="grid grid-cols-4 gap-1 rounded-[16px] bg-surface p-1 lg:w-[480px]"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "overview" ? `/admin/users/${userId}` : `/admin/users/${userId}?tab=${t.id}`
            }
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex h-10 items-center justify-center rounded-[12px] text-[13px] font-bold transition-colors ${
              t.id === tab ? "bg-accent text-[#241a15]" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Water bars follow this user's setting, not the admin's */}
      <WaterTrackingProvider enabled={profile?.waterTracking ?? false}>
        {content}
      </WaterTrackingProvider>
    </main>
  );
}
