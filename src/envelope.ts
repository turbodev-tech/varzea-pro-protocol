import { z } from 'zod';

/** Bumped only on breaking wire changes. Both ends reject a mismatch. */
export const PROTOCOL_VERSION = 1;

/**
 * Every message on every link uses this envelope.
 *
 * The `type` prefix is always the sender: `hub.*` is sent by the hub, `api.*`
 * by the API, `peripheral.*` by a peripheral. A log line tells you which way
 * the message went without consulting a table.
 *
 * A message is either a request (no `replyTo`) or a reply (`replyTo` holds the
 * request's `id`). Replies are always `<sender>.ok` or `<sender>.error` — there
 * is no per-message ack type.
 */
export const envelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: z.string().min(1),
  type: z.string().min(1),
  /** Sender's clock when the message was written, ISO-8601. */
  sentAt: z.string(),
  replyTo: z.string().min(1).optional(),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof envelopeSchema>;

/** Payload of every `*.error` reply. */
export const errorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

/** The three actors. A message type's prefix is always one of these. */
export const SENDERS = ['hub', 'api', 'peripheral'] as const;
export type Sender = (typeof SENDERS)[number];

export const replyTypes = (sender: Sender) =>
  ({ ok: `${sender}.ok`, error: `${sender}.error` }) as const;

/**
 * One message: the schema of its payload, and the schema of the reply it
 * expects. `reply: null` means fire-and-forget — the sender must not wait.
 */
export interface MessageSpec<
  Payload extends z.ZodType = z.ZodType,
  Reply extends z.ZodType | null = z.ZodType | null,
> {
  payload: Payload;
  reply: Reply;
}

export const define = <P extends z.ZodType, R extends z.ZodType | null>(
  payload: P,
  reply: R,
): MessageSpec<P, R> => ({ payload, reply });

export type PayloadOf<S> =
  S extends MessageSpec<infer P, z.ZodType | null> ? z.infer<P> : never;

export type ReplyOf<S> =
  S extends MessageSpec<z.ZodType, infer R>
    ? R extends z.ZodType
      ? z.infer<R>
      : void
    : never;
