"use client";

import { RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAiAllowance } from "@/components/AiAllowance";
import { useAnalysis } from "@/components/AnalysisProvider";
import { Button } from "@/components/Button";
import { useLightbox } from "@/components/ImageLightbox";
import { Spinner } from "@/components/loaders";
import { useWaterTracking } from "@/components/WaterTracking";

/**
 * The cards that take Add food's place while a meal is being put together:
 * writing it (with or without a photo), waiting for the AI, a failed attempt,
 * and the correction box under an estimate. The estimate itself is in
 * EstimateCard.tsx.
 */

/** The meal photo, small, tap for full size. */
export function MealPhoto({ height = "h-[90px]" }: { height?: string }) {
  const { previewUrl } = useAnalysis();
  const { open } = useLightbox();
  if (!previewUrl) return null;
  return (
    <button
      type="button"
      onClick={() => open({ src: previewUrl, alt: "Your meal, full size" })}
      aria-label="View photo"
      className={`block w-full overflow-hidden rounded-[18px] ${height}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image doesn't apply */}
      <img src={previewUrl} alt="Your meal" className="h-full w-full object-cover" />
    </button>
  );
}

const cardClass = "flex flex-col gap-3 rounded-[22px] bg-surface p-4";

function CardHeader({ title, sub, onClose }: { title: string; sub: string; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
        <p className="text-[13px] text-muted">{sub}</p>
      </div>
      {onClose && (
        <Button
          variant="outline"
          size="icon"
          aria-label="Close"
          onClick={onClose}
          className="-mt-1 -mr-1"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * Writing the meal: a description, a photo, or both. Opens from Describe
 * (keyboard up) or right after a photo is picked. ✕ throws the meal away.
 */
export function ComposeCard({ onClose }: { onClose: () => void }) {
  const waterTracking = useWaterTracking();
  const { allowance, capReached } = useAiAllowance();
  const { previewUrl, preparing, description, setDescription, handleSelect, analyze, error } =
    useAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);
  const empty = !previewUrl && !description.trim();
  const left =
    allowance && allowance.cap !== null && allowance.cap > 0
      ? Math.max(allowance.cap - allowance.used, 0)
      : null;

  return (
    <section aria-label="Your meal" className={cardClass}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleSelect(file);
          e.target.value = "";
        }}
      />
      <CardHeader
        title={previewUrl ? "Your meal" : "Describe your meal"}
        sub={
          previewUrl
            ? "Add details if you like: what's in it, how much"
            : "Amounts help: “2 eggs”, “a large plate”"
        }
        onClose={onClose}
      />
      {error && (
        <p
          role="alert"
          className="rounded-panel bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      )}
      {preparing && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Preparing photo…
        </p>
      )}
      {previewUrl && (
        <div className="relative">
          <MealPhoto height="h-[150px]" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="absolute top-2.5 right-2.5 h-9 border-0 bg-background/85 backdrop-blur"
          >
            Change
          </Button>
        </div>
      )}
      <textarea
        value={description}
        autoFocus={!previewUrl}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter starts a new line
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!empty && !preparing) void analyze();
          }
        }}
        rows={3}
        aria-label="Food or drink description"
        placeholder={`e.g. 2 eggs, toast with butter, coffee with milk${waterTracking ? ", or water 500" : ""}`}
        className="min-h-[92px] w-full resize-none rounded-[16px] border-[1.5px] border-line bg-background px-3.5 py-3 text-[15.5px] leading-snug text-foreground placeholder:text-muted/75 focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        {!previewUrl && (
          <Button
            variant="secondary"
            size="sm"
            disabled={capReached || preparing}
            onClick={() => inputRef.current?.click()}
          >
            Add photo
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1"
          disabled={empty || preparing || (capReached && previewUrl !== null)}
          onClick={() => void analyze()}
        >
          Analyze
        </Button>
      </div>
      <p className="text-center text-[12.5px] text-muted">
        {left !== null
          ? `Uses 1 of your ${left} AI ${left === 1 ? "analysis" : "analyses"} left today`
          : waterTracking
            ? "Water 500 = 500 ml · water 1 = 1 L"
            : "The AI estimates the calories and protein"}
      </p>
    </section>
  );
}

/** Ticks once a second from `since`, for the analyzing card's counter. */
function useSeconds(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

/** Past this many seconds the line under the counter says it's taking longer. */
const SLOW_AFTER_S = 30;

/**
 * Waiting for the AI: a live seconds counter from the moment Analyze was
 * tapped, and a bar that only shows work is happening. The analysis lives in
 * the layout, so leaving the page doesn't lose it.
 */
export function AnalyzingCard() {
  const { loadingSince, pendingCorrection } = useAnalysis();
  const seconds = useSeconds(loadingSince);
  return (
    <section role="status" aria-label="Analyzing" className={cardClass}>
      <MealPhoto />
      <div className="flex items-center gap-3.5">
        <span className="text-[40px] leading-none font-extrabold tracking-tight tabular-nums">
          {seconds}
          <span className="ml-0.5 text-base font-semibold tracking-normal text-muted">s</span>
        </span>
        <span className="text-[13.5px] leading-snug text-muted">
          <b className="block text-[15.5px] text-foreground">
            {pendingCorrection ? "Re-analyzing with your correction…" : "Analyzing your meal…"}
          </b>
          {seconds < SLOW_AFTER_S
            ? "Identifying the foods and portions"
            : "Taking longer than usual. Still working."}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-line-strong">
        <span className="indeterminate" />
      </div>
      <div aria-hidden className="flex flex-col gap-2.5">
        {["w-[70%]", "w-[55%]", "w-[62%]"].map((w) => (
          <span key={w} className={`ghost-shimmer h-3.5 rounded-md bg-surface-raised ${w}`} />
        ))}
      </div>
      <p className="text-center text-[12.5px] text-muted">
        You can leave this page. The result will be here when you come back.
      </p>
    </section>
  );
}

/** A failed analysis, inside the meal card: why, and the way forward. */
export function FailedCard() {
  const { error, sourceBlob, description, analyze, handleClear } = useAnalysis();
  const { capReached } = useAiAllowance();
  const canRetry = (sourceBlob !== null || description.trim() !== "") && !capReached;
  return (
    <section aria-label="Analysis failed" className={cardClass}>
      <MealPhoto />
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-panel bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger"
      >
        <TriangleAlert className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span>
          {error}{" "}
          <span className="font-medium text-foreground">Failed analyses aren&apos;t counted.</span>
        </span>
      </p>
      <div className="flex gap-2">
        {canRetry && (
          <Button size="sm" className="flex-1" onClick={() => void analyze()}>
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            Try again
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={canRetry ? "" : "flex-1"}
          onClick={handleClear}
        >
          Start over
        </Button>
      </div>
    </section>
  );
}

/** Under an estimate: describe what's wrong and the AI tries again, or start over. */
export function CorrectionCard() {
  const { loading, analyze, handleClear } = useAnalysis();
  const { capReached } = useAiAllowance();
  const [text, setText] = useState("");
  const send = () => {
    const correction = text.trim();
    if (!correction) return;
    void analyze(correction);
    setText("");
  };
  return (
    <section aria-label="Correct the estimate" className={cardClass}>
      <CardHeader
        title="Something wrong?"
        sub={
          capReached
            ? "Corrections are paused: no AI analyses left today"
            : "Describe it and the AI tries again"
        }
      />
      <input
        type="text"
        value={text}
        disabled={capReached || loading}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
        }}
        aria-label="What's wrong with the estimate"
        placeholder="e.g. “it was rye bread, no butter”"
        className="h-12 w-full rounded-panel border-[1.5px] border-line bg-background px-4 text-[15px] text-foreground placeholder:text-muted/75 focus:border-accent focus:outline-none disabled:opacity-50"
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={capReached || loading || !text.trim()}
          onClick={send}
        >
          <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Re-analyze
        </Button>
        <Button variant="outline" size="sm" disabled={loading} onClick={handleClear}>
          Start over
        </Button>
      </div>
    </section>
  );
}
