"use client";

import { Ellipsis, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMealAction, logMealAction, relogMealAction } from "@/app/actions";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import type { LoggedMeal } from "@/lib/log";
import { EditMealSheet } from "./EditMealSheet";
import { mealName } from "./MealRow";

/**
 * Log again and Delete for one meal, both with an Undo toast. `onChanged` runs
 * after anything changed, so a page that fetched its meals itself (the
 * homepage) can re-read them; pages rendered on the server refresh on their own.
 */
export function useMealActions(meal: LoggedMeal, onChanged?: () => void) {
  const [pending, startTransition] = useTransition();

  function relog() {
    startTransition(async () => {
      const result = await relogMealAction(meal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onChanged?.();
      const newId = result.newId;
      toast.success("Logged again today", {
        action: newId
          ? {
              label: "Undo",
              onClick: () =>
                void deleteMealAction(newId).then((r) => {
                  if (r.error) toast.error(r.error);
                  else onChanged?.();
                }),
            }
          : undefined,
      });
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteMealAction(meal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onChanged?.();
      // Undo re-inserts the row the server returned: the list copy held here
      // never includes the large photo, the deleted row does
      const removed = result.meal ?? meal;
      toast.success("Meal deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void logMealAction(removed).then((r) => {
              if (r.error) toast.error(r.error);
              else onChanged?.();
            }),
        },
      });
    });
  }

  return { pending, relog, remove };
}

/**
 * The ⋯ button at the end of a meal row and the sheet it opens: edit the meal,
 * log it again today, or delete it.
 */
export function MealMenu({ meal, onChanged }: { meal: LoggedMeal; onChanged?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { pending, relog, remove } = useMealActions(meal, onChanged);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={`More for ${mealName(meal)}`}
        disabled={pending}
        onClick={() => setMenuOpen(true)}
      >
        <Ellipsis className="h-5 w-5" strokeWidth={2} aria-hidden />
      </Button>
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={mealName(meal)}>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            setMenuOpen(false);
            setEditing(true);
          }}
        >
          <PencilLine className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          Edit amounts, day or time
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            setMenuOpen(false);
            relog();
          }}
        >
          <RotateCcw className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          Log again today
        </Button>
        <Button
          variant="destructive"
          className="w-full justify-start"
          onClick={() => {
            setMenuOpen(false);
            remove();
          }}
        >
          <Trash2 className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          Delete meal
        </Button>
      </Sheet>
      <EditMealSheet
        meal={meal}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={onChanged}
      />
    </>
  );
}
