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
    /** Relayed from `api.peripheral.command`. The reply travels back up unchanged. */
    readonly 'hub.command': import("./envelope").MessageSpec<z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        result: z.ZodUnknown;
    }, z.core.$strip>>;
};
export type PeripheralLinkMessages = typeof peripheralLinkMessages;
export type PeripheralLinkType = keyof PeripheralLinkMessages;
export type PeripheralLinkPayload<T extends PeripheralLinkType> = PayloadOf<PeripheralLinkMessages[T]>;
export type PeripheralLinkReply<T extends PeripheralLinkType> = ReplyOf<PeripheralLinkMessages[T]>;
/** Types a peripheral may send. */
export type PeripheralSends = Extract<PeripheralLinkType, `peripheral.${string}`>;
/** Types the hub may send on this link. */
export type HubSendsToPeripheral = Extract<PeripheralLinkType, `hub.${string}`>;
