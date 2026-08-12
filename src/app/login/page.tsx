import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Unlock — Calorie Calculator",
  description: "Enter the password to use the calorie tracker.",
};

export default function LoginPage() {
  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 pb-24 pt-10 sm:px-6">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Private kitchen
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.7rem)] font-semibold leading-[1.08] tracking-tight">
          What’s the password?
        </h1>
        <p className="mt-2 text-[15px] text-muted sm:text-base">
          Analyses run on the owner’s AI credits, so the tracker is invite-only. Enter the password
          once and this device stays unlocked.
        </p>
      </header>

      <LoginForm />
    </main>
  );
}
