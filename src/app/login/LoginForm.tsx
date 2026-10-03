"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { login } from "./actions";

const fieldClass = (invalid: boolean) =>
  `h-12 w-full rounded-panel border-[1.5px] bg-background px-4 text-[15px] text-foreground placeholder:text-muted/75 transition-colors focus:border-accent focus:outline-none ${
    invalid ? "border-danger" : "border-line"
  }`;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const invalid = Boolean(state?.error);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3.5">
      {/* Above the fields, where the eye goes first after pressing Log in */}
      <div aria-live="polite">
        {state?.error && (
          <p className="flex items-start gap-2.5 rounded-panel bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
            <TriangleAlert
              className="mt-px h-[18px] w-[18px] shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            {state.error}
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          aria-invalid={invalid || undefined}
          // React resets the form after every submit; this keeps the email after a failed attempt
          defaultValue={state?.email}
          className={fieldClass(invalid)}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={invalid || undefined}
          className={fieldClass(invalid)}
        />
      </label>

      <Button type="submit" pending={pending} className="mt-1 w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-[13px] text-muted lg:text-left">
        Accounts are invite-only. Ask the person who invited you if you&apos;ve forgotten your
        password.
      </p>
    </form>
  );
}
