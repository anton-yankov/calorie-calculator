"use client";

import { useWaterTracking } from "@/components/WaterTracking";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAiAllowance } from "@/components/AiAllowance";
import { capReachedMessage } from "@/lib/ai-cap-message";
import { AnalysisCard, CompactAnalysis } from "@/components/AnalysisCard";
import { useAnalysis } from "@/components/AnalysisProvider";
import { BarcodeInput } from "@/components/BarcodeInput";
import { CorrectionBar } from "@/components/CorrectionBar";
import { DatePicker } from "@/components/DatePicker";
import { SkeletonEstimate, Spinner } from "@/components/loaders";
import { PhotoInput } from "@/components/PhotoInput";
import { TodayStrip } from "@/components/TodayStrip";
import { WeighInNudge } from "@/components/WeighInNudge";
import { dayKey, dayLabel } from "@/lib/day";

function CorrectionBubble({ text }: { text: string }) {
  return (
    <div className="self-end max-w-[85%] rounded-panel rounded-br-sm border border-success/40 bg-success-soft px-4 py-2.5 text-sm text-foreground">
      {text}
    </div>
  );
}

export default function Home() {
  const waterTracking = useWaterTracking();
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
    logging,
    error,
    loggedAtLength,
    logDate,
    setLogDate,
    latest,
    session,
    handleSelect,
    handleClear,
    handleLog,
    addScannedFood,
    analyze,
    handleGramsChange,
    handleDrinkTypeChange,
    quickAddWater,
    quickWaterPending,
  } = useAnalysis();

  // Out of analyses: photos and corrections pause; text still goes through, since
  // "water 500" needs no AI and anything else gets the server's cap message
  const { allowance, capReached } = useAiAllowance();
  const todayKey = dayKey(new Date());
  const logged = latest !== undefined && loggedAtLength === history.length;

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history.length > 1 || pendingCorrection) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [history.length, pendingCorrection]);

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-5 py-8 sm:px-6 sm:py-11 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10">
      <header className="mb-2 border-b-2 border-foreground pb-6 lg:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Meal analysis
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          What’s on your plate?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted sm:text-base">
          Photo or description in, macros out. Estimates — correct them below.
        </p>
      </header>

      <TodayStrip />
      <WeighInNudge />
      {waterTracking && (
        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          <span className="mr-1 text-xs font-semibold text-muted">
            Quick water{logDate ? ` · ${dayLabel(logDate)}` : " · today"}
          </span>
          {[250, 500, 1000].map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={quickWaterPending}
              onClick={() => void quickAddWater(ml)}
              className="rounded-panel border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent transition hover:border-accent disabled:opacity-40"
            >
              +{ml === 1000 ? "1 L" : `${ml} ml`}
            </button>
          ))}
        </div>
      )}

      {/* Controls column — on lg it sticks below the nav while the thread scrolls */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        {capReached && allowance?.cap != null && (
          <p className="rounded-r-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm">
            <span className="block font-semibold">{capReachedMessage(allowance.cap)}</span>
            Barcodes, water and{" "}
            <Link href="/log" className="font-semibold text-accent hover:underline">
              adding food manually
            </Link>{" "}
            still work.
          </p>
        )}
        <PhotoInput
          previewUrl={previewUrl}
          disabled={loading || preparing || capReached}
          preparing={preparing}
          compact={history.length > 0}
          onSelect={(f) => void handleSelect(f)}
          onClear={handleClear}
        />

        {/* Keyed on the session so a full reset also closes an open product panel */}
        <BarcodeInput
          key={session}
          disabled={loading || preparing || logging}
          onAdd={addScannedFood}
        />

        <div className="relative flex">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 2 eggs, coffee 250ml, or water 500"
            aria-label="Food or drink description"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading && !preparing && !logging) void analyze();
            }}
            className="min-w-0 flex-1 rounded-panel border border-line bg-surface py-3 pl-4 pr-11 text-sm text-foreground placeholder:text-muted/75 transition-colors focus:border-accent focus:outline-none"
          />
          {description && (
            <button
              type="button"
              aria-label="Clear description"
              title="Clear description"
              onClick={() => setDescription("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {waterTracking && (
          <p className="-mt-2 text-xs text-muted">
            Water 500 = 500 ml · water 1 = 1 L. All drinks count toward Water.
          </p>
        )}

        {(!latest || sourceBlob || description.trim()) && (
          <button
            type="button"
            disabled={
              (!sourceBlob && !description.trim()) ||
              (capReached && sourceBlob !== null) ||
              loading ||
              preparing
            }
            onClick={() => analyze()}
            className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {/* During photo prep the frame overlay is the loader — the button stays plain */}
            {loading && <Spinner />}
            {loading
              ? "Analyzing…"
              : latest
                ? sourceBlob
                  ? "Start over with this photo"
                  : "Analyze again"
                : "Analyze"}
          </button>
        )}

        {error && (
          <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Full reset — the photo ✕ only exists when there is a photo, and a
            barcode-only or text-only plate would otherwise have no way out */}
        {(latest || sourceBlob || description.trim()) && !logged && (
          <button
            type="button"
            disabled={loading || preparing || logging}
            onClick={handleClear}
            className="self-center text-xs font-semibold text-muted transition-colors hover:text-foreground disabled:opacity-40"
          >
            Clear everything
          </button>
        )}
      </div>

      {/* Thread column — estimates, corrections, and log actions */}
      <section className="flex min-w-0 flex-col gap-4">
        {history.length === 0 && !loading && (
          <div className="hidden min-h-56 items-center justify-center rounded-panel border-2 border-dashed border-line px-6 text-sm text-muted lg:flex">
            Estimates appear here once you analyze a photo or description.
          </div>
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
                  disabled={loading || logged}
                  onGramsChange={handleGramsChange}
                  onDrinkTypeChange={handleDrinkTypeChange}
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
            {/* Before logging: pick a day and log. After: the picker and log
                button are dead controls, so they collapse into a confirmation
                line and the two follow-up actions get the room instead. */}
            {logged ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="w-full text-sm font-semibold text-success sm:w-auto sm:flex-1">
                  Logged to {dayLabel(logDate ?? todayKey)} ✓
                </p>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Link
                    href="/log"
                    className="flex flex-1 items-center justify-center rounded-panel bg-success px-4 py-2.5 text-sm font-semibold text-background transition hover:brightness-110 sm:flex-none"
                  >
                    View log
                  </Link>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex flex-1 items-center justify-center rounded-panel border border-line px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent sm:flex-none"
                  >
                    New meal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Which day the meal lands on — capped at today, no future meals */}
                <DatePicker
                  value={logDate ?? todayKey}
                  max={todayKey}
                  disabled={logging}
                  onChange={setLogDate}
                  ariaLabel="Day to log this meal to"
                />
                <button
                  type="button"
                  disabled={loading || logging}
                  onClick={() => void handleLog()}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-panel border border-success px-4 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success-soft disabled:border-line disabled:text-muted"
                >
                  {logging && <Spinner className="h-3.5 w-3.5" />}
                  {logging ? "Logging…" : logDate ? `Log to ${dayLabel(logDate)}` : "Log meal"}
                </button>
              </div>
            )}
            {/* A logged meal is final here (edit it on the Log), so correcting it is hidden */}
            {!logged && (
              <>
                <CorrectionBar
                  disabled={loading || capReached}
                  loading={loading}
                  onSubmit={(correction) => analyze(correction)}
                />
                <p className="text-center text-xs text-muted">
                  Edit amounts for instant recalculation, or describe what’s wrong to re-analyze.
                </p>
              </>
            )}
          </>
        )}

        <div ref={threadEndRef} />
      </section>
    </main>
  );
}
