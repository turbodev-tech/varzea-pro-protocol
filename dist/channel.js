"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = exports.ProtocolError = void 0;
const envelope_1 = require("./envelope");
class ProtocolError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ProtocolError';
    }
}
exports.ProtocolError = ProtocolError;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
class Channel {
    options;
    pending = new Map();
    handlers = new Map();
    ok;
    error;
    timeoutMs;
    nextId = 0;
    constructor(options) {
        this.options = options;
        const { ok, error } = (0, envelope_1.replyTypes)(options.sender);
        this.ok = ok;
        this.error = error;
        this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    }
    /** Handle a message the other side sends us. One handler per type. */
    on(type, handler) {
        this.handlers.set(type, handler);
        return this;
    }
    /** Send a message that expects no reply. Returns as soon as it is written. */
    tell(type, payload) {
        this.write({
            id: this.mintId(),
            type,
            payload: this.spec(type).payload.parse(payload),
        });
    }
    /** Send a message and wait for the other side's reply. */
    async ask(type, payload) {
        const id = this.mintId();
        const body = this.spec(type).payload.parse(payload);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new ProtocolError('timeout', `"${type}" got no reply in ${this.timeoutMs}ms`));
            }, this.timeoutMs);
            this.pending.set(id, {
                resolve: resolve,
                reject,
                timer,
                type,
            });
            try {
                this.write({ id, type, payload: body });
            }
            catch (cause) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(cause instanceof Error ? cause : new Error(String(cause)));
            }
        });
    }
    /** Feed one inbound frame. Never throws — bad input produces an error reply. */
    receive(text) {
        let raw;
        try {
            raw = JSON.parse(text);
        }
        catch {
            this.warn('Discarded a frame that was not JSON.');
            return;
        }
        const envelope = envelope_1.envelopeSchema.safeParse(raw);
        if (!envelope.success) {
            this.warn(`Discarded a malformed envelope: ${issues(envelope.error)}`);
            return;
        }
        const { id, type, replyTo, payload } = envelope.data;
        if (replyTo) {
            this.settle(replyTo, type, payload);
            return;
        }
        void this.dispatch(id, type, payload);
    }
    /**
     * Reject everything still in flight. Call on disconnect so callers fail fast
     * instead of waiting out a timeout against a socket that is already gone.
     */
    failPending(reason) {
        for (const [, entry] of this.pending) {
            clearTimeout(entry.timer);
            entry.reject(new ProtocolError('disconnected', reason));
        }
        this.pending.clear();
    }
    get pendingCount() {
        return this.pending.size;
    }
    // ── internals ──────────────────────────────────────────────────────────────
    /** Matches a reply to the request that is waiting for it. */
    settle(replyTo, type, payload) {
        const entry = this.pending.get(replyTo);
        if (!entry) {
            this.warn(`Reply "${type}" matched no pending request (${replyTo}).`);
            return;
        }
        clearTimeout(entry.timer);
        this.pending.delete(replyTo);
        if (type.endsWith('.error')) {
            const parsed = envelope_1.errorPayloadSchema.safeParse(payload);
            entry.reject(parsed.success
                ? new ProtocolError(parsed.data.code, parsed.data.message)
                : new ProtocolError('unknown', `"${entry.type}" failed`));
            return;
        }
        const reply = this.options.messages[entry.type]?.reply;
        if (!reply) {
            entry.resolve(undefined);
            return;
        }
        const parsed = reply.safeParse(payload);
        if (!parsed.success) {
            entry.reject(new ProtocolError('invalid_reply', `Reply to "${entry.type}" did not match its schema: ${issues(parsed.error)}`));
            return;
        }
        entry.resolve(parsed.data);
    }
    /** Runs our handler for an inbound request and answers with ok or error. */
    async dispatch(id, type, payload) {
        const spec = this.options.messages[type];
        if (!spec) {
            this.fail(id, 'unknown_type', `This end does not know "${type}".`);
            return;
        }
        const handler = this.handlers.get(type);
        if (!handler) {
            this.fail(id, 'unhandled', `Nothing is listening for "${type}".`);
            return;
        }
        const parsed = spec.payload.safeParse(payload);
        if (!parsed.success) {
            this.fail(id, 'invalid_payload', `"${type}": ${issues(parsed.error)}`);
            return;
        }
        try {
            const result = (await handler(parsed.data));
            // Fire-and-forget messages are not answered at all; replying would leave
            // an orphan the sender has no pending entry for.
            if (spec.reply) {
                this.write({ id: this.mintId(), type: this.ok, replyTo: id, payload: result });
            }
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            const code = cause instanceof ProtocolError ? cause.code : 'handler_failed';
            this.fail(id, code, message);
        }
    }
    fail(replyTo, code, message) {
        this.write({
            id: this.mintId(),
            type: this.error,
            replyTo,
            payload: { code, message },
        });
    }
    spec(type) {
        const spec = this.options.messages[type];
        if (!spec) {
            throw new ProtocolError('unknown_type', `"${type}" is not in the message table.`);
        }
        return spec;
    }
    write(message) {
        this.options.send(JSON.stringify({
            v: envelope_1.PROTOCOL_VERSION,
            sentAt: new Date().toISOString(),
            ...message,
        }));
    }
    mintId() {
        this.nextId += 1;
        return `${this.options.sender}-${Date.now().toString(36)}-${this.nextId}`;
    }
    warn(message) {
        this.options.onWarning?.(message);
    }
}
exports.Channel = Channel;
const issues = (error) => error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
