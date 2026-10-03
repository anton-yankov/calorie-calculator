import { ACTIVITY_LABELS } from "@/components/PlanPicker";
import { CapButton } from "../../CapSheet";
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
    <div className="flex justify-between gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

function planGoal(plan: StoredPlan) {
  if (plan.goal === "maintain") return "Maintain";
  const pace = plan.kgPerWeek === null ? "custom" : `${plan.kgPerWeek} kg/wk`;
  return `${GOAL_LABELS[plan.goal]} → ${plan.goalWeightKg} kg · ${pace}`;
}

/**
 * The account at a glance: body details, the last two weeks of AI use and
 * every plan it has had, plus the one thing that can change here: the cap.
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
  const total = usage.reduce((sum, u) => sum + u.used, 0);
  const today = usage.at(-1)?.used ?? 0;

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <section aria-label="Details" className="rounded-[22px] bg-surface px-4 py-1.5">
        {profile ? (
          <dl>
            <Row label="Sex" value={profile.sex === "male" ? "Male" : "Female"} />
            <Row label="Born" value={String(profile.birthYear)} />
            <Row label="Height" value={`${profile.heightCm} cm`} />
            <Row
              label="Weight"
              value={
                latestWeighIn
                  ? `${latestWeighIn.weightKg} kg · weigh-in ${longDate(latestWeighIn.day)}`
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
          <p className="py-3 text-sm text-muted">
            Hasn&apos;t finished setup yet. Joined {when(account.createdAt)}.
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-3">
        <section
          aria-label="AI analyses"
          className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15.5px] font-extrabold">AI analyses · last 14 days</h2>
            <span className="text-[12.5px] text-muted tabular-nums">total {total}</span>
          </div>
          <div
            role="img"
            aria-label={usage.map((u) => `${u.day}: ${u.used}`).join(", ")}
            className="flex h-[70px] items-end gap-1"
          >
            {usage.map((u) => (
              <span
                key={u.day}
                title={`${longDate(u.day)}: ${u.used}`}
                className={`flex-1 rounded-t-[4px] ${u.used ? "bg-accent" : "bg-line-strong"}`}
                style={{ height: u.used ? `${(u.used / peak) * 100}%` : 3 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{usage[0] ? longDate(usage[0].day) : ""}</span>
            <span>Today</span>
          </div>
          <CapButton
            userId={account.userId}
            email={account.email}
            cap={dailyCap}
            usedToday={today}
            label="Change AI cap"
          />
        </section>

        <section aria-label="Plan history" className="flex flex-col gap-2">
          <h2 className="mt-1 text-[17px] font-extrabold tracking-tight">Plan history</h2>
          {plans.length === 0 ? (
            <p className="rounded-[20px] bg-surface px-5 py-6 text-center text-sm text-muted">
              No plan yet.
            </p>
          ) : (
            <ul className="rounded-[22px] bg-surface px-4">
              {[...plans].reverse().map((plan) => (
                <li
                  key={plan.effectiveFrom}
                  className="flex justify-between gap-3 border-t border-line py-2.5 text-sm first:border-t-0"
                >
                  <span>
                    <b className="font-bold">{planGoal(plan)}</b>
                    <span className="block text-muted">
                      Since {longDate(plan.effectiveFrom)} · built at {plan.weightKg} kg,{" "}
                      {fmt(plan.maintenanceKcal)} kcal maintenance
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <b className="font-bold">{fmt(plan.calorieTarget)} kcal</b>
                    <span className="block text-muted">{plan.proteinTarget} g</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
