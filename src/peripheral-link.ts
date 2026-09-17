import { z } from 'zod';
import { define, type PayloadOf, type ReplyOf } from './envelope';
import { dataSchema, peripheralTypeSchema } from './shared';
import { displayStateSchema } from './matches';

/**
 * The LAN link between field peripherals and the hub. Peripherals are the
 * WebSocket clients; the hub is the server. `peripheral.*` is sent by a
 * peripheral, `hub.*` by the hub.
 *
 * This is the same envelope and the same reply rule as the API link, so an
 * ESP32 and the API speak recognisably the same language.
 */
export const peripheralLinkMessages = {
  // ── peripheral → hub ───────────────────────────────────────────────────────

  /**
   * First message after connecting. Until this is accepted the hub ignores
   * everything else from the socket.
   */
  'peripheral.connected': define(
    z.object({
      hardwareId: z.string().min(1),
      type: peripheralTypeSchema,
      firmwareVersion: z.string(),
      label: z.string().optional(),
    }),
    z.object({
      hubTime: z.string(),
      heartbeatSeconds: z.number().int().positive(),
    }),
  ),

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
  'peripheral.event': define(
    z.object({
      eventType: z.string().min(1),
      clientEventId: z.string().min(1),
      ageMs: z.number().int().nonnegative(),
      data: dataSchema.optional(),
    }),
    z.object({ clientEventId: z.string() }),
  ),

  /** Keeps the hub's view of this peripheral marked online. */
  'peripheral.heartbeat': define(
    z.object({}),
    z.object({ hubTime: z.string() }),
  ),

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
  'peripheral.match.start': define(
    z.object({
      clientEventId: z.string().min(1),
      ageMs: z.number().int().nonnegative(),
    }),
    z.object({ matchId: z.string().optional(), started: z.boolean() }),
  ),

  // ── hub → peripheral ───────────────────────────────────────────────────────

  /** Relayed from `api.peripheral.command`. The reply travels back up unchanged. */
  'hub.command': define(
    z.object({ command: z.string().min(1), args: dataSchema.optional() }),
    z.object({ result: z.unknown() }),
  ),

  /** What to draw. Sent on every change and right after `peripheral.connected`. */
  'hub.display': define(displayStateSchema, null),
} as const;

export type PeripheralLinkMessages = typeof peripheralLinkMessages;
export type PeripheralLinkType = keyof PeripheralLinkMessages;

export type PeripheralLinkPayload<T extends PeripheralLinkType> = PayloadOf<
  PeripheralLinkMessages[T]
>;
export type PeripheralLinkReply<T extends PeripheralLinkType> = ReplyOf<
  PeripheralLinkMessages[T]
>;

/** Types a peripheral may send. */
export type PeripheralSends = Extract<
  PeripheralLinkType,
  `peripheral.${string}`
>;
/** Types the hub may send on this link. */
export type HubSendsToPeripheral = Extract<PeripheralLinkType, `hub.${string}`>;
