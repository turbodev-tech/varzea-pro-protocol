import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apiLinkMessages,
  discoveredCameraSchema,
  hubConfigSchema,
  type HubConfig,
} from './api-link';
import { Channel, ProtocolError } from './channel';
import { normaliseMac } from './shared';

/**
 * Runs both ends of the API link in-process, wired to each other. No sockets,
 * so the correlation and validation logic is tested on its own.
 */
function connect(options: { drop?: boolean } = {}) {
  const warnings: string[] = [];

  const hub = new Channel({
    messages: apiLinkMessages,
    sender: 'hub',
    send: (text) => {
      if (!options.drop) queueMicrotask(() => api.receive(text));
    },
    requestTimeoutMs: 50,
    onWarning: (m) => warnings.push(`hub: ${m}`),
  });

  const api = new Channel({
    messages: apiLinkMessages,
    sender: 'api',
    send: (text) => {
      if (!options.drop) queueMicrotask(() => hub.receive(text));
    },
    requestTimeoutMs: 50,
    onWarning: (m) => warnings.push(`api: ${m}`),
  });

  return { hub, api, warnings };
}

const config: HubConfig = {
  peripherals: [{ hardwareId: "placar-01", type: "PLACAR" }],
  playingAreaId: null,
  heartbeatSeconds: 30,
  cameras: [
    { hardwareId: 'f0000621cd6e', rtspPort: 554, rtspPath: '/stream0', record: true },
  ],
};

describe('Channel', () => {
  it('carries a request to a handler and the reply back', async () => {
    const { hub, api } = connect();
    api.on('hub.event', (payload) => {
      assert.equal(payload.eventType, 'GOL_TIME_1');
      return { eventId: 'evt-1' };
    });

    const reply = await hub.ask('hub.event', {
      peripheralHardwareId: 'placar-01',
      eventType: 'GOL_TIME_1',
      occurredAt: new Date().toISOString(),
      clientEventId: 'c-1',
    });

    assert.deepEqual(reply, { eventId: 'evt-1' });
    assert.equal(hub.pendingCount, 0);
  });

  it('correlates concurrent requests independently', async () => {
    const { hub, api } = connect();
    api.on('hub.event', async (payload) => {
      // Answer out of order: the first request resolves last.
      const slow = payload.clientEventId === 'c-1';
      await new Promise((r) => setTimeout(r, slow ? 20 : 1));
      return { eventId: `evt-${payload.clientEventId}` };
    });

    const send = (clientEventId: string) =>
      hub.ask('hub.event', {
        peripheralHardwareId: 'placar-01',
        eventType: 'GOL_TIME_1',
        occurredAt: new Date().toISOString(),
        clientEventId,
      });

    const [first, second] = await Promise.all([send('c-1'), send('c-2')]);
    assert.equal(first.eventId, 'evt-c-1');
    assert.equal(second.eventId, 'evt-c-2');
  });

  it('does not answer fire-and-forget messages', async () => {
    const { hub, api, warnings } = connect();
    let seen = '';
    api.on('hub.log', (payload) => {
      seen = payload.message;
    });

    hub.tell('hub.log', { level: 'warn', message: 'disk filling up' });
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(seen, 'disk filling up');
    // An orphan reply would show up here as an unmatched-reply warning.
    assert.deepEqual(warnings, []);
  });

  it('turns a handler failure into a typed rejection', async () => {
    const { hub, api } = connect();
    api.on('hub.upload.request', () => {
      throw new ProtocolError('r2_unavailable', 'Bucket is not reachable.');
    });

    await assert.rejects(
      hub.ask('hub.upload.request', {
        path: 'cam1/2026-07-27/21-14-03.ts',
        contentType: 'video/mp2t',
        bytes: 1024,
      }),
      (error: ProtocolError) => {
        assert.equal(error.code, 'r2_unavailable');
        assert.equal(error.message, 'Bucket is not reachable.');
        return true;
      },
    );
  });

  it('rejects an invalid outgoing payload before it reaches the wire', async () => {
    const { hub } = connect();
    let written = false;
    await assert.rejects(
      hub.ask('hub.event', {
        peripheralHardwareId: '',
        eventType: 'GOL_TIME_1',
        occurredAt: new Date().toISOString(),
        clientEventId: 'c-1',
      }),
      () => {
        assert.equal(written, false);
        return true;
      },
    );
  });

  it('answers an unhandled type with an error instead of hanging', async () => {
    const { hub } = connect();
    await assert.rejects(
      hub.ask('hub.connected', {
        firmwareVersion: '2.0.0',
        peripherals: [],
      }),
      (error: ProtocolError) => {
        assert.equal(error.code, 'unhandled');
        return true;
      },
    );
  });

  it('rejects a reply that does not match its schema', async () => {
    const { hub, api } = connect();
    // A handler that lies about its return shape — what a drifting API looks like.
    api.on('hub.event', (() => ({ wrong: true })) as never);

    await assert.rejects(
      hub.ask('hub.event', {
        peripheralHardwareId: 'placar-01',
        eventType: 'GOL_TIME_1',
        occurredAt: new Date().toISOString(),
        clientEventId: 'c-1',
      }),
      (error: ProtocolError) => {
        assert.equal(error.code, 'invalid_reply');
        return true;
      },
    );
  });

  it('times out when the other end never answers', async () => {
    const { hub } = connect({ drop: true });
    await assert.rejects(
      hub.ask('hub.event', {
        peripheralHardwareId: 'placar-01',
        eventType: 'GOL_TIME_1',
        occurredAt: new Date().toISOString(),
        clientEventId: 'c-1',
      }),
      (error: ProtocolError) => {
        assert.equal(error.code, 'timeout');
        return true;
      },
    );
    assert.equal(hub.pendingCount, 0);
  });

  it('fails everything in flight when the link drops', async () => {
    const { hub } = connect({ drop: true });
    const inFlight = hub.ask('hub.event', {
      peripheralHardwareId: 'placar-01',
      eventType: 'GOL_TIME_1',
      occurredAt: new Date().toISOString(),
      clientEventId: 'c-1',
    });

    hub.failPending('socket closed');

    await assert.rejects(inFlight, (error: ProtocolError) => {
      assert.equal(error.code, 'disconnected');
      return true;
    });
    assert.equal(hub.pendingCount, 0);
  });

  it('applies schema defaults to config pushed from the API', async () => {
    const { hub, api } = connect();
    let received: HubConfig | undefined;
    hub.on('api.config', (payload) => {
      received = payload;
    });

    api.tell('api.config', config);
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(received?.cameras[0]?.rtspPort, 554);
    assert.equal(received?.cameras[0]?.record, true);
  });

  it('ignores frames that are not valid envelopes', () => {
    const { hub, warnings } = connect();
    hub.receive('not json at all');
    hub.receive(JSON.stringify({ v: 99, id: 'x', type: 'hub.event' }));
    assert.equal(warnings.length, 2);
    assert.match(warnings[0] ?? '', /not JSON/);
    assert.match(warnings[1] ?? '', /malformed envelope/);
  });
});

describe('camera addressing', () => {
  it('drops a host sent by a 1.x API instead of rejecting the config', () => {
    // Rollout order is hub first, so a v2 hub will meet a v1 API.
    const legacy = {
      ...config,
      cameras: [{ ...config.cameras[0], host: '192.168.50.102' }],
    };
    const parsed = hubConfigSchema.parse(legacy);
    assert.equal('host' in (parsed.cameras[0] ?? {}), false);
  });

  it('keeps a config whose camera id is not a MAC', () => {
    // One legacy row must not cost the hub its placar list.
    const parsed = hubConfigSchema.parse({
      ...config,
      cameras: [{ hardwareId: 'CAM001', rtspPath: '/live/0/MAIN' }],
    });
    assert.equal(parsed.peripherals.length, 1);
  });

  it('normalises every common MAC spelling to one id', () => {
    for (const spelling of [
      'F0:00:06:21:CD:6E',
      'f0-00-06-21-cd-6e',
      'F0000621CD6E',
      'f000.0621.cd6e',
    ]) {
      assert.equal(normaliseMac(spelling), 'f0000621cd6e');
    }
  });

  it('refuses to coerce a non-MAC into one', () => {
    assert.equal(normaliseMac('urn:uuid:1419d68a-1dd2-11b2-a105-F0000621CD6E'), null);
    assert.equal(normaliseMac('ZZ:00:06:21:CD:6E'), null);
    assert.equal(normaliseMac('F0:00:06:21:CD'), null);
  });

  it('only accepts discovered cameras identified by a normalised MAC', () => {
    const camera = {
      hardwareId: 'f0000621cd6e',
      mac: 'F0:00:06:21:CD:6E',
      host: '10.1.1.246',
      model: 'MCD80A',
      lastSeenAt: new Date().toISOString(),
      profiles: [{ name: 'MainStream', rtspPath: '/stream0', width: 4096, height: 1944 }],
    };
    assert.equal(discoveredCameraSchema.safeParse(camera).success, true);
    assert.equal(
      discoveredCameraSchema.safeParse({ ...camera, hardwareId: 'F0:00:06:21:CD:6E' }).success,
      false,
    );
  });

  it('answers a discovery request with the fresh list', async () => {
    const { hub, api } = connect();
    hub.on('api.cameras.discover', () => ({
      cameras: [
        {
          hardwareId: 'f0000621cd6e',
          mac: 'F0:00:06:21:CD:6E',
          host: '10.1.1.246',
          lastSeenAt: new Date().toISOString(),
        },
      ],
    }));

    const reply = await api.ask('api.cameras.discover', {});
    assert.equal(reply.cameras[0]?.host, '10.1.1.246');
  });
});
