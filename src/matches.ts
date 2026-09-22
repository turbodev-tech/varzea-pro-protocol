import { z } from 'zod';

/**
 * Matches, as the field sees them. Only the platform creates a match; the hub
 * receives the pitch's schedule and reports what happened on the field.
 *
 * A match's window is `startsAt` → warmup → regular time → overtime. Kickoff
 * (`startedAt`) ends the warmup early when someone presses start, and the
 * phases after it are measured from kickoff.
 */

/**
 * One side, as the placar draws it.
 *
 * The hub validates `api.matches` and the `hub.connected` reply as a whole:
 * one invalid match rejects the entire message (for `hub.connected`, that
 * means no config at all, and the hub loops reconnecting). The API must
 * therefore always send a palette `color` (`#rrggbb`) and a non-empty
 * `shortName` of at most 10 characters, upper-cased before it is cut to that
 * length.
 */
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

/**
 * The hub validates `api.matches` and the `hub.connected` reply as a whole:
 * one invalid match rejects the entire message (for `hub.connected`, that
 * means no config at all, and the hub loops reconnecting). The API must
 * therefore always send `durationSeconds >= 1`, alongside a valid `home` and
 * `away` (see `matchSideSchema`).
 */
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
 * The next booked match, sent with IDLE so the placar can count down to it.
 * `startsAt` is when warmup begins, on the hub's corrected clock.
 */
export const nextMatchSchema = z.object({
  startsAt: z.string(),
  home: matchSideSchema.optional(),
  away: matchSideSchema.optional(),
});
export type NextMatch = z.infer<typeof nextMatchSchema>;

/**
 * Everything the placar needs to draw, sent whole on every change.
 *
 * WARMUP counts down to `phaseEndsAt`. LIVE counts up from `startedAt`.
 * OVERTIME shows the time past `startedAt + durationSeconds` as `+mm:ss`.
 * IDLE shows `arenaName` and the time of day.
 * IDLE may carry `nextMatch`; the placar then counts down to its `startsAt`.
 *
 * Every absolute time here is on the hub's corrected clock — the offset the
 * placar learns from `hubTime` in the `peripheral.connected` and
 * `peripheral.heartbeat` replies, not the placar's own clock. The placar
 * renders arena time as UTC−3, fixed.
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
  nextMatch: nextMatchSchema.optional(),
});
export type DisplayState = z.infer<typeof displayStateSchema>;
