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
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
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
