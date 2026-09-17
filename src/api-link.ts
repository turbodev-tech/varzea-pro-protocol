import { z } from 'zod';
import { define, type PayloadOf, type ReplyOf } from './envelope';
import {
  dataSchema,
  logLevelSchema,
  macHardwareIdSchema,
  peripheralSchema,
} from './shared';
import { matchScheduleSchema, scheduledMatchSchema } from './matches';

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
export const cameraSchema = z.object({
  hardwareId: z.string().min(1),
  rtspPort: z.number().int().positive().default(554),
  rtspPath: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type Camera = z.infer<typeof cameraSchema>;

/**
 * A camera the hub found on its LAN. Seeing a camera does not register it —
 * that takes a claim in the app, which is what puts it in `cameras` above.
 */
export const discoveredCameraSchema = z.object({
  hardwareId: macHardwareIdSchema,
  /** Display form, e.g. `F0:00:06:21:CD:6E`. */
  mac: z.string(),
  /** Current address. Diagnostics only — never fed back into config. */
  host: z.string(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  firmwareVersion: z.string().optional(),
  lastSeenAt: z.string(),
  /**
   * Stream profiles, when the camera lists them without credentials. Paths
   * only: some cameras put the password in the stream URI's query string, and
   * the hub must strip it before anything leaves the LAN.
   *
   * No codec, on purpose. ONVIF encoder config has been seen to report H264
   * for an HEVC stream; the heartbeat carries the codec MediaMTX actually got.
   */
  profiles: z
    .array(
      z.object({
        name: z.string(),
        rtspPort: z.number().int().positive().optional(),
        rtspPath: z.string(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .optional(),
});
export type DiscoveredCamera = z.infer<typeof discoveredCameraSchema>;

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
  /** Shown by the placar between matches. */
  arenaName: z.string().default(''),
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
      /** The pitch's schedule, so a reconnecting hub never waits for a push. */
      matches: z.array(scheduledMatchSchema),
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
          /** The address the hub resolved. Diagnostics only. */
          host: z.string().optional(),
          /** Claimed, but not found on the LAN. */
          unresolved: z.boolean().optional(),
          /** From the tracks MediaMTX received, e.g. `H264`. */
          codec: z.string().optional(),
        }),
      ),
    }),
    z.object({ serverTime: z.string() }),
  ),

  /**
   * Every camera on the LAN, claimed or not. Full replacement, sent on connect
   * and whenever the set or an address changes.
   */
  'hub.cameras.discovered': define(
    z.object({ cameras: z.array(discoveredCameraSchema) }),
    z.object({}),
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
      /** The match active on the pitch when it happened, if any. */
      matchId: z.string().min(1).optional(),
      data: dataSchema.optional(),
    }),
    z.object({ eventId: z.string() }),
  ),

  /**
   * A finished recording segment needs somewhere to go. Cameras only record
   * during a match, so every segment belongs to one. `path` is
   * `{camera hardwareId}/{file}`; `segmentStartedAt` is when the segment began,
   * clock-corrected, which is how the worker cuts a match window.
   */
  'hub.upload.request': define(
    z.object({
      path: z.string().min(1),
      contentType: z.string().min(1),
      bytes: z.number().int().positive(),
      matchId: z.string().min(1),
      segmentStartedAt: z.string(),
    }),
    z.object({
      uploadUrl: z.string(),
      key: z.string(),
      expiresInSeconds: z.number().int().positive(),
    }),
  ),

  /**
   * Kickoff happened on the field: a placar hold during warmup, or warmup ran
   * out. Durable and idempotent on `clientEventId`. The reply carries the
   * kickoff time that won, which is the earliest one reported.
   */
  'hub.match.started': define(
    z.object({
      matchId: z.string().min(1),
      clientEventId: z.string().min(1),
      startedAt: z.string(),
      source: z.enum(['PLACAR', 'TIMER']),
    }),
    z.object({ matchId: z.string(), startedAt: z.string() }),
  ),

  /**
   * The match ran out of time. An end pressed in an app travels the other
   * way, inside `api.matches`. Durable and idempotent on `clientEventId`.
   * The reply carries no end time: an end from an app arrives via
   * `api.matches`, not through this reply.
   */
  'hub.match.ended': define(
    z.object({
      matchId: z.string().min(1),
      clientEventId: z.string().min(1),
      endedAt: z.string(),
    }),
    z.object({ matchId: z.string() }),
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

  /**
   * The pitch's match schedule, sent whole whenever any match on it changes
   * and every 15 minutes. No ack, for the same reason as `api.config`.
   */
  'api.matches': define(matchScheduleSchema, null),

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

  /**
   * Search the LAN now instead of waiting for the next scan — the app's
   * "search for cameras" button. The reply is the fresh list.
   */
  'api.cameras.discover': define(
    z.object({}),
    z.object({ cameras: z.array(discoveredCameraSchema) }),
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
