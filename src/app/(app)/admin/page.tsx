import type { Metadata } from "next";
import { listAccounts, requireAdmin, type AccountSummary } from "@/lib/admin";
import { AdminUsers } from "./AdminUsers";

export const metadata: Metadata = { title: "Users — Calorie Calculator" };

/** Admin only: every account, its plan, activity and today's AI use, with an editable cap. */
export default async function AdminPage() {
  const viewer = await requireAdmin();

  let accounts: AccountSummary[] = [];
  let loadError: string | null = null;
  try {
    accounts = await listAccounts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load the accounts.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:max-w-5xl">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Admin</p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Users
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Everyone&apos;s plan, activity and AI use. Only the daily cap can be changed here.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {loadError}
        </p>
      ) : (
        <AdminUsers accounts={accounts} viewerId={viewer.userId} />
      )}
    </main>
  );
}
