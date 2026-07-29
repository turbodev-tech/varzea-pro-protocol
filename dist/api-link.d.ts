import { z } from 'zod';
import { type PayloadOf, type ReplyOf } from './envelope';
/**
 * The hub's link to the API. The hub is the WebSocket client; the API is the
 * server. `hub.*` is sent by the hub, `api.*` by the API.
 */
/** One camera the hub should pull and record. `hardwareId` is the MediaMTX path name. */
export declare const cameraSchema: z.ZodObject<{
    hardwareId: z.ZodString;
    host: z.ZodString;
    rtspPort: z.ZodDefault<z.ZodNumber>;
    rtspPath: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    record: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type Camera = z.infer<typeof cameraSchema>;
/** Everything the API tells the hub about how to behave. Sent whole, never patched. */
export declare const hubConfigSchema: z.ZodObject<{
    playingAreaId: z.ZodNullable<z.ZodString>;
    heartbeatSeconds: z.ZodNumber;
    cameras: z.ZodArray<z.ZodObject<{
        hardwareId: z.ZodString;
        host: z.ZodString;
        rtspPort: z.ZodDefault<z.ZodNumber>;
        rtspPath: z.ZodString;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        record: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type HubConfig = z.infer<typeof hubConfigSchema>;
export declare const apiLinkMessages: {
    /** First message after the socket opens. The reply carries the full config. */
    readonly 'hub.connected': import("./envelope").MessageSpec<z.ZodObject<{
        firmwareVersion: z.ZodString;
        lanIp: z.ZodOptional<z.ZodString>;
        peripherals: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            type: z.ZodEnum<{
                CAMERA: "CAMERA";
                PLACAR: "PLACAR";
            }>;
            label: z.ZodOptional<z.ZodString>;
            firmwareVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        serverTime: z.ZodString;
        config: z.ZodObject<{
            playingAreaId: z.ZodNullable<z.ZodString>;
            heartbeatSeconds: z.ZodNumber;
            cameras: z.ZodArray<z.ZodObject<{
                hardwareId: z.ZodString;
                host: z.ZodString;
                rtspPort: z.ZodDefault<z.ZodNumber>;
                rtspPath: z.ZodString;
                username: z.ZodOptional<z.ZodString>;
                password: z.ZodOptional<z.ZodString>;
                record: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    /**
     * Periodic liveness + status. `serverTime` in the reply is how the hub keeps
     * its clock honest: the Radxa has no RTC, so every event timestamp is
     * corrected by the offset measured here.
     */
    readonly 'hub.heartbeat': import("./envelope").MessageSpec<z.ZodObject<{
        lanIp: z.ZodOptional<z.ZodString>;
        queue: z.ZodObject<{
            pending: z.ZodNumber;
            oldestAt: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        peripherals: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            online: z.ZodBoolean;
        }, z.core.$strip>>;
        cameras: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            streaming: z.ZodBoolean;
            recording: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        serverTime: z.ZodString;
    }, z.core.$strip>>;
    /** Full replacement of what is currently attached. Sent on change, not on a timer. */
    readonly 'hub.peripherals': import("./envelope").MessageSpec<z.ZodObject<{
        peripherals: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            type: z.ZodEnum<{
                CAMERA: "CAMERA";
                PLACAR: "PLACAR";
            }>;
            label: z.ZodOptional<z.ZodString>;
            firmwareVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        accepted: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            peripheralId: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    /**
     * A peripheral event, forwarded up. `clientEventId` makes retries idempotent;
     * `occurredAt` is when the peripheral acted, not when the API received it.
     */
    readonly 'hub.event': import("./envelope").MessageSpec<z.ZodObject<{
        peripheralHardwareId: z.ZodString;
        eventType: z.ZodString;
        occurredAt: z.ZodString;
        clientEventId: z.ZodString;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>>;
    /** A finished recording segment needs somewhere to go. */
    readonly 'hub.upload.request': import("./envelope").MessageSpec<z.ZodObject<{
        path: z.ZodString;
        contentType: z.ZodString;
        bytes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        uploadUrl: z.ZodString;
        key: z.ZodString;
        expiresInSeconds: z.ZodNumber;
    }, z.core.$strip>>;
    /** Diagnostics. Fire-and-forget: a log must never block or fail a real operation. */
    readonly 'hub.log': import("./envelope").MessageSpec<z.ZodObject<{
        level: z.ZodEnum<{
            error: "error";
            debug: "debug";
            info: "info";
            warn: "warn";
        }>;
        message: z.ZodString;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, null>;
    /**
     * Config changed. The hub reconciles MediaMTX to match. No ack — the next
     * heartbeat reports what actually happened, which is better evidence than
     * a "received" acknowledgement.
     */
    readonly 'api.config': import("./envelope").MessageSpec<z.ZodObject<{
        playingAreaId: z.ZodNullable<z.ZodString>;
        heartbeatSeconds: z.ZodNumber;
        cameras: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            host: z.ZodString;
            rtspPort: z.ZodDefault<z.ZodNumber>;
            rtspPath: z.ZodString;
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
            record: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, null>;
    /** Asks the hub to re-send `hub.peripherals`. */
    readonly 'api.peripherals.refresh': import("./envelope").MessageSpec<z.ZodObject<{}, z.core.$strip>, null>;
    /** Relayed down to a peripheral; the reply is that peripheral's answer. */
    readonly 'api.peripheral.command': import("./envelope").MessageSpec<z.ZodObject<{
        peripheralHardwareId: z.ZodString;
        command: z.ZodString;
        args: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        result: z.ZodUnknown;
    }, z.core.$strip>>;
    /** Turn recording on or off for one camera, without changing its config. */
    readonly 'api.recording.set': import("./envelope").MessageSpec<z.ZodObject<{
        cameraHardwareId: z.ZodString;
        record: z.ZodBoolean;
    }, z.core.$strip>, z.ZodObject<{
        recording: z.ZodBoolean;
    }, z.core.$strip>>;
    /** Liveness probe from an operator. */
    readonly 'api.ping': import("./envelope").MessageSpec<z.ZodObject<{
        nonce: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        nonce: z.ZodString;
        hubTime: z.ZodString;
    }, z.core.$strip>>;
};
export type ApiLinkMessages = typeof apiLinkMessages;
export type ApiLinkType = keyof ApiLinkMessages;
export type ApiLinkPayload<T extends ApiLinkType> = PayloadOf<ApiLinkMessages[T]>;
export type ApiLinkReply<T extends ApiLinkType> = ReplyOf<ApiLinkMessages[T]>;
/** Types the hub may send. */
export type HubSends = Extract<ApiLinkType, `hub.${string}`>;
/** Types the API may send. */
export type ApiSends = Extract<ApiLinkType, `api.${string}`>;
