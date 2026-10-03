import { Check, Info } from "lucide-react";

const TONES = {
  success: { bg: "bg-success", mark: <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> },
  info: { bg: "bg-tint-lose", mark: <Info className="h-3 w-3" strokeWidth={3.5} aria-hidden /> },
  // The "!" from the mock; lucide has no bare exclamation mark
  error: { bg: "bg-danger", mark: <span className="text-[13px] font-black leading-none">!</span> },
} as const;

/**
 * The filled circle at the start of a toast. Fixed size and no shrinking, so it
 * stays a circle even when the message wraps onto two lines.
 */
export function ToastMark({ tone }: { tone: keyof typeof TONES }) {
  const { bg, mark } = TONES[tone];
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-background ${bg}`}
    >
      {mark}
    </span>
  );
}
