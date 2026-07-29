"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.define = exports.replyTypes = exports.SENDERS = exports.errorPayloadSchema = exports.envelopeSchema = exports.PROTOCOL_VERSION = void 0;
const zod_1 = require("zod");
/** Bumped only on breaking wire changes. Both ends reject a mismatch. */
exports.PROTOCOL_VERSION = 1;
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
exports.envelopeSchema = zod_1.z.object({
    v: zod_1.z.literal(exports.PROTOCOL_VERSION),
    id: zod_1.z.string().min(1),
    type: zod_1.z.string().min(1),
    /**
     * Sender's clock when the message was written, ISO-8601.
     *
     * Optional because not every sender has one. An ESP32 has no real-time clock
     * and cannot produce a real timestamp, so it omits the field rather than
     * inventing a value that reads like a date and is not. Nothing depends on it:
     * it exists to make a captured frame self-describing, and event times are
     * carried explicitly by the messages that need them.
     */
    sentAt: zod_1.z.string().optional(),
    replyTo: zod_1.z.string().min(1).optional(),
    payload: zod_1.z.unknown(),
});
/** Payload of every `*.error` reply. */
exports.errorPayloadSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
});
/** The three actors. A message type's prefix is always one of these. */
exports.SENDERS = ['hub', 'api', 'peripheral'];
const replyTypes = (sender) => ({ ok: `${sender}.ok`, error: `${sender}.error` });
exports.replyTypes = replyTypes;
const define = (payload, reply) => ({ payload, reply });
exports.define = define;
