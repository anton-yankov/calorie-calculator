import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/Button";

/** Unknown addresses, and pages that call notFound() (e.g. /admin for everyone but the admin). */
export default function NotFound() {
  return (
    <main className="page-enter mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-3 px-6 pt-16 pb-24 text-center lg:justify-center lg:pt-0">
      <span className="flex h-18 w-18 items-center justify-center rounded-[24px] bg-surface text-accent">
        <Compass className="h-9 w-9" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">This page doesn&apos;t exist</h2>
      <p className="text-[15px] text-muted">The link may be old or mistyped.</p>
      <ButtonLink href="/" className="mt-2 w-full">
        Go to Home
      </ButtonLink>
    </main>
  );
}
