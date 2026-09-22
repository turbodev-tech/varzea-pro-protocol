"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayStateSchema = exports.nextMatchSchema = exports.displayModeSchema = exports.matchScheduleSchema = exports.scheduledMatchSchema = exports.matchStatusSchema = exports.matchSideSchema = void 0;
const zod_1 = require("zod");
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
exports.matchSideSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    /** What fits the LED panel: at most 10 characters. */
    shortName: zod_1.z.string().min(1).max(10),
    /** `#rrggbb`, from the platform's LED palette. */
    color: zod_1.z.string().regex(/^#[0-9a-f]{6}$/i, 'expected #rrggbb'),
});
/** Cancelled matches are never sent; a match that disappears was cancelled. */
exports.matchStatusSchema = zod_1.z.enum(['SCHEDULED', 'LIVE', 'FINISHED']);
const seconds = zod_1.z.number().int().nonnegative();
/**
 * The hub validates `api.matches` and the `hub.connected` reply as a whole:
 * one invalid match rejects the entire message (for `hub.connected`, that
 * means no config at all, and the hub loops reconnecting). The API must
 * therefore always send `durationSeconds >= 1`, alongside a valid `home` and
 * `away` (see `matchSideSchema`).
 */
exports.scheduledMatchSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    status: exports.matchStatusSchema,
    /** Warmup begins here. ISO-8601. */
    startsAt: zod_1.z.string(),
    warmupSeconds: seconds,
    durationSeconds: zod_1.z.number().int().positive(),
    overtimeSeconds: seconds,
    /** Kickoff, once it happened. */
    startedAt: zod_1.z.string().optional(),
    endedAt: zod_1.z.string().optional(),
    home: exports.matchSideSchema,
    away: exports.matchSideSchema,
});
/**
 * Every match on the hub's pitch ending in the next 24 hours, plus any live
 * one. Always a full replacement.
 */
exports.matchScheduleSchema = zod_1.z.object({
    matches: zod_1.z.array(exports.scheduledMatchSchema),
});
/** What the placar is showing. */
exports.displayModeSchema = zod_1.z.enum(['IDLE', 'WARMUP', 'LIVE', 'OVERTIME', 'ENDED']);
/**
 * The next booked match, sent with IDLE so the placar can count down to it.
 * `startsAt` is when warmup begins, on the hub's corrected clock.
 */
exports.nextMatchSchema = zod_1.z.object({
    startsAt: zod_1.z.string(),
    home: exports.matchSideSchema.optional(),
    away: exports.matchSideSchema.optional(),
});
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
exports.displayStateSchema = zod_1.z.object({
    mode: exports.displayModeSchema,
    arenaName: zod_1.z.string(),
    home: exports.matchSideSchema.optional(),
    away: exports.matchSideSchema.optional(),
    score: zod_1.z
        .object({ home: zod_1.z.number().int().nonnegative(), away: zod_1.z.number().int().nonnegative() })
        .optional(),
    phaseEndsAt: zod_1.z.string().optional(),
    startedAt: zod_1.z.string().optional(),
    durationSeconds: zod_1.z.number().int().positive().optional(),
    overtimeSeconds: zod_1.z.number().int().nonnegative().optional(),
    nextMatch: exports.nextMatchSchema.optional(),
});
