"use client";

import { useState } from "react";
import { Spinner } from "@/components/loaders";

interface CorrectionBarProps {
  disabled: boolean;
  /** An analysis is running — shows the spinner in the submit button */
  loading: boolean;
  onSubmit: (correction: string) => void;
}

export function CorrectionBar({ disabled, loading, onSubmit }: CorrectionBarProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const correction = text.trim();
        if (!correction) return;
        onSubmit(correction);
        setText("");
      }}
    >
      <input
        type="text"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Correct it — e.g. "that’s rye bread, and you missed the butter"'}
        className="min-w-0 flex-1 rounded-panel border border-line bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-placeholder transition-colors hover:border-muted/30 focus:border-focus focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="flex shrink-0 items-center justify-center gap-2 rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-40"
      >
        {loading && <Spinner />}
        Re-analyze
      </button>
    </form>
  );
}
