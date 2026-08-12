"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/loaders";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        placeholder="Password"
        className="rounded-panel border border-line bg-surface px-4 py-3 text-foreground placeholder:text-muted/75 transition-colors focus:border-accent focus:outline-none"
      />

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending && <Spinner />}
        {pending ? "Checking…" : "Unlock"}
      </button>

      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {state?.error && (
          <span className="block rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3">
            {state.error}
          </span>
        )}
      </p>
    </form>
  );
}
