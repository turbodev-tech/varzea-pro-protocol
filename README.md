# @varzea/hub-protocol

The wire protocol shared by the VarzeaPro API, the hub, and field peripherals.
One envelope, one reply rule, three actors.

## The one rule

**A message type's prefix is always its sender.**

| Link | client | server | types |
|---|---|---|---|
| API link | hub | API | `hub.*` (hub → API), `api.*` (API → hub) |
| Peripheral link | peripheral | hub | `peripheral.*` (peripheral → hub), `hub.*` (hub → peripheral) |

Reading `api.config` tells you the API sent it. Reading `hub.event` tells you
the hub sent it. There is no table to consult and no message whose direction
you have to remember.

## Envelope

```json
{
  "v": 1,
  "id": "9f2c…",
  "type": "hub.event",
  "sentAt": "2026-07-27T21:14:03.221Z",
  "replyTo": "4a81…",
  "payload": {}
}
```

A message is either a **request** (no `replyTo`) or a **reply** (`replyTo` holds
the request's `id`). Replies are always `<sender>.ok` or `<sender>.error` —
there is no per-message ack type. `hub.ok`, `api.ok`, `peripheral.ok`, and their
`.error` counterparts are the complete set.

## Adding a message

One line in `api-link.ts` or `peripheral-link.ts`:

```ts
'hub.something': define(
  z.object({ … }),   // payload
  z.object({ … }),   // reply, or null for fire-and-forget
),
```

Both ends pick up the types and the runtime validation automatically. A message
that is not in the table cannot be sent.

## Consuming

CommonJS output, so it imports cleanly from the API (CJS) and the hub (ESM).
`zod` is a peer dependency — the consumer supplies it.

The ESP32 mirrors this by hand in `varzea-pro-placar-embedded`. Message names
live there as `constexpr` strings so a typo is a compile error rather than a
silently ignored frame.
