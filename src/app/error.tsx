"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/Button";

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
    <main className="page-enter mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-3 px-6 pt-16 pb-24 text-center lg:justify-center lg:pt-0">
      <span className="flex h-18 w-18 items-center justify-center rounded-[24px] bg-danger-soft text-danger">
        <TriangleAlert className="h-9 w-9" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">This page didn&apos;t load</h2>
      <p className="text-[15px] text-muted">
        Usually a connection hiccup. Your logged meals are safe, so try again in a moment.
      </p>
      <Button onClick={() => retry()} className="mt-2 w-full">
        Try again
      </Button>
      <ButtonLink href="/" variant="outline" className="w-full">
        Go to Home
      </ButtonLink>
      {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
    </main>
  );
}
