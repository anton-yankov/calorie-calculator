import type { Metadata } from "next";
import Image from "next/image";
import { Camera } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in — Calorie Calculator",
  description: "Log in to use the calorie tracker.",
};

const TAGLINE =
  "Snap a meal, see your calories and protein. Track your days against your own plan.";

/**
 * The first screen anyone sees. Phones: the app icon, name, one line about
 * the app and the form. Desktop: split in two, a preview of the app on the
 * left (decorative only) and the form on the right.
 */
export default function LoginPage() {
  return (
    <main className="page-enter flex flex-1 flex-col lg:grid lg:grid-cols-2">
      <section
        aria-hidden
        className="hidden flex-col justify-between bg-surface bg-[radial-gradient(circle_at_30%_30%,rgba(244,167,122,0.2),transparent_55%)] p-12 lg:flex"
      >
        <div className="flex items-center gap-3.5">
          <Image src="/icon-192.png" alt="" width={52} height={52} className="rounded-[14px]" />
          <span className="text-2xl font-extrabold tracking-tight">Calories</span>
        </div>
        <div className="flex max-w-sm flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["Calories", "910", "left", "48%"],
              ["Protein", "42 g", "to go", "56%"],
            ].map(([label, value, unit, width]) => (
              <div key={label} className="rounded-[20px] bg-background/60 p-3.5">
                <span className="text-[12.5px] text-muted">{label}</span>
                <span className="block text-[26px] leading-tight font-extrabold tracking-tight">
                  {value} <span className="text-[13px] font-medium text-muted">{unit}</span>
                </span>
                <span className="mt-2.5 block h-1.5 rounded-full bg-line-strong">
                  <span className="block h-full rounded-full bg-tint-lose" style={{ width }} />
                </span>
              </div>
            ))}
          </div>
          <div className="flex h-28 flex-col justify-between rounded-[26px] bg-accent p-4 text-[#241a15]">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-black/10">
              <Camera className="h-7 w-7" strokeWidth={1.9} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">Snap your meal</span>
          </div>
        </div>
        <p className="max-w-sm text-[15px] text-muted">{TAGLINE}</p>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3.5 px-6 pt-[calc(env(safe-area-inset-top)+3rem)] pb-16 lg:max-w-lg lg:px-16">
        <Image
          src="/icon-192.png"
          alt=""
          width={72}
          height={72}
          className="rounded-[22px] lg:hidden"
          priority
        />
        <h1 className="mt-2 text-[34px] leading-tight font-extrabold tracking-tight">
          <span className="lg:hidden">Calories</span>
          <span className="hidden lg:inline">Log in</span>
        </h1>
        <p className="text-[15.5px] text-muted lg:hidden">{TAGLINE}</p>
        <LoginForm />
      </section>
    </main>
  );
}
