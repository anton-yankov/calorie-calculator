"use client";

import { Barcode, Camera, MessageSquareText, PencilLine } from "lucide-react";
import { useRef } from "react";
import { useAiAllowance } from "@/components/AiAllowance";

/** The AI count on the photo button: "14 of 20 AI left", "Unlimited AI", "AI paused". */
function aiLeft(cap: number | null, used: number): string {
  if (cap === null) return "Unlimited AI";
  if (cap === 0) return "AI paused";
  return `${Math.max(cap - used, 0)} of ${cap} AI left`;
}

function Square({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-[88px] flex-col items-center justify-center gap-2 rounded-[20px] bg-surface text-[13.5px] font-bold transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-muted [&:disabled_svg]:text-muted/60"
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The four ways to add food. Photo is the big button because it's used most;
 * Describe, Barcode and Manual sit under it at equal size. Once the day's AI
 * analyses are used up (or the admin paused them), Photo and Describe go grey
 * with the reason, while Barcode and Manual keep working.
 */
export function AddFood({
  onPhoto,
  onDescribe,
  onBarcode,
  onManual,
  className = "",
}: {
  onPhoto: (file: File) => void;
  onDescribe: () => void;
  onBarcode: () => void;
  onManual: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { allowance, capReached } = useAiAllowance();
  const paused = allowance?.cap === 0;
  const iconClass = "h-[22px] w-[22px] text-accent";

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPhoto(file);
          e.target.value = ""; // allow picking the same file again
        }}
      />
      <button
        type="button"
        disabled={capReached}
        onClick={() => inputRef.current?.click()}
        className="relative flex h-[150px] flex-col justify-between rounded-[26px] bg-accent p-[18px] text-left text-[#241a15] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
      >
        <span
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-[18px] ${
            capReached ? "bg-surface-raised" : "bg-black/10"
          }`}
        >
          <Camera className="h-7 w-7" strokeWidth={1.9} aria-hidden />
        </span>
        {allowance && (
          <span
            className={`absolute top-[18px] right-[18px] rounded-full px-2.5 py-1 text-xs font-bold ${
              capReached ? "bg-danger-soft text-danger" : "bg-black/10"
            }`}
          >
            {aiLeft(allowance.cap, allowance.used)}
          </span>
        )}
        <span>
          <span
            className={`block text-[21px] font-extrabold tracking-tight ${capReached ? "text-foreground" : ""}`}
          >
            {paused
              ? "AI is paused for your account"
              : capReached
                ? "AI analyses used up for today"
                : "Snap your meal"}
          </span>
          <span className="text-[13px] opacity-75">
            {paused
              ? "Ask the admin to turn it back on"
              : capReached
                ? "They reset at midnight"
                : "Take or choose a photo"}
          </span>
        </span>
      </button>
      <div className="grid grid-cols-3 gap-2.5">
        <Square
          icon={<MessageSquareText className={iconClass} strokeWidth={1.9} aria-hidden />}
          label="Describe"
          disabled={capReached}
          onClick={onDescribe}
        />
        <Square
          icon={<Barcode className={iconClass} strokeWidth={1.9} aria-hidden />}
          label="Barcode"
          onClick={onBarcode}
        />
        <Square
          icon={<PencilLine className={iconClass} strokeWidth={1.9} aria-hidden />}
          label="Manual"
          onClick={onManual}
        />
      </div>
      {capReached && (
        <p className="text-[12.5px] text-muted">
          Barcode and Manual still work, they don&apos;t use AI.
        </p>
      )}
    </div>
  );
}
