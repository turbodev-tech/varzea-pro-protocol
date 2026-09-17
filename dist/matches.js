"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchScheduleSchema = exports.scheduledMatchSchema = exports.matchStatusSchema = exports.matchSideSchema = void 0;
const zod_1 = require("zod");
/**
 * Matches, as the field sees them. Only the platform creates a match; the hub
 * receives the pitch's schedule and reports what happened on the field.
 *
 * A match's window is `startsAt` → warmup → regular time → overtime. Kickoff
 * (`startedAt`) ends the warmup early when someone presses start, and the
 * phases after it are measured from kickoff.
 */
/** One side, as the placar draws it. */
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
