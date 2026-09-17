"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/loaders";
import { login } from "./actions";

const inputClass =
  "rounded-panel border border-line bg-surface px-4 py-3 text-foreground placeholder:text-muted/75 transition-colors focus:border-accent focus:outline-none";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder="Email"
        // React resets the form after every submit; this keeps the email after a failed attempt
        defaultValue={state?.email}
        className={inputClass}
      />

      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        className={inputClass}
      />

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending && <Spinner />}
        {pending ? "Logging in…" : "Log in"}
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
