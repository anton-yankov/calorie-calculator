/**
 * The weigh-in reminder intervals on offer, in days; 0 turns the reminder off.
 * A module of its own (no database code) so browser components can use it too.
 */
export const REMINDER_DAYS = [1, 3, 7, 14, 0] as const;
export type WeighInReminderDays = (typeof REMINDER_DAYS)[number];
export const DEFAULT_REMINDER_DAYS: WeighInReminderDays = 7;
export const isReminderDays = (value: unknown): value is WeighInReminderDays =>
  REMINDER_DAYS.includes(value as WeighInReminderDays);
