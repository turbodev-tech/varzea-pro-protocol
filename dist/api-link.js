"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLinkMessages = exports.hubConfigSchema = exports.discoveredCameraSchema = exports.cameraSchema = void 0;
const zod_1 = require("zod");
const envelope_1 = require("./envelope");
const shared_1 = require("./shared");
const matches_1 = require("./matches");
/**
 * The hub's link to the API. The hub is the WebSocket client; the API is the
 * server. `hub.*` is sent by the hub, `api.*` by the API.
 */
/**
 * One camera the hub should pull. It records only while a match on the pitch is active.
 * `hardwareId` is the MediaMTX path name.
 *
 * There is deliberately no address. Fields are wired and addressed by the
 * arena router's DHCP, so an IP is something only the hub can know: it finds
 * cameras by ONVIF discovery and resolves `hardwareId` (the MAC) to an address
 * itself. Identity lives in the API; address lives in the hub.
 *
 * `hardwareId` is not validated as a MAC here, on purpose. This schema sits
 * inside `api.config`, and one bad camera row would then reject the whole
 * config — including the placar list scoring depends on. A camera the hub
 * cannot match to a discovered MAC is reported as unresolved instead.
 */
exports.cameraSchema = zod_1.z.object({
    hardwareId: zod_1.z.string().min(1),
    rtspPort: zod_1.z.number().int().positive().default(554),
    rtspPath: zod_1.z.string().min(1),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
});
/**
 * A camera the hub found on its LAN. Seeing a camera does not register it —
 * that takes a claim in the app, which is what puts it in `cameras` above.
 */
exports.discoveredCameraSchema = zod_1.z.object({
    hardwareId: shared_1.macHardwareIdSchema,
    /** Display form, e.g. `F0:00:06:21:CD:6E`. */
    mac: zod_1.z.string(),
    /** Current address. Diagnostics only — never fed back into config. */
    host: zod_1.z.string(),
    manufacturer: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    firmwareVersion: zod_1.z.string().optional(),
    lastSeenAt: zod_1.z.string(),
    /**
     * Stream profiles, when the camera lists them without credentials. Paths
     * only: some cameras put the password in the stream URI's query string, and
     * the hub must strip it before anything leaves the LAN.
     *
     * No codec, on purpose. ONVIF encoder config has been seen to report H264
     * for an HEVC stream; the heartbeat carries the codec MediaMTX actually got.
     */
    profiles: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        rtspPort: zod_1.z.number().int().positive().optional(),
        rtspPath: zod_1.z.string(),
        width: zod_1.z.number().int().positive().optional(),
        height: zod_1.z.number().int().positive().optional(),
    }))
        .optional(),
});
/** Everything the API tells the hub about how to behave. Sent whole, never patched. */
exports.hubConfigSchema = zod_1.z.object({
    playingAreaId: zod_1.z.string().nullable(),
    heartbeatSeconds: zod_1.z.number().int().positive(),
    /**
     * Every peripheral registered against this hub — the authoritative set.
     *
     * The hub refuses anything not on this list at the door, so an unregistered
     * device is turned away rather than having its events queued for an owner who
     * may never register it. Cameras appear here too; `cameras` below carries the
     * extra detail needed to actually pull their video.
     */
    peripherals: zod_1.z.array(shared_1.peripheralSchema),
    cameras: zod_1.z.array(exports.cameraSchema),
    /** Shown by the placar between matches. */
    arenaName: zod_1.z.string().default(''),
});
exports.apiLinkMessages = {
    // ── hub → API ──────────────────────────────────────────────────────────────
    /** First message after the socket opens. The reply carries the full config. */
    'hub.connected': (0, envelope_1.define)(zod_1.z.object({
        firmwareVersion: zod_1.z.string(),
        lanIp: zod_1.z.string().optional(),
        peripherals: zod_1.z.array(shared_1.peripheralSchema),
    }), zod_1.z.object({
        serverTime: zod_1.z.string(),
        config: exports.hubConfigSchema,
        /** The pitch's schedule, so a reconnecting hub never waits for a push. */
        matches: zod_1.z.array(matches_1.scheduledMatchSchema),
    })),
    /**
     * Periodic liveness + status. `serverTime` in the reply is how the hub keeps
     * its clock honest: the Radxa has no RTC, so every event timestamp is
     * corrected by the offset measured here.
     */
    'hub.heartbeat': (0, envelope_1.define)(zod_1.z.object({
        lanIp: zod_1.z.string().optional(),
        queue: zod_1.z.object({
            pending: zod_1.z.number().int().nonnegative(),
            oldestAt: zod_1.z.string().optional(),
        }),
        peripherals: zod_1.z.array(zod_1.z.object({ hardwareId: zod_1.z.string(), online: zod_1.z.boolean() })),
        cameras: zod_1.z.array(zod_1.z.object({
            hardwareId: zod_1.z.string(),
            streaming: zod_1.z.boolean(),
            recording: zod_1.z.boolean(),
            /** The address the hub resolved. Diagnostics only. */
            host: zod_1.z.string().optional(),
            /** Claimed, but not found on the LAN. */
            unresolved: zod_1.z.boolean().optional(),
            /** From the tracks MediaMTX received, e.g. `H264`. */
            codec: zod_1.z.string().optional(),
        })),
    }), zod_1.z.object({ serverTime: zod_1.z.string() })),
    /**
     * Every camera on the LAN, claimed or not. Full replacement, sent on connect
     * and whenever the set or an address changes.
     */
    'hub.cameras.discovered': (0, envelope_1.define)(zod_1.z.object({ cameras: zod_1.z.array(exports.discoveredCameraSchema) }), zod_1.z.object({})),
    /** Full replacement of what is currently attached. Sent on change, not on a timer. */
    'hub.peripherals': (0, envelope_1.define)(zod_1.z.object({ peripherals: zod_1.z.array(shared_1.peripheralSchema) }), zod_1.z.object({
        accepted: zod_1.z.array(zod_1.z.object({ hardwareId: zod_1.z.string(), peripheralId: zod_1.z.string() })),
    })),
    /**
     * A peripheral event, forwarded up. `clientEventId` makes retries idempotent;
     * `occurredAt` is when the peripheral acted, not when the API received it.
     */
    'hub.event': (0, envelope_1.define)(zod_1.z.object({
        peripheralHardwareId: zod_1.z.string().min(1),
        eventType: zod_1.z.string().min(1),
        occurredAt: zod_1.z.string(),
        clientEventId: zod_1.z.string().min(1),
        /** The match active on the pitch when it happened, if any. */
        matchId: zod_1.z.string().min(1).optional(),
        data: shared_1.dataSchema.optional(),
    }), zod_1.z.object({ eventId: zod_1.z.string() })),
    /**
     * A finished recording segment needs somewhere to go. Cameras only record
     * during a match, so every segment belongs to one. `path` is
     * `{camera hardwareId}/{file}`; `segmentStartedAt` is when the segment began,
     * clock-corrected, which is how the worker cuts a match window.
     */
    'hub.upload.request': (0, envelope_1.define)(zod_1.z.object({
        path: zod_1.z.string().min(1),
        contentType: zod_1.z.string().min(1),
        bytes: zod_1.z.number().int().positive(),
        matchId: zod_1.z.string().min(1),
        segmentStartedAt: zod_1.z.string(),
    }), zod_1.z.object({
        uploadUrl: zod_1.z.string(),
        key: zod_1.z.string(),
        expiresInSeconds: zod_1.z.number().int().positive(),
    })),
    /**
     * Kickoff happened on the field: a placar hold during warmup, or warmup ran
     * out. Durable and idempotent on `clientEventId`. The reply carries the
     * kickoff time that won, which is the earliest one reported.
     */
    'hub.match.started': (0, envelope_1.define)(zod_1.z.object({
        matchId: zod_1.z.string().min(1),
        clientEventId: zod_1.z.string().min(1),
        startedAt: zod_1.z.string(),
        source: zod_1.z.enum(['PLACAR', 'TIMER']),
    }), zod_1.z.object({ matchId: zod_1.z.string(), startedAt: zod_1.z.string() })),
    /**
     * The match ran out of time. An end pressed in an app travels the other
     * way, inside `api.matches`. Durable and idempotent on `clientEventId`.
     * The reply carries no end time: an end from an app arrives via
     * `api.matches`, not through this reply.
     */
    'hub.match.ended': (0, envelope_1.define)(zod_1.z.object({
        matchId: zod_1.z.string().min(1),
        clientEventId: zod_1.z.string().min(1),
        endedAt: zod_1.z.string(),
    }), zod_1.z.object({ matchId: zod_1.z.string() })),
    /** Diagnostics. Fire-and-forget: a log must never block or fail a real operation. */
    'hub.log': (0, envelope_1.define)(zod_1.z.object({
        level: shared_1.logLevelSchema,
        message: zod_1.z.string(),
        context: shared_1.dataSchema.optional(),
    }), null),
    // ── API → hub ──────────────────────────────────────────────────────────────
    /**
     * Config changed. The hub reconciles MediaMTX to match. No ack — the next
     * heartbeat reports what actually happened, which is better evidence than
     * a "received" acknowledgement.
     */
    'api.config': (0, envelope_1.define)(exports.hubConfigSchema, null),
    /**
     * The pitch's match schedule, sent whole whenever any match on it changes
     * and every 15 minutes. No ack, for the same reason as `api.config`.
     */
    'api.matches': (0, envelope_1.define)(matches_1.matchScheduleSchema, null),
    /** Asks the hub to re-send `hub.peripherals`. */
    'api.peripherals.refresh': (0, envelope_1.define)(zod_1.z.object({}), null),
    /** Relayed down to a peripheral; the reply is that peripheral's answer. */
    'api.peripheral.command': (0, envelope_1.define)(zod_1.z.object({
        peripheralHardwareId: zod_1.z.string().min(1),
        command: zod_1.z.string().min(1),
        args: shared_1.dataSchema.optional(),
    }), zod_1.z.object({ result: zod_1.z.unknown() })),
    /**
     * Search the LAN now instead of waiting for the next scan — the app's
     * "search for cameras" button. The reply is the fresh list.
     */
    'api.cameras.discover': (0, envelope_1.define)(zod_1.z.object({}), zod_1.z.object({ cameras: zod_1.z.array(exports.discoveredCameraSchema) })),
    /** Liveness probe from an operator. */
    'api.ping': (0, envelope_1.define)(zod_1.z.object({ nonce: zod_1.z.string() }), zod_1.z.object({ nonce: zod_1.z.string(), hubTime: zod_1.z.string() })),
};
