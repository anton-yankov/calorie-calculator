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
  const [profile, plans] = await Promise.all([getProfile(userId, db), listPlans(userId, db)]);
  const waterGoalMl = activeWaterGoal(profile);

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
    const [weights, usage, dailyCap] = await Promise.all([
      listWeights(userId, db),
      aiUsageHistory(userId, 14),
      dailyCapOf(account),
    ]);
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
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
      <div className="flex items-center gap-3">
        <ButtonLink href="/admin" variant="outline" size="icon" aria-label="Back to users">
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </ButtonLink>
        <p className="min-w-0 break-words text-lg font-extrabold tracking-tight">{account.email}</p>
      </div>

      <p className="rounded-r-panel border-l-4 border-amber bg-surface px-4 py-2.5 text-[13px]">
        {account.userId === viewer.userId
          ? "Your own account, shown the way you see other accounts: read-only."
          : "Read-only view of this account. Only the AI cap (on the Users page) can be changed."}
      </p>

      <nav
        aria-label="Sections"
        className="flex w-fit rounded-full border border-line bg-surface p-1"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "overview" ? `/admin/users/${userId}` : `/admin/users/${userId}?tab=${t.id}`
            }
            aria-current={t.id === tab ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 ${
              t.id === tab ? "bg-accent text-background" : "text-muted hover:text-foreground"
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
