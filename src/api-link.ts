import { z } from 'zod';
import { define, type PayloadOf, type ReplyOf } from './envelope';
import { dataSchema, logLevelSchema, peripheralSchema } from './shared';

/**
 * The hub's link to the API. The hub is the WebSocket client; the API is the
 * server. `hub.*` is sent by the hub, `api.*` by the API.
 */

/** One camera the hub should pull and record. `hardwareId` is the MediaMTX path name. */
export const cameraSchema = z.object({
  hardwareId: z.string().min(1),
  host: z.string().min(1),
  rtspPort: z.number().int().positive().default(554),
  rtspPath: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  record: z.boolean().default(true),
});
export type Camera = z.infer<typeof cameraSchema>;

/** Everything the API tells the hub about how to behave. Sent whole, never patched. */
export const hubConfigSchema = z.object({
  playingAreaId: z.string().nullable(),
  heartbeatSeconds: z.number().int().positive(),
  /**
   * Every peripheral registered against this hub — the authoritative set.
   *
   * The hub refuses anything not on this list at the door, so an unregistered
   * device is turned away rather than having its events queued for an owner who
   * may never register it. Cameras appear here too; `cameras` below carries the
   * extra detail needed to actually pull their video.
   */
  peripherals: z.array(peripheralSchema),
  cameras: z.array(cameraSchema),
});
export type HubConfig = z.infer<typeof hubConfigSchema>;

export const apiLinkMessages = {
  // ── hub → API ──────────────────────────────────────────────────────────────

  /** First message after the socket opens. The reply carries the full config. */
  'hub.connected': define(
    z.object({
      firmwareVersion: z.string(),
      lanIp: z.string().optional(),
      peripherals: z.array(peripheralSchema),
    }),
    z.object({
      serverTime: z.string(),
      config: hubConfigSchema,
    }),
  ),

  /**
   * Periodic liveness + status. `serverTime` in the reply is how the hub keeps
   * its clock honest: the Radxa has no RTC, so every event timestamp is
   * corrected by the offset measured here.
   */
  'hub.heartbeat': define(
    z.object({
      lanIp: z.string().optional(),
      queue: z.object({
        pending: z.number().int().nonnegative(),
        oldestAt: z.string().optional(),
      }),
      peripherals: z.array(
        z.object({ hardwareId: z.string(), online: z.boolean() }),
      ),
      cameras: z.array(
        z.object({
          hardwareId: z.string(),
          streaming: z.boolean(),
          recording: z.boolean(),
        }),
      ),
    }),
    z.object({ serverTime: z.string() }),
  ),

  /** Full replacement of what is currently attached. Sent on change, not on a timer. */
  'hub.peripherals': define(
    z.object({ peripherals: z.array(peripheralSchema) }),
    z.object({
      accepted: z.array(
        z.object({ hardwareId: z.string(), peripheralId: z.string() }),
      ),
    }),
  ),

  /**
   * A peripheral event, forwarded up. `clientEventId` makes retries idempotent;
   * `occurredAt` is when the peripheral acted, not when the API received it.
   */
  'hub.event': define(
    z.object({
      peripheralHardwareId: z.string().min(1),
      eventType: z.string().min(1),
      occurredAt: z.string(),
      clientEventId: z.string().min(1),
      data: dataSchema.optional(),
    }),
    z.object({ eventId: z.string() }),
  ),

  /** A finished recording segment needs somewhere to go. */
  'hub.upload.request': define(
    z.object({
      path: z.string().min(1),
      contentType: z.string().min(1),
      bytes: z.number().int().positive(),
    }),
    z.object({
      uploadUrl: z.string(),
      key: z.string(),
      expiresInSeconds: z.number().int().positive(),
    }),
  ),

  /** Diagnostics. Fire-and-forget: a log must never block or fail a real operation. */
  'hub.log': define(
    z.object({
      level: logLevelSchema,
      message: z.string(),
      context: dataSchema.optional(),
    }),
    null,
  ),

  // ── API → hub ──────────────────────────────────────────────────────────────

  /**
   * Config changed. The hub reconciles MediaMTX to match. No ack — the next
   * heartbeat reports what actually happened, which is better evidence than
   * a "received" acknowledgement.
   */
  'api.config': define(hubConfigSchema, null),

  /** Asks the hub to re-send `hub.peripherals`. */
  'api.peripherals.refresh': define(z.object({}), null),

  /** Relayed down to a peripheral; the reply is that peripheral's answer. */
  'api.peripheral.command': define(
    z.object({
      peripheralHardwareId: z.string().min(1),
      command: z.string().min(1),
      args: dataSchema.optional(),
    }),
    z.object({ result: z.unknown() }),
  ),

  /** Turn recording on or off for one camera, without changing its config. */
  'api.recording.set': define(
    z.object({ cameraHardwareId: z.string().min(1), record: z.boolean() }),
    z.object({ recording: z.boolean() }),
  ),

  /** Liveness probe from an operator. */
  'api.ping': define(
    z.object({ nonce: z.string() }),
    z.object({ nonce: z.string(), hubTime: z.string() }),
  ),
} as const;

export type ApiLinkMessages = typeof apiLinkMessages;
export type ApiLinkType = keyof ApiLinkMessages;

export type ApiLinkPayload<T extends ApiLinkType> = PayloadOf<
  ApiLinkMessages[T]
>;
export type ApiLinkReply<T extends ApiLinkType> = ReplyOf<ApiLinkMessages[T]>;

/** Types the hub may send. */
export type HubSends = Extract<ApiLinkType, `hub.${string}`>;
/** Types the API may send. */
export type ApiSends = Extract<ApiLinkType, `api.${string}`>;
