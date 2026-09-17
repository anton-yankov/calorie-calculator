"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page (or the (app) layout above it) fails to render, usually
 * because the database couldn't be reached. In production the message is a
 * generic one, so nothing sensitive reaches the browser; the digest matches the
 * server log entry.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16 text-center sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-danger">
        Something went wrong
      </p>
      <h1 className="font-serif text-[clamp(1.9rem,7vw,2.5rem)] font-semibold leading-[1.08] tracking-tight">
        This page didn&apos;t load
      </h1>
      <p className="text-[15px] text-muted">
        Usually a connection hiccup. Your logged meals are safe — try again in a moment.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-panel bg-accent px-5 py-3 font-semibold text-background transition hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-panel border border-line px-5 py-3 font-semibold transition hover:border-muted/60"
        >
          Go to Analyze
        </Link>
      </div>
      {error.digest && (
        <p className="font-mono text-[11px] text-muted">Reference: {error.digest}</p>
      )}
    </main>
  );
}
