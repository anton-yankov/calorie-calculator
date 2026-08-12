"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnalysisCard, CompactAnalysis } from "@/components/AnalysisCard";
import { useAnalysis } from "@/components/AnalysisProvider";
import { CorrectionBar } from "@/components/CorrectionBar";
import { SkeletonEstimate, Spinner } from "@/components/loaders";
import { PhotoInput } from "@/components/PhotoInput";

function CorrectionBubble({ text }: { text: string }) {
  return (
    <div className="self-end max-w-[85%] rounded-panel rounded-br-sm border border-success/40 bg-success-soft px-4 py-2.5 text-sm text-foreground">
      {text}
    </div>
  );
}

export default function Home() {
  // All analysis state lives in AnalysisProvider (mounted in the layout) so it
  // survives navigating away from this page mid-analysis
  const {
    sourceBlob,
    preparing,
    previewUrl,
    description,
    setDescription,
    history,
    pendingCorrection,
    loading,
    error,
    loggedAtLength,
    latest,
    handleSelect,
    handleClear,
    handleLog,
    analyze,
    handleGramsChange,
  } = useAnalysis();

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history.length > 1 || pendingCorrection) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [history.length, pendingCorrection]);

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-5 py-8 sm:px-6 sm:py-11">
      <header className="mb-2 border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Meal analysis
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          What’s on your plate?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted sm:text-base">
          Photo in, macros out. Estimates — correct them below.
        </p>
      </header>

      <PhotoInput
        previewUrl={previewUrl}
        disabled={loading || preparing}
        preparing={preparing}
        compact={history.length > 0}
        onSelect={(f) => void handleSelect(f)}
        onClear={handleClear}
      />

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional details — e.g. rye bread, whole milk, olive oil"
        className="rounded-panel border border-line bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/75 transition-colors focus:border-accent focus:outline-none"
      />

      <button
        type="button"
        disabled={!sourceBlob || loading || preparing}
        onClick={() => analyze()}
        className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {/* During photo prep the frame overlay is the loader — the button stays plain */}
        {loading && <Spinner />}
        {loading ? "Analyzing…" : latest ? "Start over with this photo" : "Analyze"}
      </button>

      {error && (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {history.map((entry, idx) => {
        const isLatest = idx === history.length - 1;
        const previous = idx > 0 ? (history[idx - 1]?.analysis ?? null) : null;
        const label = history.length > 1 ? `Estimate ${idx + 1}` : "Estimate";
        return (
          <div key={idx} className="flex flex-col gap-3">
            {entry.correction && <CorrectionBubble text={entry.correction} />}
            {isLatest ? (
              <AnalysisCard
                analysis={entry.analysis}
                previous={previous}
                label={label}
                disabled={loading}
                onGramsChange={handleGramsChange}
              />
            ) : (
              <CompactAnalysis analysis={entry.analysis} label={label} />
            )}
          </div>
        );
      })}

      {loading && !pendingCorrection && <SkeletonEstimate label="Estimate" />}

      {pendingCorrection && (
        <>
          <CorrectionBubble text={pendingCorrection} />
          <SkeletonEstimate label={`Estimate ${history.length + 1}`} />
        </>
      )}

      {latest && !pendingCorrection && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || loggedAtLength === history.length}
              onClick={() => void handleLog()}
              className="flex-1 rounded-panel border border-success px-4 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success-soft disabled:border-line disabled:text-muted"
            >
              {loggedAtLength === history.length ? "Logged ✓" : "Log meal"}
            </button>
            {loggedAtLength === history.length && (
              <Link
                href="/log"
                className="shrink-0 rounded-panel bg-success px-4 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
              >
                View log
              </Link>
            )}
          </div>
          <CorrectionBar
            disabled={loading}
            loading={loading}
            onSubmit={(correction) => analyze(correction)}
          />
          <p className="text-center text-xs text-muted">
            Edit grams for instant recalculation, or describe what’s wrong to re-analyze.
          </p>
        </>
      )}

      <div ref={threadEndRef} />
    </main>
  );
}
