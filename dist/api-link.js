"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLinkMessages = exports.hubConfigSchema = exports.cameraSchema = void 0;
const zod_1 = require("zod");
const envelope_1 = require("./envelope");
const shared_1 = require("./shared");
/**
 * The hub's link to the API. The hub is the WebSocket client; the API is the
 * server. `hub.*` is sent by the hub, `api.*` by the API.
 */
/** One camera the hub should pull and record. `hardwareId` is the MediaMTX path name. */
exports.cameraSchema = zod_1.z.object({
    hardwareId: zod_1.z.string().min(1),
    host: zod_1.z.string().min(1),
    rtspPort: zod_1.z.number().int().positive().default(554),
    rtspPath: zod_1.z.string().min(1),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    record: zod_1.z.boolean().default(true),
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
        })),
    }), zod_1.z.object({ serverTime: zod_1.z.string() })),
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
        data: shared_1.dataSchema.optional(),
    }), zod_1.z.object({ eventId: zod_1.z.string() })),
    /** A finished recording segment needs somewhere to go. */
    'hub.upload.request': (0, envelope_1.define)(zod_1.z.object({
        path: zod_1.z.string().min(1),
        contentType: zod_1.z.string().min(1),
        bytes: zod_1.z.number().int().positive(),
    }), zod_1.z.object({
        uploadUrl: zod_1.z.string(),
        key: zod_1.z.string(),
        expiresInSeconds: zod_1.z.number().int().positive(),
    })),
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
    /** Asks the hub to re-send `hub.peripherals`. */
    'api.peripherals.refresh': (0, envelope_1.define)(zod_1.z.object({}), null),
    /** Relayed down to a peripheral; the reply is that peripheral's answer. */
    'api.peripheral.command': (0, envelope_1.define)(zod_1.z.object({
        peripheralHardwareId: zod_1.z.string().min(1),
        command: zod_1.z.string().min(1),
        args: shared_1.dataSchema.optional(),
    }), zod_1.z.object({ result: zod_1.z.unknown() })),
    /** Turn recording on or off for one camera, without changing its config. */
    'api.recording.set': (0, envelope_1.define)(zod_1.z.object({ cameraHardwareId: zod_1.z.string().min(1), record: zod_1.z.boolean() }), zod_1.z.object({ recording: zod_1.z.boolean() })),
    /** Liveness probe from an operator. */
    'api.ping': (0, envelope_1.define)(zod_1.z.object({ nonce: zod_1.z.string() }), zod_1.z.object({ nonce: zod_1.z.string(), hubTime: zod_1.z.string() })),
};
