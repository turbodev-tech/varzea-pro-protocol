import { z } from 'zod';

/**
 * Matches, as the field sees them. Only the platform creates a match; the hub
 * receives the pitch's schedule and reports what happened on the field.
 *
 * A match's window is `startsAt` → warmup → regular time → overtime. Kickoff
 * (`startedAt`) ends the warmup early when someone presses start, and the
 * phases after it are measured from kickoff.
 */

/** One side, as the placar draws it. */
export const matchSideSchema = z.object({
  name: z.string().min(1),
  /** What fits the LED panel: at most 10 characters. */
  shortName: z.string().min(1).max(10),
  /** `#rrggbb`, from the platform's LED palette. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'expected #rrggbb'),
});
export type MatchSide = z.infer<typeof matchSideSchema>;

/** Cancelled matches are never sent; a match that disappears was cancelled. */
export const matchStatusSchema = z.enum(['SCHEDULED', 'LIVE', 'FINISHED']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

const seconds = z.number().int().nonnegative();

export const scheduledMatchSchema = z.object({
  id: z.string().min(1),
  status: matchStatusSchema,
  /** Warmup begins here. ISO-8601. */
  startsAt: z.string(),
  warmupSeconds: seconds,
  durationSeconds: z.number().int().positive(),
  overtimeSeconds: seconds,
  /** Kickoff, once it happened. */
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  home: matchSideSchema,
  away: matchSideSchema,
});
export type ScheduledMatch = z.infer<typeof scheduledMatchSchema>;

/**
 * Every match on the hub's pitch ending in the next 24 hours, plus any live
 * one. Always a full replacement.
 */
export const matchScheduleSchema = z.object({
  matches: z.array(scheduledMatchSchema),
});
export type MatchSchedule = z.infer<typeof matchScheduleSchema>;

/** What the placar is showing. */
export const displayModeSchema = z.enum(['IDLE', 'WARMUP', 'LIVE', 'OVERTIME', 'ENDED']);
export type DisplayMode = z.infer<typeof displayModeSchema>;

/**
 * Everything the placar needs to draw, sent whole on every change.
 *
 * WARMUP counts down to `phaseEndsAt`. LIVE counts up from `startedAt`.
 * OVERTIME shows the time past `startedAt + durationSeconds` as `+mm:ss`.
 * IDLE shows `arenaName` and the time of day.
 */
export const displayStateSchema = z.object({
  mode: displayModeSchema,
  arenaName: z.string(),
  home: matchSideSchema.optional(),
  away: matchSideSchema.optional(),
  score: z
    .object({ home: z.number().int().nonnegative(), away: z.number().int().nonnegative() })
    .optional(),
  phaseEndsAt: z.string().optional(),
  startedAt: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
  overtimeSeconds: z.number().int().nonnegative().optional(),
});
export type DisplayState = z.infer<typeof displayStateSchema>;
