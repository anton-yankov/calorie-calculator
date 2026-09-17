import { capReachedMessage } from "@/lib/ai-cap-message";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSessionClient, type Viewer } from "@/lib/supabase-session";

/**
 * The daily AI cap. Counting happens in the database (public.claim_ai_analysis
 * in supabase/schema.sql) so the check and the +1 are one step: two photos sent
 * at the same moment can't both slip under the cap. A day is a calendar day in
 * Sofia, so the count resets at midnight there whatever the device clock says.
 */

/** Analyses per day for users without their own limit; the SQL function uses the same number. */
export const DEFAULT_DAILY_CAP = 20;
const TIME_ZONE = "Europe/Sofia";

export interface AiAllowance {
  used: number;
  /** null means unlimited (the admin) */
  cap: number | null;
}

/** Today's YYYY-MM-DD in Sofia ("en-CA" formats dates year-first). */
export function sofiaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** How many analyses the viewer has used today, out of how many. */
export async function getAiAllowance(viewer: Viewer): Promise<AiAllowance> {
  const db = await createSessionClient();
  const [usage, limit] = await Promise.all([
    db
      .from("ai_usage")
      .select("used")
      .eq("user_id", viewer.userId)
      .eq("day", sofiaDay())
      .maybeSingle(),
    db.from("ai_limits").select("daily_cap").eq("user_id", viewer.userId).maybeSingle(),
  ]);
  if (usage.error) throw new Error(`Couldn't load AI usage: ${usage.error.message}`);
  if (limit.error) throw new Error(`Couldn't load the AI limit: ${limit.error.message}`);
  return {
    used: (usage.data as { used: number } | null)?.used ?? 0,
    cap: viewer.isAdmin
      ? null
      : ((limit.data as { daily_cap: number } | null)?.daily_cap ?? DEFAULT_DAILY_CAP),
  };
}

/**
 * Uses one of today's analyses for an AI route. Returns null when the request
 * may go ahead, or the response to send instead. Call it right before the AI
 * request, after every check that can turn the request away for free. When the
 * count can't be checked the request is refused: an unchecked request is an
 * uncapped one.
 */
export async function claimAnalysis(): Promise<Response | null> {
  const db = await createSessionClient();
  const { data, error } = await db.rpc("claim_ai_analysis");
  if (error) {
    console.error("AI claim failed:", error.message);
    return Response.json(
      { error: "Couldn't check your analyses left. Try again." },
      { status: 503 },
    );
  }
  const claim = data as AiAllowance & { allowed: boolean };
  return claim.allowed
    ? null
    : Response.json({ error: capReachedMessage(claim.cap ?? 0) }, { status: 429 });
}

/**
 * Gives back an analysis whose AI request failed. Only the secret key may call
 * the refund function: if users could, they could refund themselves forever.
 */
export async function refundAnalysis(userId: string): Promise<void> {
  const { error } = await createAdminClient().rpc("refund_ai_analysis", { p_user: userId });
  if (error) console.error("AI refund failed:", error.message);
}

/**
 * OpenAI client for the AI routes. The SDK default is a 10-minute timeout with
 * 2 retries, far past the route's own limit (AI_ROUTE_MAX_SECONDS): the host
 * would stop the request before the SDK gave up, and the refund in the route's
 * `finally` would never run. Two 40 s attempts fit inside 90 s.
 */
export const OPENAI_OPTIONS = { timeout: 40_000, maxRetries: 1 } as const;
