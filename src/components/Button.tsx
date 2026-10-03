import Link from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "@/components/loaders";

/**
 * The button rules from the redesign: one filled primary action per screen,
 * tinted secondary, outlined everyday actions, red-tinted destructive ones.
 * Every size is at least 44px tall, so nothing is too small to tap.
 */
type Variant = "primary" | "secondary" | "outline" | "destructive";
/** md 48px for main actions, sm 44px inside cards, icon a 44px square (e.g. ⋯) */
type Size = "md" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-background hover:brightness-110",
  secondary: "bg-surface-raised text-accent hover:brightness-110",
  outline: "border-[1.5px] border-line-strong text-foreground hover:border-muted/60",
  destructive: "bg-danger-soft text-danger hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  md: "h-12 px-5 text-[15px]",
  sm: "h-11 px-4 text-sm",
  icon: "h-11 w-11 shrink-0",
};

function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-panel font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  pending = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks presses while the action runs */
  pending?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

/** A link that looks like a button, for actions that go to another page. */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
