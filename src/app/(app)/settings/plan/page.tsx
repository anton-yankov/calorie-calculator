import type { Metadata } from "next";
import { BackToSettings } from "../BackToSettings";
import { loadSettings } from "../load";
import { PlanCard } from "../PlanCard";
import { SettingsMenu } from "../SettingsMenu";
import { SettingsShell } from "../SettingsShell";
import { ChangePlanForm } from "./ChangePlanForm";

export const metadata: Metadata = { title: "Change plan — Calorie Calculator" };

export default async function ChangePlanPage() {
  const data = await loadSettings();
  const active = data.plans.at(-1)!;
  return (
    <SettingsShell menu={<SettingsMenu data={data} />} planCard={<PlanCard plan={active} />}>
      <BackToSettings />
      <ChangePlanForm profile={data.profile} active={active} />
    </SettingsShell>
  );
}
