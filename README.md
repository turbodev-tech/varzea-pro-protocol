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

## Matches

Only the platform creates matches. The API sends the hub its pitch's schedule
(`api.matches`, also in the `hub.connected` reply) whenever anything changes.
The hub runs each match through warmup → live → overtime → ended, records
only while one is active, and reports what happened on the field:

| Message | Meaning |
|---|---|
| `hub.match.started` | Kickoff, from a placar hold (`PLACAR`) or warmup running out (`TIMER`). |
| `hub.match.ended` | Time ran out. An end pressed in an app arrives through `api.matches`. The reply carries no end time — that end reaches the hub via `api.matches`. |
| `hub.display` | Hub → placar: what to draw. Every absolute time is on the hub's corrected clock, which the placar learns from `hubTime` in the connect/heartbeat replies; the placar renders arena time as UTC−3, fixed. |
| `peripheral.match.start` | Placar → hub: Highlight held for 3 seconds. `started: true` means a hold fell inside a match's warmup and that match's kickoff is now at or before the hold time (`matchId` names it) — a late-delivered hold can move an earlier timer kickoff back, since the earliest kickoff wins. `started: false` only when no match was in warmup at that moment. |

The hub validates `api.matches` and the `hub.connected` reply as a whole: one
invalid match rejects the entire message — for `hub.connected` that means no
config at all, and the hub loops reconnecting. The API must therefore always
send a palette colour (`#rrggbb`), a non-empty short name of at most 10
characters (upper-cased before being cut to that length), and
`durationSeconds >= 1`.

Every `hub.upload.request` names its match and when the segment began, and its
path is `{camera}/{file}`. There is no per-camera recording switch any more.

The placar reports an undone goal as a `peripheral.event` with `eventType`
`GOL_TIME_1_REVERT` or `GOL_TIME_2_REVERT`, forwarded as a `hub.event`. Its
`data` should carry `{ revertsClientEventId: "<clientEventId of the goal it
undoes>" }`. Receivers cancel that goal when `revertsClientEventId` is
present — the revert may arrive before its goal, which is then recorded as
cancelled — otherwise they cancel the latest live goal of that side.

## Consuming

CommonJS output, so it imports cleanly from the API (CJS) and the hub (ESM).
`zod` is a peer dependency — the consumer supplies it.

The ESP32 mirrors this by hand in `varzea-pro-placar-embedded`. Message names
live there as `constexpr` strings so a typo is a compile error rather than a
silently ignored frame.
