import type { Metadata } from "next";
import { loadSettings } from "./load";
import { PlanCard } from "./PlanCard";
import { SettingsMenu } from "./SettingsMenu";
import { SettingsShell } from "./SettingsShell";

export const metadata: Metadata = {
  title: "Settings — Calorie Calculator",
  description: "Your plan, your details, reminders, water tracking and your account.",
};

export default async function SettingsPage() {
  const data = await loadSettings();
  const active = data.plans.at(-1)!;
  return (
    <SettingsShell menu={<SettingsMenu data={data} />} planCard={<PlanCard plan={active} />}>
      {/* Desktop only: the right side before a section is picked */}
      <p className="rounded-[20px] bg-surface px-5 py-6 text-center text-sm text-muted">
        Pick a section on the left to change it.
      </p>
    </SettingsShell>
  );
}
