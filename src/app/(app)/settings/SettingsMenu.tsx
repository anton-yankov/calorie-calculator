"use client";

import {
  ChevronRight,
  Droplet,
  History,
  LockKeyhole,
  LogOut,
  PersonStanding,
  Scale,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/Button";
import { Choice, Field } from "@/components/fields";
import { ACTIVITY_LABELS } from "@/components/PlanPicker";
import { Sheet } from "@/components/Sheet";
import { addDays, longDate } from "@/lib/day";
import { isReminderDays, REMINDER_DAYS, type WeighInReminderDays } from "@/lib/reminder";
import { formatWater } from "@/lib/water";
import { changePasswordAction, saveReminderAction, saveWaterAction } from "./actions";
import type { SettingsData } from "./load";
import { PlanCard, planTitle } from "./PlanCard";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** About 35 ml per kg: a common rule of thumb, and only a starting point. */
const suggestedWaterGoal = (weightKg: number) => Math.round((weightKg * 35) / 50) * 50;

const REMINDER_TEXT: Record<WeighInReminderDays, { label: string; hint: string }> = {
  1: { label: "Every day", hint: "For daily weighers; the trend smooths out the noise" },
  3: { label: "Every 3 days", hint: "A few times a week" },
  7: { label: "Every 7 days", hint: "Recommended: once a week is enough for a reliable trend" },
  14: { label: "Every 14 days", hint: "Every other week" },
  0: { label: "Off", hint: "No reminder on Home" },
};

const rowClass = (selected = false) =>
  `flex min-h-[60px] w-full items-center gap-3 border-t border-line px-3.5 py-2 text-left first:border-t-0 transition-colors ${
    selected ? "bg-surface-raised" : "hover:bg-surface-raised/60"
  }`;

function RowBody({
  icon,
  title,
  sub,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <>
      <span
        aria-hidden
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] ${
          danger ? "bg-danger-soft text-danger" : "bg-surface-raised text-accent"
        }`}
      >
        {icon}
      </span>
      <span className={`min-w-0 flex-1 text-[15px] font-bold ${danger ? "text-danger" : ""}`}>
        {title}
        <span className="block truncate text-[12.5px] font-normal text-muted">{sub}</span>
      </span>
    </>
  );
}

const chevron = (
  <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
);
const iconClass = "h-5 w-5";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h2 className="px-1 text-[13px] font-bold text-muted">{title}</h2>
      <div className="overflow-hidden rounded-[20px] bg-surface">{children}</div>
    </section>
  );
}

/** The water switch in the list, with the goal field under it while it's on. */
function WaterSetting({ data }: { data: SettingsData }) {
  const { profile } = data;
  const [on, setOn] = useState(profile.waterTracking);
  const [goal, setGoal] = useState(
    String(profile.waterGoalMl ?? suggestedWaterGoal(profile.weightKg)),
  );
  const [savedGoal, setSavedGoal] = useState(profile.waterGoalMl);
  const [pending, startTransition] = useTransition();

  function save(tracking: boolean, goalMl: number | null, message: string) {
    startTransition(async () => {
      const result = await saveWaterAction({ tracking, goalMl });
      if (result.error) {
        toast.error(result.error);
        setOn(profile.waterTracking);
        return;
      }
      setSavedGoal(goalMl);
      toast.success(message);
    });
  }

  function toggle() {
    const next = !on;
    setOn(next);
    // Turning tracking off keeps the stored goal for next time
    save(next, Math.round(Number(goal)) || null, next ? "Water tracking on" : "Water tracking off");
  }

  // No Save button: a single number saves as soon as you leave the field
  function saveGoal() {
    const goalMl = Math.round(Number(goal));
    if (!on || goalMl === savedGoal) return;
    save(true, goalMl, "Water goal saved");
  }

  return (
    <div className="border-t border-line">
      <div className="flex min-h-[60px] items-center gap-3 px-3.5 py-2">
        <RowBody
          icon={<Droplet className={iconClass} strokeWidth={2} />}
          title="Track water"
          sub={on ? `On · goal ${formatWater(Math.round(Number(goal)) || 0)}` : "Off"}
        />
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Track water"
          disabled={pending}
          onClick={toggle}
          className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-success" : "bg-line-strong"
          }`}
        >
          <span
            className={`absolute top-[3px] h-[26px] w-[26px] rounded-full transition-all ${
              on ? "left-[23px] bg-[#10241d]" : "left-[3px] bg-muted"
            }`}
          />
        </button>
      </div>
      {on && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5" onBlur={saveGoal}>
          <Field label="Daily water goal" unit="ml" value={goal} onChange={setGoal} />
          <p className="text-xs text-muted">All drinks count. Saved when you leave the field.</p>
        </div>
      )}
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, startTransition] = useTransition();
  function submit() {
    startTransition(async () => {
      const result = await changePasswordAction(current, next);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Password changed");
        onDone();
      }
    });
  }
  return (
    <>
      <Field
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        inputMode="text"
      />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        inputMode="text"
      />
      <p className="text-xs text-muted">
        At least 8 characters. You stay logged in on this device.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          pending={pending}
          disabled={current === "" || next === ""}
          onClick={submit}
        >
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </>
  );
}

/**
 * The Settings list: the plan on top (phones), then short groups of rows that
 * each show their current value. Body details and Change plan open as their
 * own screens; the small things open as sheets right here.
 */
export function SettingsMenu({ data }: { data: SettingsData }) {
  const { profile, plans, email, isAdmin } = data;
  const pathname = usePathname();
  const active = plans.at(-1)!;
  const [sheet, setSheet] = useState<"reminder" | "password" | "history" | null>(null);
  const [reminder, setReminder] = useState(profile.weighInReminderDays);
  const [savingReminder, startReminder] = useTransition();

  // The homepage's "Change how often…" links here with ?open=reminder
  const requested = useSearchParams().get("open");
  const [handled, setHandled] = useState(false);
  if (requested === "reminder" && !handled) {
    setHandled(true);
    setSheet("reminder");
  }

  function chooseReminder(days: number) {
    if (!isReminderDays(days)) return;
    setReminder(days);
    startReminder(async () => {
      const result = await saveReminderAction(days);
      if (result.error) {
        toast.error(result.error);
        setReminder(profile.weighInReminderDays);
        return;
      }
      toast.success(
        days === 0
          ? "Weigh-in reminder off"
          : `Reminder: ${REMINDER_TEXT[days].label.toLowerCase()}`,
      );
      setSheet(null);
    });
  }

  const age = new Date().getFullYear() - profile.birthYear;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="lg:hidden">
        <PlanCard plan={active} />
      </div>

      <Group title="You">
        <Link href="/settings/details" className={rowClass(pathname === "/settings/details")}>
          <RowBody
            icon={<PersonStanding className={iconClass} strokeWidth={2} />}
            title="Body details"
            sub={`${profile.sex === "male" ? "Male" : "Female"} · ${age} · ${profile.heightCm} cm · ${data.latestWeighIn?.weightKg ?? profile.weightKg} kg · ${ACTIVITY_LABELS[profile.activityLevel].toLowerCase()}`}
          />
          {chevron}
        </Link>
        <button type="button" onClick={() => setSheet("history")} className={rowClass()}>
          <RowBody
            icon={<History className={iconClass} strokeWidth={2} />}
            title="Plan history"
            sub={`${plans.length} ${plans.length === 1 ? "plan" : "plans"} since ${longDate(plans[0]!.effectiveFrom)}`}
          />
          {chevron}
        </button>
      </Group>

      <Group title="Tracking">
        <button type="button" onClick={() => setSheet("reminder")} className={rowClass()}>
          <RowBody
            icon={<Scale className={iconClass} strokeWidth={2} />}
            title="Weigh-in reminder"
            sub={REMINDER_TEXT[reminder].label}
          />
          {chevron}
        </button>
        <WaterSetting data={data} />
      </Group>

      <Group title="Account">
        <button type="button" onClick={() => setSheet("password")} className={rowClass()}>
          <RowBody
            icon={<LockKeyhole className={iconClass} strokeWidth={2} />}
            title="Change password"
            sub={email}
          />
          {chevron}
        </button>
        <form action={logout} className="border-t border-line">
          <button type="submit" className={`${rowClass()} border-t-0`}>
            <RowBody
              icon={<LogOut className={iconClass} strokeWidth={2} />}
              title="Log out"
              sub="On this device"
              danger
            />
          </button>
        </form>
      </Group>

      {isAdmin && (
        <Group title="Admin">
          <Link href="/admin" className={rowClass()}>
            <RowBody
              icon={<UsersRound className={iconClass} strokeWidth={2} />}
              title="Users and AI caps"
              sub="Everyone's plans, activity and AI use"
            />
            {chevron}
          </Link>
        </Group>
      )}

      <Sheet open={sheet === "reminder"} onClose={() => setSheet(null)} title="Weigh-in reminder">
        <p className="-mt-1.5 text-[13.5px] text-muted">
          The card on Home appears when your last weigh-in is older than this.
        </p>
        {REMINDER_DAYS.map((days) => (
          <Choice
            key={days}
            selected={reminder === days}
            label={REMINDER_TEXT[days].label}
            hint={REMINDER_TEXT[days].hint}
            onSelect={() => {
              if (!savingReminder) chooseReminder(days);
            }}
          />
        ))}
      </Sheet>

      <Sheet open={sheet === "password"} onClose={() => setSheet(null)} title="Change password">
        {sheet === "password" && <PasswordForm onDone={() => setSheet(null)} />}
      </Sheet>

      <Sheet open={sheet === "history"} onClose={() => setSheet(null)} title="Plan history">
        <ul>
          {[...plans].reverse().map((plan, i, newestFirst) => {
            const next = newestFirst[i - 1];
            return (
              <li
                key={plan.effectiveFrom}
                className="flex justify-between gap-3 border-t border-line py-2.5 text-sm first:border-t-0"
              >
                <span>
                  <b className="font-bold">{planTitle(plan)}</b>
                  <span className="block text-muted">
                    {next
                      ? `${longDate(plan.effectiveFrom)} – ${longDate(addDays(next.effectiveFrom, -1))}`
                      : `Since ${longDate(plan.effectiveFrom)} · current`}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <b className="font-bold">{fmt(plan.calorieTarget)} kcal</b>
                  <span className="block text-muted">{plan.proteinTarget} g</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          Each day in your Log and Stats is judged by the plan it was logged under.
        </p>
      </Sheet>
    </div>
  );
}
