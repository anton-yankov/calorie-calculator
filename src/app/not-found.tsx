import Link from "next/link";

/** Unknown addresses, and pages that call notFound() (e.g. /admin for everyone but the admin). */
export default function NotFound() {
  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16 text-center sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="font-serif text-[clamp(1.9rem,7vw,2.5rem)] font-semibold leading-[1.08] tracking-tight">
        Nothing here
      </h1>
      <p className="text-[15px] text-muted">That page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mx-auto mt-2 rounded-panel bg-accent px-5 py-3 font-semibold text-background transition hover:brightness-110"
      >
        Go to Analyze
      </Link>
    </main>
  );
}
