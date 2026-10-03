import { toast } from "sonner";
import { deleteMealAction, logMealAction } from "@/app/actions";
import { dayBounds } from "@/lib/day";
import { makeThumbnail } from "@/lib/resize";
import { sumTotals } from "@/lib/scale";
import type { FoodItem, MealAnalysis } from "@/lib/schema";

/**
 * Logs foods as one meal straight away, without the AI plate: a scanned
 * product, a saved product or a typed-in entry. `day` is null for today;
 * an earlier day gets its timestamp from the server, as on the homepage.
 */
export async function logFoodsNow(
  foods: FoodItem[],
  day: string | null,
  notes = "",
): Promise<{ id: string } | { error: string }> {
  const id = crypto.randomUUID();
  const analysis: MealAnalysis = { foods, totals: sumTotals(foods), notes };
  // A product's picture doubles as the meal's cover, like a photographed meal's
  const image = foods.find((food) => food.imageUrl)?.imageUrl ?? null;
  let thumbnail: string | null = null;
  if (image) {
    try {
      thumbnail = await makeThumbnail(image);
    } catch {
      // The meal still gets logged, just without a picture
    }
  }
  const result = await logMealAction(
    { id, loggedAt: new Date().toISOString(), description: "", analysis, thumbnail, photo: image },
    day ? dayBounds(day) : undefined,
  );
  if (result.error) return { error: result.error };
  if (result.warning) toast.warning(result.warning);
  return { id };
}

/** "Logged to today" with Undo, which deletes the meal again. */
export function loggedToast(message: string, id: string, onChanged: () => void) {
  toast.success(message, {
    action: {
      label: "Undo",
      onClick: () =>
        void deleteMealAction(id).then((r) => {
          if (r.error) toast.error(r.error);
          else onChanged();
        }),
    },
  });
}
