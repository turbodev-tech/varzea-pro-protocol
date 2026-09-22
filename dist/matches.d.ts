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
export declare const matchSideSchema: z.ZodObject<{
    name: z.ZodString;
    shortName: z.ZodString;
    color: z.ZodString;
}, z.core.$strip>;
export type MatchSide = z.infer<typeof matchSideSchema>;
/** Cancelled matches are never sent; a match that disappears was cancelled. */
export declare const matchStatusSchema: z.ZodEnum<{
    SCHEDULED: "SCHEDULED";
    LIVE: "LIVE";
    FINISHED: "FINISHED";
}>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
/**
 * The hub validates `api.matches` and the `hub.connected` reply as a whole:
 * one invalid match rejects the entire message (for `hub.connected`, that
 * means no config at all, and the hub loops reconnecting). The API must
 * therefore always send `durationSeconds >= 1`, alongside a valid `home` and
 * `away` (see `matchSideSchema`).
 */
export declare const scheduledMatchSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        SCHEDULED: "SCHEDULED";
        LIVE: "LIVE";
        FINISHED: "FINISHED";
    }>;
    startsAt: z.ZodString;
    warmupSeconds: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    overtimeSeconds: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodString>;
    endedAt: z.ZodOptional<z.ZodString>;
    home: z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>;
    away: z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ScheduledMatch = z.infer<typeof scheduledMatchSchema>;
/**
 * Every match on the hub's pitch ending in the next 24 hours, plus any live
 * one. Always a full replacement.
 */
export declare const matchScheduleSchema: z.ZodObject<{
    matches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<{
            SCHEDULED: "SCHEDULED";
            LIVE: "LIVE";
            FINISHED: "FINISHED";
        }>;
        startsAt: z.ZodString;
        warmupSeconds: z.ZodNumber;
        durationSeconds: z.ZodNumber;
        overtimeSeconds: z.ZodNumber;
        startedAt: z.ZodOptional<z.ZodString>;
        endedAt: z.ZodOptional<z.ZodString>;
        home: z.ZodObject<{
            name: z.ZodString;
            shortName: z.ZodString;
            color: z.ZodString;
        }, z.core.$strip>;
        away: z.ZodObject<{
            name: z.ZodString;
            shortName: z.ZodString;
            color: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MatchSchedule = z.infer<typeof matchScheduleSchema>;
/** What the placar is showing. */
export declare const displayModeSchema: z.ZodEnum<{
    LIVE: "LIVE";
    IDLE: "IDLE";
    WARMUP: "WARMUP";
    OVERTIME: "OVERTIME";
    ENDED: "ENDED";
}>;
export type DisplayMode = z.infer<typeof displayModeSchema>;
/**
 * The next booked match, sent with IDLE so the placar can count down to it.
 * `startsAt` is when warmup begins, on the hub's corrected clock.
 */
export declare const nextMatchSchema: z.ZodObject<{
    startsAt: z.ZodString;
    home: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>>;
    away: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
export declare const displayStateSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        LIVE: "LIVE";
        IDLE: "IDLE";
        WARMUP: "WARMUP";
        OVERTIME: "OVERTIME";
        ENDED: "ENDED";
    }>;
    arenaName: z.ZodString;
    home: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>>;
    away: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        shortName: z.ZodString;
        color: z.ZodString;
    }, z.core.$strip>>;
    score: z.ZodOptional<z.ZodObject<{
        home: z.ZodNumber;
        away: z.ZodNumber;
    }, z.core.$strip>>;
    phaseEndsAt: z.ZodOptional<z.ZodString>;
    startedAt: z.ZodOptional<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
    overtimeSeconds: z.ZodOptional<z.ZodNumber>;
    nextMatch: z.ZodOptional<z.ZodObject<{
        startsAt: z.ZodString;
        home: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            shortName: z.ZodString;
            color: z.ZodString;
        }, z.core.$strip>>;
        away: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            shortName: z.ZodString;
            color: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DisplayState = z.infer<typeof displayStateSchema>;
