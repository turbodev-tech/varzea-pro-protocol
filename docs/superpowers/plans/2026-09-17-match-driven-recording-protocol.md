# Match-Driven Recording — Protocol v3.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release `@varzea/hub-protocol` v3.0.0. It carries the pitch's match
schedule to the hub, match lifecycle facts back to the API, and match display
state to the placar. It also removes per-camera recording control.

**Architecture:** A new `src/matches.ts` holds the schemas both links share
(match sides, the schedule entry, display modes). `api-link.ts` gains
`api.matches`, `hub.match.started` and `hub.match.ended`, and adds `matchId`
to events and uploads. `peripheral-link.ts` gains `hub.display` and
`peripheral.match.start`. `dist/` is committed, and the release is a tag on
`main`.

**Tech Stack:** TypeScript 5, zod 4 (peer), `node:test` via tsx.

**Spec:** `/Users/luisfplara/dev/Personal/VarzeaPro/varzea-pro-api/docs/superpowers/specs/2026-09-17-match-driven-recording-design.md` (§4)

## Global Constraints

- **Branching:** this repo is main-only. Commit to `main` and release by
  annotated tag `v3.0.0`. Pushing `main` and the tag happens after the final
  review, not inside a task.
- **dist:** `npm test` fails when `dist/` is stale. Rebuild and commit `dist/`
  with the source change in the same commit.
- **Message naming:** a message type's prefix is its sender (`hub.*`, `api.*`,
  `peripheral.*`).
- **Envelope version:** `PROTOCOL_VERSION` stays `1`. The breaking change is
  in the message table, and the package major version carries it.
- **Commit trailer:** every commit ends with exactly
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Tests:** `npm test` must pass before every commit.

---

### Task 1: Match schemas and the API link

**Files:**
- Create: `src/matches.ts`
- Create: `src/matches.test.ts`
- Modify: `src/api-link.ts`
- Modify: `src/index.ts`
- Modify: `src/channel.test.ts:44-49`, `:215-225` (drop `record`)
- Modify: `dist/**` (rebuild)

**Interfaces:**
- Produces (exported from the package root):
  - `matchSideSchema` / `MatchSide`: `{ name: string; shortName: string; color: string }`, where `color` matches `/^#[0-9a-f]{6}$/i` and `shortName` is 1–10 characters.
  - `matchStatusSchema`: `'SCHEDULED' | 'LIVE' | 'FINISHED'`.
  - `scheduledMatchSchema` / `ScheduledMatch`: `{ id; status; startsAt; warmupSeconds; durationSeconds; overtimeSeconds; startedAt?; endedAt?; home: MatchSide; away: MatchSide }`.
  - `matchScheduleSchema` / `MatchSchedule`: `{ matches: ScheduledMatch[] }`.
  - API link:
    - `'api.matches'`: payload `MatchSchedule`, reply `null`.
    - `'hub.connected'` reply: `{ serverTime; config; matches: ScheduledMatch[] }`.
    - `'hub.match.started'`: `{ matchId; clientEventId; startedAt; source: 'PLACAR' | 'TIMER' }` → `{ matchId; startedAt }`.
    - `'hub.match.ended'`: `{ matchId; clientEventId; endedAt }` → `{ matchId }`.
    - `'hub.event'` payload gains `matchId?: string`.
    - `'hub.upload.request'` payload gains `matchId: string` and `segmentStartedAt: string` (ISO, clock-corrected), both required. The path is now `{camera}/{file}`.
  - `hubConfigSchema` gains `arenaName: string` (default `''`). The placar's idle screen shows it.
  - Removed: `'api.recording.set'` and `cameraSchema.record`.

- [ ] **Step 1: Write the failing tests**

Create `src/matches.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiLinkMessages, hubConfigSchema } from './api-link';
import { scheduledMatchSchema, type ScheduledMatch } from './matches';

const match: ScheduledMatch = {
  id: '6f1d7c1e-3f0a-4a51-9c55-0d5b1b1a2f10',
  status: 'SCHEDULED',
  startsAt: '2026-09-20T22:00:00.000Z',
  warmupSeconds: 300,
  durationSeconds: 3600,
  overtimeSeconds: 0,
  home: { name: 'Unidos da Vila', shortName: 'UNIDOS', color: '#e11d48' },
  away: { name: 'Time 2', shortName: 'TIME 2', color: '#2563eb' },
};

describe('match schedule', () => {
  it('accepts a scheduled match', () => {
    assert.deepEqual(scheduledMatchSchema.parse(match), match);
  });

  it('carries kickoff and end once they happen', () => {
    const live = { ...match, status: 'LIVE', startedAt: '2026-09-20T22:04:10.000Z' };
    assert.equal(scheduledMatchSchema.parse(live).startedAt, live.startedAt);
  });

  it('rejects a colour that is not #rrggbb', () => {
    const bad = { ...match, home: { ...match.home, color: 'red' } };
    assert.equal(scheduledMatchSchema.safeParse(bad).success, false);
  });

  it('rejects a short name longer than the panel fits', () => {
    const bad = { ...match, away: { ...match.away, shortName: 'ELEVEN CHAR' } };
    assert.equal(scheduledMatchSchema.safeParse(bad).success, false);
  });

  it('rejects negative phase lengths', () => {
    assert.equal(scheduledMatchSchema.safeParse({ ...match, overtimeSeconds: -1 }).success, false);
  });

  it('does not ship cancelled matches', () => {
    assert.equal(scheduledMatchSchema.safeParse({ ...match, status: 'CANCELLED' }).success, false);
  });
});

describe('api link match messages', () => {
  it('pushes the schedule whole, fire-and-forget', () => {
    const spec = apiLinkMessages['api.matches'];
    assert.equal(spec.reply, null);
    assert.deepEqual(spec.payload.parse({ matches: [match] }), { matches: [match] });
  });

  it('returns the schedule on connect', () => {
    const reply = apiLinkMessages['hub.connected'].reply.parse({
      serverTime: '2026-09-20T21:00:00.000Z',
      config: { playingAreaId: 'area-1', heartbeatSeconds: 30, peripherals: [], cameras: [] },
      matches: [match],
    });
    assert.equal(reply.matches.length, 1);
  });

  it('reports a kickoff with its source', () => {
    const spec = apiLinkMessages['hub.match.started'];
    const payload = {
      matchId: match.id,
      clientEventId: 'k-1',
      startedAt: '2026-09-20T22:04:10.000Z',
      source: 'PLACAR' as const,
    };
    assert.deepEqual(spec.payload.parse(payload), payload);
    assert.equal(spec.payload.safeParse({ ...payload, source: 'APP' }).success, false);
    assert.deepEqual(spec.reply.parse({ matchId: match.id, startedAt: payload.startedAt }), {
      matchId: match.id,
      startedAt: payload.startedAt,
    });
  });

  it('reports an end', () => {
    const spec = apiLinkMessages['hub.match.ended'];
    const payload = { matchId: match.id, clientEventId: 'e-1', endedAt: '2026-09-20T23:05:00.000Z' };
    assert.deepEqual(spec.payload.parse(payload), payload);
    assert.deepEqual(spec.reply.parse({ matchId: match.id }), { matchId: match.id });
  });

  it('requires a match on every upload', () => {
    const spec = apiLinkMessages['hub.upload.request'];
    const base = {
      path: 'f0000621cd6e/2026-09-20_22-00-00.mp4',
      contentType: 'video/mp4',
      bytes: 10,
      segmentStartedAt: '2026-09-20T22:00:00.000Z',
    };
    assert.equal(spec.payload.safeParse(base).success, false);
    assert.equal(spec.payload.safeParse({ ...base, matchId: match.id }).success, true);
    const { segmentStartedAt: _dropped, ...noStart } = base;
    assert.equal(spec.payload.safeParse({ ...noStart, matchId: match.id }).success, false);
  });

  it('lets an event name its match, or not', () => {
    const spec = apiLinkMessages['hub.event'];
    const base = {
      peripheralHardwareId: 'placar-01',
      eventType: 'GOL_TIME_1',
      occurredAt: '2026-09-20T22:10:00.000Z',
      clientEventId: 'g-1',
    };
    assert.equal(spec.payload.safeParse(base).success, true);
    assert.equal(spec.payload.parse({ ...base, matchId: match.id }).matchId, match.id);
  });

  it('names the arena in the config, defaulting to empty', () => {
    const parsed = hubConfigSchema.parse({ playingAreaId: null, heartbeatSeconds: 30, peripherals: [], cameras: [] });
    assert.equal(parsed.arenaName, '');
  });

  it('no longer controls recording per camera', () => {
    assert.equal('api.recording.set' in apiLinkMessages, false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/matches.test.ts`
Expected: FAIL with `Cannot find module './matches'`.

- [ ] **Step 3: Create `src/matches.ts`**

```ts
import { z } from 'zod';

/**
 * Matches, as the field sees them. Only the platform creates a match; the hub
 * receives the pitch's schedule and reports what happened on the field.
 *
 * A match's window is `startsAt` → warmup → regular time → overtime. Kickoff
 * (`startedAt`) ends the warmup early when someone presses start, and the
 * phases after it are measured from kickoff.
 */

/** One side, as the placar draws it. */
export const matchSideSchema = z.object({
  name: z.string().min(1),
  /** What fits the LED panel: at most 10 characters. */
  shortName: z.string().min(1).max(10),
  /** `#rrggbb`, from the platform's LED palette. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'expected #rrggbb'),
});
export type MatchSide = z.infer<typeof matchSideSchema>;

/** Cancelled matches are never sent; a match that disappears was cancelled. */
export const matchStatusSchema = z.enum(['SCHEDULED', 'LIVE', 'FINISHED']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

const seconds = z.number().int().nonnegative();

export const scheduledMatchSchema = z.object({
  id: z.string().min(1),
  status: matchStatusSchema,
  /** Warmup begins here. ISO-8601. */
  startsAt: z.string(),
  warmupSeconds: seconds,
  durationSeconds: z.number().int().positive(),
  overtimeSeconds: seconds,
  /** Kickoff, once it happened. */
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  home: matchSideSchema,
  away: matchSideSchema,
});
export type ScheduledMatch = z.infer<typeof scheduledMatchSchema>;

/**
 * Every match on the hub's pitch ending in the next 24 hours, plus any live
 * one. Always a full replacement.
 */
export const matchScheduleSchema = z.object({
  matches: z.array(scheduledMatchSchema),
});
export type MatchSchedule = z.infer<typeof matchScheduleSchema>;
```

- [ ] **Step 4: Update `src/api-link.ts`**

1. Add `import { matchScheduleSchema, scheduledMatchSchema } from './matches';`
   below the existing imports.
2. In `cameraSchema`, delete the line `record: z.boolean().default(true),`.
   Replace the doc comment's first sentence with: "One camera the hub should
   pull. It records only while a match on the pitch is active."
3. Replace the `hub.connected` reply object with:

```ts
    z.object({
      serverTime: z.string(),
      config: hubConfigSchema,
      /** The pitch's schedule, so a reconnecting hub never waits for a push. */
      matches: z.array(scheduledMatchSchema),
    }),
```

4. In `hub.event`'s payload object, add after `clientEventId`:

```ts
      /** The match active on the pitch when it happened, if any. */
      matchId: z.string().min(1).optional(),
```

5. Replace the `hub.upload.request` definition with:

```ts
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
```

6. Add after `hub.upload.request`:

```ts
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
   */
  'hub.match.ended': define(
    z.object({
      matchId: z.string().min(1),
      clientEventId: z.string().min(1),
      endedAt: z.string(),
    }),
    z.object({ matchId: z.string() }),
  ),
```

7. Add after `'api.config'`:

```ts
  /**
   * The pitch's match schedule, sent whole whenever any match on it changes
   * and every 15 minutes. No ack, for the same reason as `api.config`.
   */
  'api.matches': define(matchScheduleSchema, null),
```

8. Delete the whole `'api.recording.set'` entry and its comment.
9. In `hubConfigSchema`, add after `playingAreaId`:

```ts
  /** Shown by the placar between matches. */
  arenaName: z.string().default(''),
```

- [ ] **Step 5: Export and fix the existing tests**

In `src/index.ts`, add `export * from './matches';` after `./shared`.

In `src/channel.test.ts`:
- Remove `, record: true` from the `config` fixture's camera (line ~47).
- Replace the assertion `assert.equal(received?.cameras[0]?.record, true);`
  (line ~223) with
  `assert.equal('record' in (received?.cameras[0] ?? {}), false);`.
- If the test at line ~153 ("applies schema defaults to config pushed from the
  API") asserts on `record`, change it to assert `rtspPort` defaults to `554`
  from a camera sent without `rtspPort`.

The `config` fixture is typed `HubConfig`, so it needs `arenaName: 'Arena'`.
Every existing `hub.connected` reply fixture needs `matches: []`. Find them
with `grep -n "serverTime" src/channel.test.ts`.

- [ ] **Step 6: Run the whole suite**

Run: `npm run typecheck && node --import tsx --test src/*.test.ts`
Expected: PASS, including the 14 new tests.

- [ ] **Step 7: Rebuild `dist/` and commit**

```bash
npm run build
npm test
git add src dist
git commit -m "feat(protocol)!: match schedule down, kickoff and end up; no per-camera recording

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Placar link match messages

**Files:**
- Modify: `src/peripheral-link.ts`
- Modify: `src/matches.ts` (display schema)
- Test: `src/matches.test.ts` (append)
- Modify: `dist/**` (rebuild)

**Interfaces:**
- Consumes: `matchSideSchema` from Task 1.
- Produces:
  - `displayModeSchema`: `'IDLE' | 'WARMUP' | 'LIVE' | 'OVERTIME' | 'ENDED'`.
  - `displayStateSchema` / `DisplayState`: `{ mode; arenaName: string; home?: MatchSide; away?: MatchSide; score?: { home: number; away: number }; phaseEndsAt?: string; startedAt?: string; durationSeconds?: number; overtimeSeconds?: number }`.
  - `'hub.display'`: payload `DisplayState`, reply `null`.
  - `'peripheral.match.start'`: payload `{ clientEventId: string; ageMs: number }`, reply `{ matchId?: string; started: boolean }`.

- [ ] **Step 1: Append the failing tests to `src/matches.test.ts`**

```ts
import { peripheralLinkMessages } from './peripheral-link';
import { displayStateSchema } from './matches';

describe('placar link match messages', () => {
  it('draws a live match', () => {
    const state = {
      mode: 'LIVE' as const,
      arenaName: 'Arena Várzea',
      home: match.home,
      away: match.away,
      score: { home: 2, away: 1 },
      startedAt: '2026-09-20T22:04:10.000Z',
      durationSeconds: 3600,
      overtimeSeconds: 300,
    };
    assert.deepEqual(displayStateSchema.parse(state), state);
    assert.equal(peripheralLinkMessages['hub.display'].reply, null);
  });

  it('draws idle with only the arena name', () => {
    assert.equal(displayStateSchema.safeParse({ mode: 'IDLE', arenaName: 'Arena' }).success, true);
  });

  it('rejects an unknown mode', () => {
    assert.equal(displayStateSchema.safeParse({ mode: 'PAUSED', arenaName: 'Arena' }).success, false);
  });

  it('asks the hub to kick off, with the age of the press', () => {
    const spec = peripheralLinkMessages['peripheral.match.start'];
    assert.deepEqual(spec.payload.parse({ clientEventId: 's-1', ageMs: 1200 }), {
      clientEventId: 's-1',
      ageMs: 1200,
    });
    assert.equal(spec.payload.safeParse({ clientEventId: 's-1', ageMs: -1 }).success, false);
    assert.deepEqual(spec.reply.parse({ started: false }), { started: false });
    assert.deepEqual(spec.reply.parse({ matchId: match.id, started: true }), {
      matchId: match.id,
      started: true,
    });
  });
});
```

Move the two new imports to the top of the file with the others.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/matches.test.ts`
Expected: FAIL, because `displayStateSchema` is not exported.

- [ ] **Step 3: Add the display schema to `src/matches.ts`**

```ts
/** What the placar is showing. */
export const displayModeSchema = z.enum(['IDLE', 'WARMUP', 'LIVE', 'OVERTIME', 'ENDED']);
export type DisplayMode = z.infer<typeof displayModeSchema>;

/**
 * Everything the placar needs to draw, sent whole on every change.
 *
 * WARMUP counts down to `phaseEndsAt`. LIVE counts up from `startedAt`.
 * OVERTIME shows the time past `startedAt + durationSeconds` as `+mm:ss`.
 * IDLE shows `arenaName` and the time of day.
 */
export const displayStateSchema = z.object({
  mode: displayModeSchema,
  arenaName: z.string(),
  home: matchSideSchema.optional(),
  away: matchSideSchema.optional(),
  score: z
    .object({ home: z.number().int().nonnegative(), away: z.number().int().nonnegative() })
    .optional(),
  phaseEndsAt: z.string().optional(),
  startedAt: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
  overtimeSeconds: z.number().int().nonnegative().optional(),
});
export type DisplayState = z.infer<typeof displayStateSchema>;
```

- [ ] **Step 4: Add the messages to `src/peripheral-link.ts`**

Add `import { displayStateSchema } from './matches';` to the imports.

After `'peripheral.heartbeat'`, add:

```ts
  /**
   * Highlight held for 3 seconds: kick off the match in warmup.
   *
   * Queued like a goal, with `ageMs` for the same reason. The hub starts the
   * match that was in warmup at `now − ageMs`. `started: false` means there
   * was none, or it had already kicked off, and the placar shows SEM PARTIDA.
   */
  'peripheral.match.start': define(
    z.object({
      clientEventId: z.string().min(1),
      ageMs: z.number().int().nonnegative(),
    }),
    z.object({ matchId: z.string().optional(), started: z.boolean() }),
  ),
```

After `'hub.command'`, add:

```ts
  /** What to draw. Sent on every change and right after `peripheral.connected`. */
  'hub.display': define(displayStateSchema, null),
```

- [ ] **Step 5: Run the whole suite**

Run: `npm run typecheck && node --import tsx --test src/*.test.ts`
Expected: PASS.

- [ ] **Step 6: Rebuild and commit**

```bash
npm run build
npm test
git add src dist
git commit -m "feat(protocol): placar display state and hold-to-kick-off

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Document and release v3.0.0

**Files:**
- Modify: `README.md`
- Modify: `package.json` (`version`)
- Modify: `package-lock.json` (`version`)

**Interfaces:**
- Produces: git tag `v3.0.0` on `origin`, consumed by the API and hub as
  `github:turbodev-tech/varzea-pro-protocol#v3.0.0`.

- [ ] **Step 1: Document matches in `README.md`**

Append this section before "## Consuming":

```markdown
## Matches

Only the platform creates matches. The API sends the hub its pitch's schedule
(`api.matches`, also in the `hub.connected` reply) whenever anything changes.
The hub runs each match through warmup → live → overtime → ended, records
only while one is active, and reports what happened on the field:

| Message | Meaning |
|---|---|
| `hub.match.started` | Kickoff, from a placar hold (`PLACAR`) or warmup running out (`TIMER`). |
| `hub.match.ended` | Time ran out. An end pressed in an app arrives through `api.matches`. |
| `hub.display` | Hub → placar: what to draw. |
| `peripheral.match.start` | Placar → hub: Highlight held for 3 seconds. |

Every `hub.upload.request` names its match and when the segment began, and its
path is `{camera}/{file}`. There is no per-camera recording switch any more.

The placar reports an undone goal as a `peripheral.event` with `eventType`
`GOL_TIME_1_REVERT` or `GOL_TIME_2_REVERT`, forwarded as a `hub.event`.
```

- [ ] **Step 2: Bump the version**

Run: `npm version 3.0.0 --no-git-tag-version`
Expected: `v3.0.0`, with `package.json` and `package-lock.json` updated.

- [ ] **Step 3: Verify, commit, tag and push**

```bash
npm test
git add README.md package.json package-lock.json
git commit -m "chore: release 3.0.0

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git tag -a v3.0.0 -m "v3.0.0 — match-driven recording"
```

Do not push. The controller pushes `main` and the tag after the final review
(`git push origin main && git push origin v3.0.0`). The API and hub plans
cannot install v3.0.0 until then.
