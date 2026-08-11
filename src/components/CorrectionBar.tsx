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
      className="flex gap-2"
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
        className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {loading && <Spinner />}
        Re-analyze
      </button>
    </form>
  );
}
