import { ChevronLeft } from "lucide-react";
import { ButtonLink } from "@/components/Button";

/** Phones only: back from a section to the Settings list (desktop keeps the list beside it). */
export function BackToSettings() {
  return (
    <ButtonLink href="/settings" variant="outline" size="sm" className="self-start lg:hidden">
      <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
      Settings
    </ButtonLink>
  );
}
