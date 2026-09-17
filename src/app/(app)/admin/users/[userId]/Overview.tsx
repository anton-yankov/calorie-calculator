import { ACTIVITY_LABELS } from "@/components/PlanPicker";
import type { Account } from "@/lib/admin";
import { longDate } from "@/lib/day";
import type { StoredPlan } from "@/lib/plan-history";
import type { Profile } from "@/lib/profiles";
import { formatWater } from "@/lib/water";
import type { WeightEntry } from "@/lib/weights";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const GOAL_LABELS = { lose: "Lose", maintain: "Maintain", gain: "Gain" } as const;
/** A login time in Sofia time — this renders on the server, which runs in UTC */
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Europe/Sofia",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function planGoal(plan: StoredPlan) {
  if (plan.goal === "maintain") return "Maintain";
  const pace = plan.kgPerWeek === null ? "custom" : `${plan.kgPerWeek} kg/wk`;
  return `${GOAL_LABELS[plan.goal]} → ${plan.goalWeightKg} kg · ${pace}`;
}

/**
 * The account at a glance: body details, every plan it has had and the last
 * two weeks of AI use. A server component: it only displays.
 */
export function Overview({
  account,
  profile,
  plans,
  latestWeighIn,
  usage,
  dailyCap,
}: {
  account: Account;
  profile: Profile | null;
  plans: StoredPlan[];
  latestWeighIn: WeightEntry | null;
  usage: { day: string; used: number }[];
  /** null = no cap (admin) */
  dailyCap: number | null;
}) {
  const peak = Math.max(1, ...usage.map((u) => u.used), dailyCap ?? 0);
  const today = usage.at(-1)?.used ?? 0;
  const total = usage.reduce((sum, u) => sum + u.used, 0);

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-x-10">
      <div className="flex flex-col gap-4">
        <section className="rounded-panel border border-line bg-surface px-4 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Details
          </h2>
          {profile ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <Row label="Sex" value={profile.sex === "male" ? "Male" : "Female"} />
              <Row label="Born" value={String(profile.birthYear)} />
              <Row label="Height" value={`${profile.heightCm} cm`} />
              <Row
                label="Weight"
                value={
                  latestWeighIn
                    ? `${latestWeighIn.weightKg} kg (weigh-in ${longDate(latestWeighIn.day)})`
                    : `${profile.weightKg} kg`
                }
              />
              <Row label="Activity" value={ACTIVITY_LABELS[profile.activityLevel]} />
              <Row
                label="Water"
                value={
                  profile.waterTracking && profile.waterGoalMl
                    ? `On · ${formatWater(profile.waterGoalMl)}`
                    : "Off"
                }
              />
              <Row label="Joined" value={when(account.createdAt)} />
              <Row label="Last login" value={when(account.lastSignInAt)} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Hasn&apos;t finished setup yet. Joined {when(account.createdAt)}.
            </p>
          )}
        </section>

        <section className="rounded-panel border border-line bg-surface px-4 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            AI analyses · last 14 days
          </h2>
          <div
            role="img"
            aria-label={usage.map((u) => `${u.day}: ${u.used}`).join(", ")}
            className="mt-3 flex h-16 items-end gap-1"
          >
            {usage.map((u) => (
              <span
                key={u.day}
                title={`${longDate(u.day)}: ${u.used}`}
                className="flex-1 rounded-t-sm bg-accent"
                style={{ height: `${(u.used / peak) * 100}%`, minHeight: u.used ? 2 : 0 }}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Today {today}
            {dailyCap === null ? " · no cap" : ` of ${dailyCap}`} · 14-day total {total}
          </p>
        </section>
      </div>

      <section className="overflow-x-auto rounded-panel border border-line bg-surface">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-raised text-left text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="px-4 py-2.5 font-semibold">Plan from</th>
              <th className="px-3 py-2.5 font-semibold">Goal</th>
              <th className="px-3 py-2.5 font-semibold">Targets</th>
              <th className="px-4 py-2.5 font-semibold">Built at</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-muted">
                  No plan yet.
                </td>
              </tr>
            ) : (
              [...plans].reverse().map((plan) => (
                <tr key={plan.effectiveFrom} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2.5">{longDate(plan.effectiveFrom)}</td>
                  <td className="px-3 py-2.5">{planGoal(plan)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                    {fmt(plan.calorieTarget)} kcal · {plan.proteinTarget} g
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {plan.weightKg} kg · {fmt(plan.maintenanceKcal)} kcal maint.
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
