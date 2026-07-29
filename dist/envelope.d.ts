import { z } from 'zod';
/** Bumped only on breaking wire changes. Both ends reject a mismatch. */
export declare const PROTOCOL_VERSION = 1;
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
export declare const envelopeSchema: z.ZodObject<{
    v: z.ZodLiteral<1>;
    id: z.ZodString;
    type: z.ZodString;
    sentAt: z.ZodOptional<z.ZodString>;
    replyTo: z.ZodOptional<z.ZodString>;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export type Envelope = z.infer<typeof envelopeSchema>;
/** Payload of every `*.error` reply. */
export declare const errorPayloadSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;
/** The three actors. A message type's prefix is always one of these. */
export declare const SENDERS: readonly ["hub", "api", "peripheral"];
export type Sender = (typeof SENDERS)[number];
export declare const replyTypes: (sender: Sender) => {
    readonly ok: "hub.ok" | "api.ok" | "peripheral.ok";
    readonly error: "hub.error" | "api.error" | "peripheral.error";
};
/**
 * One message: the schema of its payload, and the schema of the reply it
 * expects. `reply: null` means fire-and-forget — the sender must not wait.
 */
export interface MessageSpec<Payload extends z.ZodType = z.ZodType, Reply extends z.ZodType | null = z.ZodType | null> {
    payload: Payload;
    reply: Reply;
}
export declare const define: <P extends z.ZodType, R extends z.ZodType | null>(payload: P, reply: R) => MessageSpec<P, R>;
export type PayloadOf<S> = S extends MessageSpec<infer P, z.ZodType | null> ? z.infer<P> : never;
export type ReplyOf<S> = S extends MessageSpec<z.ZodType, infer R> ? R extends z.ZodType ? z.infer<R> : void : never;
