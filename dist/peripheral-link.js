"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.peripheralLinkMessages = void 0;
const zod_1 = require("zod");
const envelope_1 = require("./envelope");
const shared_1 = require("./shared");
const matches_1 = require("./matches");
/**
 * The LAN link between field peripherals and the hub. Peripherals are the
 * WebSocket clients; the hub is the server. `peripheral.*` is sent by a
 * peripheral, `hub.*` by the hub.
 *
 * This is the same envelope and the same reply rule as the API link, so an
 * ESP32 and the API speak recognisably the same language.
 */
exports.peripheralLinkMessages = {
    // ── peripheral → hub ───────────────────────────────────────────────────────
    /**
     * First message after connecting. Until this is accepted the hub ignores
     * everything else from the socket.
     */
    'peripheral.connected': (0, envelope_1.define)(zod_1.z.object({
        hardwareId: zod_1.z.string().min(1),
        type: shared_1.peripheralTypeSchema,
        firmwareVersion: zod_1.z.string(),
        label: zod_1.z.string().optional(),
    }), zod_1.z.object({
        hubTime: zod_1.z.string(),
        heartbeatSeconds: zod_1.z.number().int().positive(),
    })),
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
    'peripheral.event': (0, envelope_1.define)(zod_1.z.object({
        eventType: zod_1.z.string().min(1),
        clientEventId: zod_1.z.string().min(1),
        ageMs: zod_1.z.number().int().nonnegative(),
        data: shared_1.dataSchema.optional(),
    }), zod_1.z.object({ clientEventId: zod_1.z.string() })),
    /** Keeps the hub's view of this peripheral marked online. */
    'peripheral.heartbeat': (0, envelope_1.define)(zod_1.z.object({}), zod_1.z.object({ hubTime: zod_1.z.string() })),
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
    'peripheral.match.start': (0, envelope_1.define)(zod_1.z.object({
        clientEventId: zod_1.z.string().min(1),
        ageMs: zod_1.z.number().int().nonnegative(),
    }), zod_1.z.object({ matchId: zod_1.z.string().optional(), started: zod_1.z.boolean() })),
    // ── hub → peripheral ───────────────────────────────────────────────────────
    /** Relayed from `api.peripheral.command`. The reply travels back up unchanged. */
    'hub.command': (0, envelope_1.define)(zod_1.z.object({ command: zod_1.z.string().min(1), args: shared_1.dataSchema.optional() }), zod_1.z.object({ result: zod_1.z.unknown() })),
    /** What to draw. Sent on every change and right after `peripheral.connected`. */
    'hub.display': (0, envelope_1.define)(matches_1.displayStateSchema, null),
};
