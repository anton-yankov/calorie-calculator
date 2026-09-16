"use server";

import { revalidatePath } from "next/cache";
import { setDailyCap } from "@/lib/admin";
import { whole } from "@/lib/profile-input";
import { getViewer } from "@/lib/supabase-session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Changes one user's daily AI cap; admin only, like every admin page. */
export async function setDailyCapAction(
  userId: string,
  dailyCap: number,
): Promise<{ error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { error: "Not allowed" };
  if (typeof userId !== "string" || !UUID.test(userId)) return { error: "Invalid user" };
  const cap = whole(dailyCap, 0, 1000);
  if (cap === null) return { error: "Enter a whole number from 0 to 1000." };
  try {
    await setDailyCap(userId, cap);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save the cap" };
  }
  revalidatePath("/admin", "layout");
  return {};
}
