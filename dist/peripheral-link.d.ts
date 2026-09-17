import { z } from 'zod';
import { type PayloadOf, type ReplyOf } from './envelope';
/**
 * The LAN link between field peripherals and the hub. Peripherals are the
 * WebSocket clients; the hub is the server. `peripheral.*` is sent by a
 * peripheral, `hub.*` by the hub.
 *
 * This is the same envelope and the same reply rule as the API link, so an
 * ESP32 and the API speak recognisably the same language.
 */
export declare const peripheralLinkMessages: {
    /**
     * First message after connecting. Until this is accepted the hub ignores
     * everything else from the socket.
     */
    readonly 'peripheral.connected': import("./envelope").MessageSpec<z.ZodObject<{
        hardwareId: z.ZodString;
        type: z.ZodEnum<{
            CAMERA: "CAMERA";
            PLACAR: "PLACAR";
        }>;
        firmwareVersion: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hubTime: z.ZodString;
        heartbeatSeconds: z.ZodNumber;
    }, z.core.$strip>>;
    /**
     * Something happened on the peripheral — a goal, a highlight.
     *
     * `ageMs` is how long ago it happened, measured by the peripheral's own
     * monotonic clock. An ESP32 has no wall clock and a queued event may sit for
     * minutes during an outage, so it reports elapsed time and the hub converts
     * to an absolute `occurredAt`. Sending a timestamp instead would be wrong the
     * moment the event is buffered.
     *
     * The peripheral must keep the event queued until the matching `hub.ok`
     * arrives — a successful socket write is not delivery.
     */
    readonly 'peripheral.event': import("./envelope").MessageSpec<z.ZodObject<{
        eventType: z.ZodString;
        clientEventId: z.ZodString;
        ageMs: z.ZodNumber;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        clientEventId: z.ZodString;
    }, z.core.$strip>>;
    /** Keeps the hub's view of this peripheral marked online. */
    readonly 'peripheral.heartbeat': import("./envelope").MessageSpec<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        hubTime: z.ZodString;
    }, z.core.$strip>>;
    /**
     * Highlight held for 3 seconds: kick off the match in warmup.
     *
     * Queued like a goal, with `ageMs` for the same reason. `started: true`
     * means a hold at `now − ageMs` fell inside a match's warmup, and that
     * match's kickoff is now at or before the hold time — `matchId` names that
     * match. A late-delivered hold can move an earlier timer kickoff back,
     * because the earliest kickoff always wins (see `hub.match.started`).
     * `started: false` only when no match was in warmup at that moment, and
     * the placar shows SEM PARTIDA.
     */
    readonly 'peripheral.match.start': import("./envelope").MessageSpec<z.ZodObject<{
        clientEventId: z.ZodString;
        ageMs: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        matchId: z.ZodOptional<z.ZodString>;
        started: z.ZodBoolean;
    }, z.core.$strip>>;
    /** Relayed from `api.peripheral.command`. The reply travels back up unchanged. */
    readonly 'hub.command': import("./envelope").MessageSpec<z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        result: z.ZodUnknown;
    }, z.core.$strip>>;
    /** What to draw. Sent on every change and right after `peripheral.connected`. */
    readonly 'hub.display': import("./envelope").MessageSpec<z.ZodObject<{
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
    }, z.core.$strip>, null>;
};
export type PeripheralLinkMessages = typeof peripheralLinkMessages;
export type PeripheralLinkType = keyof PeripheralLinkMessages;
export type PeripheralLinkPayload<T extends PeripheralLinkType> = PayloadOf<PeripheralLinkMessages[T]>;
export type PeripheralLinkReply<T extends PeripheralLinkType> = ReplyOf<PeripheralLinkMessages[T]>;
/** Types a peripheral may send. */
export type PeripheralSends = Extract<PeripheralLinkType, `peripheral.${string}`>;
/** Types the hub may send on this link. */
export type HubSendsToPeripheral = Extract<PeripheralLinkType, `hub.${string}`>;
