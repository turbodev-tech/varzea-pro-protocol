import { type MessageSpec, type PayloadOf, type ReplyOf, type Sender } from './envelope';
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
type Sendable<M extends MessageTable, S extends Sender> = Extract<keyof M & string, `${S}.${string}`>;
/** Types this actor may receive: everything the other side sends. */
type Receivable<M extends MessageTable, S extends Sender> = Exclude<keyof M & string, `${S}.${string}`>;
/**
 * Sendable messages that do not expect a reply. Awaiting one is a compile error.
 *
 * `Exclude` rather than a bare mapped type so TypeScript prints the resolved
 * union in error messages — a developer who picks the wrong verb is told which
 * message names are actually valid, instead of getting the whole table dumped.
 */
type Tells<M extends MessageTable, S extends Sender> = Exclude<{
    [K in Sendable<M, S>]: M[K]['reply'] extends null ? K : never;
}[Sendable<M, S>], never>;
/** Sendable messages that expect a reply. */
type Asks<M extends MessageTable, S extends Sender> = Exclude<Sendable<M, S>, Tells<M, S>>;
export type Handler<M extends MessageTable, T extends keyof M & string> = (payload: PayloadOf<M[T]>) => ReplyOf<M[T]> | Promise<ReplyOf<M[T]>>;
export declare class ProtocolError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
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
export declare class Channel<M extends MessageTable, S extends Sender> {
    private readonly options;
    private readonly pending;
    private readonly handlers;
    private readonly ok;
    private readonly error;
    private readonly timeoutMs;
    private nextId;
    constructor(options: ChannelOptions<M, S>);
    /** Handle a message the other side sends us. One handler per type. */
    on<T extends Receivable<M, S>>(type: T, handler: Handler<M, T>): this;
    /** Send a message that expects no reply. Returns as soon as it is written. */
    tell<T extends Tells<M, S>>(type: T, payload: PayloadOf<M[T]>): void;
    /** Send a message and wait for the other side's reply. */
    ask<T extends Asks<M, S>>(type: T, payload: PayloadOf<M[T]>): Promise<ReplyOf<M[T]>>;
    /** Feed one inbound frame. Never throws — bad input produces an error reply. */
    receive(text: string): void;
    /**
     * Reject everything still in flight. Call on disconnect so callers fail fast
     * instead of waiting out a timeout against a socket that is already gone.
     */
    failPending(reason: string): void;
    get pendingCount(): number;
    /** Matches a reply to the request that is waiting for it. */
    private settle;
    /** Runs our handler for an inbound request and answers with ok or error. */
    private dispatch;
    private fail;
    private spec;
    private write;
    private mintId;
    private warn;
}
export {};
