import { z } from 'zod';
import {
  envelopeSchema,
  errorPayloadSchema,
  PROTOCOL_VERSION,
  replyTypes,
  type MessageSpec,
  type PayloadOf,
  type ReplyOf,
  type Sender,
} from './envelope';

/**
 * Speaks the protocol over any two-way text transport.
 *
 * Deliberately knows nothing about WebSockets: it is handed a `send` function
 * and fed inbound frames through `receive`. That keeps correlation, timeouts
 * and validation — the parts that are easy to get subtly wrong — in one tested
 * place, shared by the API and the hub instead of hand-rolled on each side.
 */

export type MessageTable = Record<string, MessageSpec>;

/** Types this actor may send: exactly those prefixed with its own name. */
type Sendable<M extends MessageTable, S extends Sender> = Extract<
  keyof M & string,
  `${S}.${string}`
>;

/** Types this actor may receive: everything the other side sends. */
type Receivable<M extends MessageTable, S extends Sender> = Exclude<
  keyof M & string,
  `${S}.${string}`
>;

/**
 * Sendable messages that do not expect a reply. Awaiting one is a compile error.
 *
 * `Exclude` rather than a bare mapped type so TypeScript prints the resolved
 * union in error messages — a developer who picks the wrong verb is told which
 * message names are actually valid, instead of getting the whole table dumped.
 */
type Tells<M extends MessageTable, S extends Sender> = Exclude<
  {
    [K in Sendable<M, S>]: M[K]['reply'] extends null ? K : never;
  }[Sendable<M, S>],
  never
>;

/** Sendable messages that expect a reply. */
type Asks<M extends MessageTable, S extends Sender> = Exclude<
  Sendable<M, S>,
  Tells<M, S>
>;

export type Handler<M extends MessageTable, T extends keyof M & string> = (
  payload: PayloadOf<M[T]>,
) => ReplyOf<M[T]> | Promise<ReplyOf<M[T]>>;

export class ProtocolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export interface ChannelOptions<M extends MessageTable, S extends Sender> {
  /** The message table this channel speaks. */
  messages: M;
  /** Which actor we are. Determines what we may send and how we label replies. */
  sender: S;
  /** Write one frame to the wire. */
  send: (text: string) => void;
  /** How long to wait for a reply before giving up. */
  requestTimeoutMs?: number;
  /** Called for frames we could not answer — bad JSON, unknown type, our own bugs. */
  onWarning?: (message: string) => void;
}

interface Pending {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  type: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export class Channel<M extends MessageTable, S extends Sender> {
  private readonly pending = new Map<string, Pending>();
  private readonly handlers = new Map<string, Handler<M, never>>();
  private readonly ok: string;
  private readonly error: string;
  private readonly timeoutMs: number;
  private nextId = 0;

  constructor(private readonly options: ChannelOptions<M, S>) {
    const { ok, error } = replyTypes(options.sender);
    this.ok = ok;
    this.error = error;
    this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /** Handle a message the other side sends us. One handler per type. */
  on<T extends Receivable<M, S>>(type: T, handler: Handler<M, T>): this {
    this.handlers.set(type, handler as Handler<M, never>);
    return this;
  }

  /** Send a message that expects no reply. Returns as soon as it is written. */
  tell<T extends Tells<M, S>>(type: T, payload: PayloadOf<M[T]>): void {
    this.write({
      id: this.mintId(),
      type,
      payload: this.spec(type).payload.parse(payload),
    });
  }

  /** Send a message and wait for the other side's reply. */
  async ask<T extends Asks<M, S>>(
    type: T,
    payload: PayloadOf<M[T]>,
  ): Promise<ReplyOf<M[T]>> {
    const id = this.mintId();
    const body = this.spec(type).payload.parse(payload);

    return new Promise<ReplyOf<M[T]>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new ProtocolError('timeout', `"${type}" got no reply in ${this.timeoutMs}ms`),
        );
      }, this.timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (payload: unknown) => void,
        reject,
        timer,
        type,
      });

      try {
        this.write({ id, type, payload: body });
      } catch (cause) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
  }

  /** Feed one inbound frame. Never throws — bad input produces an error reply. */
  receive(text: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      this.warn('Discarded a frame that was not JSON.');
      return;
    }

    const envelope = envelopeSchema.safeParse(raw);
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
  failPending(reason: string): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new ProtocolError('disconnected', reason));
    }
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Matches a reply to the request that is waiting for it. */
  private settle(replyTo: string, type: string, payload: unknown): void {
    const entry = this.pending.get(replyTo);
    if (!entry) {
      this.warn(`Reply "${type}" matched no pending request (${replyTo}).`);
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(replyTo);

    if (type.endsWith('.error')) {
      const parsed = errorPayloadSchema.safeParse(payload);
      entry.reject(
        parsed.success
          ? new ProtocolError(parsed.data.code, parsed.data.message)
          : new ProtocolError('unknown', `"${entry.type}" failed`),
      );
      return;
    }

    const reply = this.options.messages[entry.type]?.reply;
    if (!reply) {
      entry.resolve(undefined);
      return;
    }
    const parsed = reply.safeParse(payload);
    if (!parsed.success) {
      entry.reject(
        new ProtocolError(
          'invalid_reply',
          `Reply to "${entry.type}" did not match its schema: ${issues(parsed.error)}`,
        ),
      );
      return;
    }
    entry.resolve(parsed.data);
  }

  /** Runs our handler for an inbound request and answers with ok or error. */
  private async dispatch(
    id: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
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
      const result = (await handler(parsed.data as never)) as unknown;
      // Fire-and-forget messages are not answered at all; replying would leave
      // an orphan the sender has no pending entry for.
      if (spec.reply) {
        this.write({ id: this.mintId(), type: this.ok, replyTo: id, payload: result });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const code = cause instanceof ProtocolError ? cause.code : 'handler_failed';
      this.fail(id, code, message);
    }
  }

  private fail(replyTo: string, code: string, message: string): void {
    this.write({
      id: this.mintId(),
      type: this.error,
      replyTo,
      payload: { code, message },
    });
  }

  private spec(type: string): MessageSpec {
    const spec = this.options.messages[type];
    if (!spec) {
      throw new ProtocolError('unknown_type', `"${type}" is not in the message table.`);
    }
    return spec;
  }

  private write(message: {
    id: string;
    type: string;
    replyTo?: string;
    payload: unknown;
  }): void {
    this.options.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        sentAt: new Date().toISOString(),
        ...message,
      }),
    );
  }

  private mintId(): string {
    this.nextId += 1;
    return `${this.options.sender}-${Date.now().toString(36)}-${this.nextId}`;
  }

  private warn(message: string): void {
    this.options.onWarning?.(message);
  }
}

const issues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
