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
