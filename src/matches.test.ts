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
