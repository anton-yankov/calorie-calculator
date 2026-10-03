"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAnalysis } from "@/components/AnalysisProvider";
import { AddFood } from "@/components/home/AddFood";
import { BarcodeFlow } from "@/components/home/BarcodeFlow";
import { EatenToday } from "@/components/home/EatenToday";
import { EarlierEstimate, EstimateCard } from "@/components/home/EstimateCard";
import { ManualSheet } from "@/components/home/ManualSheet";
import {
  AnalyzingCard,
  ComposeCard,
  CorrectionCard,
  FailedCard,
} from "@/components/home/MealCards";
import { TodayCards } from "@/components/home/TodayCards";
import { useDay } from "@/components/home/useDay";
import { WaterRow } from "@/components/home/WaterRow";
import { WeighInCard } from "@/components/home/WeighInCard";
import { logFoodsNow, loggedToast } from "@/components/meals/logFood";
import { dayKey, dayLabel } from "@/lib/day";
import type { FoodItem } from "@/lib/schema";

/** How long a just-logged meal stays tinted in the list. */
const HIGHLIGHT_MS = 4000;

/**
 * The homepage. Phones get one column: the day's numbers, then either the
 * four ways to add food or the meal being put together, then water, the
 * weigh-in card and the day's meals. Desktop splits it: adding food on the
 * left (sticky), the numbers, the meal in progress and the day's meals on the
 * right. Both orders come from the same elements: on phones the two column
 * wrappers dissolve (`contents`) and `order` interleaves their children.
 */
export default function Home() {
  // All analysis state lives in AnalysisProvider (mounted in the layout) so it
  // survives navigating away from this page mid-analysis
  const {
    sourceBlob,
    preparing,
    description,
    history,
    loading,
    error,
    latest,
    session,
    handleSelect,
    handleClear,
    addScannedFood,
    refreshDay,
  } = useAnalysis();
  const { day, isToday, progress } = useDay();
  const [describing, setDescribing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Products' empty page links here with ?scan=1 to open the scanner straight away
  const router = useRouter();
  const scanRequested = useSearchParams().get("scan") === "1";
  const [scanHandled, setScanHandled] = useState(false);
  if (scanRequested && !scanHandled) {
    setScanHandled(true);
    setScanning(true);
  }

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  // A full reset (Start over, ✕, or logging) also closes the describe box
  const [lastSession, setLastSession] = useState(session);
  if (session !== lastSession) {
    setLastSession(session);
    setDescribing(false);
  }

  // Anything on the plate means the Add food area becomes the meal being made
  const plateActive =
    describing ||
    sourceBlob !== null ||
    preparing ||
    loading ||
    history.length > 0 ||
    error !== null;

  function highlight(id: string) {
    setHighlightId(id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }

  function onLogged(id: string, what: string, loggedDay: string | null) {
    refreshDay();
    highlight(id);
    loggedToast(`${what} logged to ${loggedDay ? dayLabel(loggedDay) : "today"}`, id, refreshDay);
  }

  // A plate with something on it: a photo, a description or an estimate
  const plateHasFood = sourceBlob !== null || description.trim() !== "" || history.length > 0;

  // A scanned product joins the plate if one is being made, otherwise it's logged on its own
  async function addProduct(food: FoodItem, productDay: string | null) {
    if (plateHasFood) {
      addScannedFood(food);
      toast.success(`${food.name} added to the meal`);
      return;
    }
    const result = await logFoodsNow([food], productDay);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onLogged(result.id, food.name, productDay);
  }

  let mealCard: React.ReactNode = null;
  if (loading) {
    mealCard = <AnalyzingCard />;
  } else if (latest) {
    const earlier = history.slice(0, -1);
    mealCard = (
      <>
        {earlier.map((entry, i) => (
          <EarlierEstimate
            key={i}
            analysis={entry.analysis}
            label={`Estimate ${i + 1}`}
            correction={history[i + 1]?.correction ?? null}
          />
        ))}
        <EstimateCard
          analysis={latest.analysis}
          previous={earlier.at(-1)?.analysis ?? null}
          label={history.length > 1 ? `Estimate ${history.length}` : "Estimate"}
          durationMs={latest.durationMs}
          progress={progress}
          onLogged={(id, loggedDay) =>
            onLogged(id, "Meal", loggedDay === dayKey(new Date()) ? null : loggedDay)
          }
        />
        <CorrectionCard />
      </>
    );
  } else if (error && (sourceBlob || description.trim())) {
    mealCard = <FailedCard />;
  } else if (plateActive) {
    mealCard = (
      <ComposeCard
        onClose={() => {
          handleClear();
          setDescribing(false);
        }}
      />
    );
  }

  return (
    <main className="page-enter mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4 pb-12 lg:grid lg:max-w-5xl lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 lg:pt-2">
      {/* Left on desktop: the ways to add food, water and the weigh-in card */}
      <div className="contents lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-3">
        <AddFood
          className={`order-2 ${plateActive ? "hidden lg:flex" : ""}`}
          onPhoto={(file) => {
            setDescribing(false);
            void handleSelect(file);
          }}
          onDescribe={() => setDescribing(true)}
          onBarcode={() => setScanning(true)}
          onManual={() => setManualOpen(true)}
        />
        <WaterRow progress={progress} className="order-3" />
        <WeighInCard className="order-4" />
      </div>

      {/* Right on desktop: the day's numbers, the meal in progress and the day's meals */}
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
        <div className="order-1 flex flex-col gap-2">
          {!isToday && (
            <p className="text-[13px] font-semibold text-accent">Logging to {dayLabel(day)}</p>
          )}
          <TodayCards progress={progress} isToday={isToday} />
        </div>
        {mealCard && <div className="order-2 flex min-w-0 flex-col gap-3">{mealCard}</div>}
        <EatenToday
          className="order-5"
          progress={progress}
          day={day}
          isToday={isToday}
          highlightId={highlightId}
          onChanged={refreshDay}
        />
      </div>

      <ManualSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onLogged={(id, name, loggedDay) => {
          setManualOpen(false);
          onLogged(id, name, loggedDay);
        }}
      />
      {scanning && (
        <BarcodeFlow
          target={plateHasFood ? "meal" : "now"}
          onAdd={addProduct}
          onDone={() => {
            setScanning(false);
            if (scanRequested) router.replace("/");
          }}
        />
      )}
    </main>
  );
}
