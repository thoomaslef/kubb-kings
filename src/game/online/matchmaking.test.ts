import { describe, expect, it } from 'vitest';
import {
  Matchmaker,
  QUEUE_BOT_AFTER_MS,
  QUEUE_PEER_TTL_MS,
  type QueueMatch,
  type QueueMessage
} from './matchmaking';
import type { Transport } from './transport';

/** Un canal en memoire : ce que dit l'un, tous les AUTRES l'entendent (comme BroadcastChannel). */
function makeBus() {
  const members = new Set<{ handlers: Set<(m: QueueMessage) => void> }>();
  const log: QueueMessage[] = [];
  return {
    log,
    connect(): Transport<QueueMessage> {
      const me = { handlers: new Set<(m: QueueMessage) => void>() };
      members.add(me);
      return {
        send(message) {
          log.push(message);
          for (const other of members) {
            if (other === me) continue;
            for (const h of [...other.handlers]) h(message);
          }
        },
        onMessage(handler) {
          me.handlers.add(handler);
          return () => me.handlers.delete(handler);
        },
        close() {
          members.delete(me);
        }
      };
    }
  };
}

function player(bus: ReturnType<typeof makeBus>, id: string, clock: { t: number }, code = 'ABCD') {
  const events: { match?: QueueMatch; bot: boolean } = { bot: false };
  const m = new Matchmaker({
    playerId: id,
    transport: bus.connect(),
    now: () => clock.t,
    makeCode: () => code,
    onMatch: (match) => {
      events.match = match;
    },
    onBot: () => {
      events.bot = true;
    }
  });
  return { m, events };
}

describe('file de recherche rapide', () => {
  it('couple deux joueurs : le plus ancien heberge, l autre rejoint le meme code', () => {
    const bus = makeBus();
    const clock = { t: 1000 };
    const a = player(bus, 'A', clock, 'KX7Q');
    clock.t = 1500;
    const b = player(bus, 'B', clock, 'ZZZZ');
    a.m.tick();
    b.m.tick();

    expect(a.events.match).toEqual({ role: 'host', code: 'KX7Q' });
    expect(b.events.match).toEqual({ role: 'guest', code: 'KX7Q' });
    expect(a.events.bot || b.events.bot).toBe(false);
  });

  it('le rang vient de l heure d arrivee, pas de l ordre de connexion', () => {
    const bus = makeBus();
    const clock = { t: 5000 };
    const late = player(bus, 'A', clock);
    // B se connecte apres mais affirme etre arrive plus tot (file relancee avec son rang d origine).
    let early: QueueMatch | undefined;
    new Matchmaker({
      playerId: 'B',
      transport: bus.connect(),
      now: () => clock.t,
      since: 100,
      makeCode: () => 'EARL',
      onMatch: (m) => {
        early = m;
      },
      onBot: () => {}
    });
    late.m.tick();
    expect(early).toEqual({ role: 'host', code: 'EARL' });
    expect(late.events.match).toEqual({ role: 'guest', code: 'EARL' });
  });

  it('trois joueurs : un couple se forme, le troisieme reste en file', () => {
    const bus = makeBus();
    const clock = { t: 0 };
    const a = player(bus, 'A', clock);
    clock.t = 10;
    const b = player(bus, 'B', clock);
    clock.t = 20;
    const c = player(bus, 'C', clock);
    for (const p of [a, b, c]) p.m.tick();

    expect(a.events.match?.role).toBe('host');
    expect(b.events.match?.role).toBe('guest');
    expect(c.events.match).toBeUndefined();
    expect(c.m.done).toBe(false);
  });

  it('quatre joueurs : deux couples distincts, personne n est pris deux fois', () => {
    const bus = makeBus();
    const clock = { t: 0 };
    const ids = ['A', 'B', 'C', 'D'];
    const ps = ids.map((id, i) => {
      clock.t = i * 10;
      return player(bus, id, clock, `K${id}`);
    });
    for (const p of ps) p.m.tick();

    expect(ps[0].events.match).toEqual({ role: 'host', code: 'KA' });
    expect(ps[1].events.match).toEqual({ role: 'guest', code: 'KA' });
    expect(ps[2].events.match).toEqual({ role: 'host', code: 'KC' });
    expect(ps[3].events.match).toEqual({ role: 'guest', code: 'KC' });
  });

  it('seul pendant une minute : bascule sur un bot, une seule fois', () => {
    const bus = makeBus();
    const clock = { t: 0 };
    const a = player(bus, 'A', clock);

    clock.t = QUEUE_BOT_AFTER_MS - 1;
    a.m.tick();
    expect(a.events.bot).toBe(false);

    clock.t = QUEUE_BOT_AFTER_MS;
    a.m.tick();
    expect(a.events.bot).toBe(true);
    expect(a.m.done).toBe(true);
    expect(a.events.match).toBeUndefined();
  });

  it('un adversaire arrive avant la minute : pas de bot', () => {
    const bus = makeBus();
    const clock = { t: 0 };
    const a = player(bus, 'A', clock);
    clock.t = QUEUE_BOT_AFTER_MS - 5000;
    a.m.tick();
    const b = player(bus, 'B', clock);
    clock.t = QUEUE_BOT_AFTER_MS + 1000;
    a.m.tick();
    b.m.tick();

    expect(a.events.bot).toBe(false);
    expect(a.events.match?.role).toBe('host');
    expect(b.events.match?.role).toBe('guest');
  });

  it('un joueur qui se tait est oublie : on ne reste pas coince derriere un fantome', () => {
    const bus = makeBus();
    const clock = { t: 1000 };
    const y = player(bus, 'Y', clock);
    // Un joueur plus ancien se signale... puis disparait sans un mot, sans jamais nous choisir.
    const fantome = bus.connect();
    fantome.send({ kind: 'waiting', playerId: 'Z', since: 0 });
    expect(y.m.queueSize).toBe(2);
    expect(y.events.match).toBeUndefined();

    clock.t += QUEUE_PEER_TTL_MS + 1000;
    y.m.tick();
    expect(y.m.queueSize).toBe(1);
    expect(y.events.match).toBeUndefined();
  });

  it('un depart volontaire previent les autres et libere le canal', () => {
    const bus = makeBus();
    const clock = { t: 0 };
    const a = player(bus, 'A', clock);
    a.m.stop();
    expect(bus.log[bus.log.length - 1]).toEqual({ kind: 'left', playerId: 'A' });
    expect(a.m.done).toBe(true);
    // Idempotent : un deuxieme arret n'envoie rien de plus.
    const n = bus.log.length;
    a.m.stop();
    expect(bus.log.length).toBe(n);
  });
});
