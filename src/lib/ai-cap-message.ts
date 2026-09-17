/**
 * Why an AI request was refused, shared by the server's 429 and the Analyze
 * page (which runs in the browser, so this can't live next to the secret-key
 * code in ai-usage.ts). A cap of 0 means the admin paused AI for the account.
 */
export function capReachedMessage(cap: number): string {
  if (cap === 0) return "AI analyses are paused for your account.";
  return `You've used today's ${cap} ${cap === 1 ? "analysis" : "analyses"}. They're back at midnight.`;
}
