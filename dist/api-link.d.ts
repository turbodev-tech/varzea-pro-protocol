import { z } from 'zod';
import { type PayloadOf, type ReplyOf } from './envelope';
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
export declare const cameraSchema: z.ZodObject<{
    hardwareId: z.ZodString;
    rtspPort: z.ZodDefault<z.ZodNumber>;
    rtspPath: z.ZodString;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Camera = z.infer<typeof cameraSchema>;
/**
 * A camera the hub found on its LAN. Seeing a camera does not register it —
 * that takes a claim in the app, which is what puts it in `cameras` above.
 */
export declare const discoveredCameraSchema: z.ZodObject<{
    hardwareId: z.ZodString;
    mac: z.ZodString;
    host: z.ZodString;
    manufacturer: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
    lastSeenAt: z.ZodString;
    profiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        rtspPort: z.ZodOptional<z.ZodNumber>;
        rtspPath: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type DiscoveredCamera = z.infer<typeof discoveredCameraSchema>;
/** Everything the API tells the hub about how to behave. Sent whole, never patched. */
export declare const hubConfigSchema: z.ZodObject<{
    playingAreaId: z.ZodNullable<z.ZodString>;
    heartbeatSeconds: z.ZodNumber;
    peripherals: z.ZodArray<z.ZodObject<{
        hardwareId: z.ZodString;
        type: z.ZodEnum<{
            CAMERA: "CAMERA";
            PLACAR: "PLACAR";
        }>;
        label: z.ZodOptional<z.ZodString>;
        firmwareVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    cameras: z.ZodArray<z.ZodObject<{
        hardwareId: z.ZodString;
        rtspPort: z.ZodDefault<z.ZodNumber>;
        rtspPath: z.ZodString;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    arenaName: z.ZodDefault<z.ZodString>;
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
            peripherals: z.ZodArray<z.ZodObject<{
                hardwareId: z.ZodString;
                type: z.ZodEnum<{
                    CAMERA: "CAMERA";
                    PLACAR: "PLACAR";
                }>;
                label: z.ZodOptional<z.ZodString>;
                firmwareVersion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            cameras: z.ZodArray<z.ZodObject<{
                hardwareId: z.ZodString;
                rtspPort: z.ZodDefault<z.ZodNumber>;
                rtspPath: z.ZodString;
                username: z.ZodOptional<z.ZodString>;
                password: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            arenaName: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>;
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
            host: z.ZodOptional<z.ZodString>;
            unresolved: z.ZodOptional<z.ZodBoolean>;
            codec: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        serverTime: z.ZodString;
    }, z.core.$strip>>;
    /**
     * Every camera on the LAN, claimed or not. Full replacement, sent on connect
     * and whenever the set or an address changes.
     */
    readonly 'hub.cameras.discovered': import("./envelope").MessageSpec<z.ZodObject<{
        cameras: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            mac: z.ZodString;
            host: z.ZodString;
            manufacturer: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            firmwareVersion: z.ZodOptional<z.ZodString>;
            lastSeenAt: z.ZodString;
            profiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                rtspPort: z.ZodOptional<z.ZodNumber>;
                rtspPath: z.ZodString;
                width: z.ZodOptional<z.ZodNumber>;
                height: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{}, z.core.$strip>>;
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
        matchId: z.ZodOptional<z.ZodString>;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>>;
    /**
     * A finished recording segment needs somewhere to go. Cameras only record
     * during a match, so every segment belongs to one. `path` is
     * `{camera hardwareId}/{file}`; `segmentStartedAt` is when the segment began,
     * clock-corrected, which is how the worker cuts a match window.
     */
    readonly 'hub.upload.request': import("./envelope").MessageSpec<z.ZodObject<{
        path: z.ZodString;
        contentType: z.ZodString;
        bytes: z.ZodNumber;
        matchId: z.ZodString;
        segmentStartedAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        uploadUrl: z.ZodString;
        key: z.ZodString;
        expiresInSeconds: z.ZodNumber;
    }, z.core.$strip>>;
    /**
     * Kickoff happened on the field: a placar hold during warmup, or warmup ran
     * out. Durable and idempotent on `clientEventId`. The reply carries the
     * kickoff time that won, which is the earliest one reported.
     */
    readonly 'hub.match.started': import("./envelope").MessageSpec<z.ZodObject<{
        matchId: z.ZodString;
        clientEventId: z.ZodString;
        startedAt: z.ZodString;
        source: z.ZodEnum<{
            PLACAR: "PLACAR";
            TIMER: "TIMER";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        matchId: z.ZodString;
        startedAt: z.ZodString;
    }, z.core.$strip>>;
    /**
     * The match ran out of time. An end pressed in an app travels the other
     * way, inside `api.matches`. Durable and idempotent on `clientEventId`.
     */
    readonly 'hub.match.ended': import("./envelope").MessageSpec<z.ZodObject<{
        matchId: z.ZodString;
        clientEventId: z.ZodString;
        endedAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        matchId: z.ZodString;
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
        peripherals: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            type: z.ZodEnum<{
                CAMERA: "CAMERA";
                PLACAR: "PLACAR";
            }>;
            label: z.ZodOptional<z.ZodString>;
            firmwareVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        cameras: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            rtspPort: z.ZodDefault<z.ZodNumber>;
            rtspPath: z.ZodString;
            username: z.ZodOptional<z.ZodString>;
            password: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        arenaName: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>, null>;
    /**
     * The pitch's match schedule, sent whole whenever any match on it changes
     * and every 15 minutes. No ack, for the same reason as `api.config`.
     */
    readonly 'api.matches': import("./envelope").MessageSpec<z.ZodObject<{
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
    /**
     * Search the LAN now instead of waiting for the next scan — the app's
     * "search for cameras" button. The reply is the fresh list.
     */
    readonly 'api.cameras.discover': import("./envelope").MessageSpec<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        cameras: z.ZodArray<z.ZodObject<{
            hardwareId: z.ZodString;
            mac: z.ZodString;
            host: z.ZodString;
            manufacturer: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            firmwareVersion: z.ZodOptional<z.ZodString>;
            lastSeenAt: z.ZodString;
            profiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                rtspPort: z.ZodOptional<z.ZodNumber>;
                rtspPath: z.ZodString;
                width: z.ZodOptional<z.ZodNumber>;
                height: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
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
