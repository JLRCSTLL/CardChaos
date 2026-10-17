import { describe, expect, it } from 'vitest';
import { GameRoom, MemoryRoomRepository } from '@card-chaos/engine';
import {
  CustomDeckSchema,
  PACKS,
  ProfileSchema,
  SettingsSchema,
  type Settings,
} from '@card-chaos/shared';

function setup(n = 4, settings: Partial<Settings> = {}) {
  let time = 100000;
  const room = new GameRoom('ABC234', 100, () => time);
  room.settings.maxPlayers = settings.maxPlayers ?? 20;
  for (let i = 0; i < n; i++) room.addPlayer({ nickname: `Player ${i + 1}`, color: 'violet' });
  const ids = [...room.players.keys()];
  const host = ids[0];
  room.updateSettings(host, SettingsSchema.parse({ ...settings }));
  for (const id of ids) room.setReady(id, true);
  return {
    room,
    ids,
    host,
    advance: (ms: number) => {
      time += ms;
      room.tick();
    },
  };
}
function submitAll(room: GameRoom) {
  for (const id of room.eligible)
    if (!room.submissions.has(id))
      room.submit(id, room.roundId, room.player(id).hand.slice(0, room.prompt!.pick));
}
function cardIntegrity(room: GameRoom) {
  const cards = [...room.players.values()]
    .flatMap((p) => p.hand)
    .concat(room.drawPile, room.discardPile);
  if (room.phase === 'submitting' || room.phase === 'judging')
    cards.push(...[...room.submissions.values()].flatMap((s) => s.cardIds));
  expect(cards.length).toBe(room.responseCards.size);
  expect(new Set(cards).size).toBe(cards.length);
}
describe('original library and validation', () => {
  it('has at least 80 original prompts and 350 unique responses, across all five categories', () => {
    expect(PACKS).toHaveLength(5);
    const prompts = PACKS.flatMap((p) => p.prompts),
      answers = PACKS.flatMap((p) => p.responses);
    expect(prompts.length).toBeGreaterThanOrEqual(80);
    expect(answers.length).toBeGreaterThanOrEqual(350);
    expect(new Set(answers.map((a) => a.text.toLowerCase())).size).toBe(answers.length);
    expect(new Set(prompts.map((p) => p.text.toLowerCase())).size).toBe(prompts.length);
    expect(prompts.every((p) => p.pick >= 1 && p.pick <= 3)).toBe(true);
  });
  it('rejects unsafe nicknames, invalid modes, and malformed custom decks', () => {
    expect(ProfileSchema.safeParse({ nickname: '<script>', color: 'violet' }).success).toBe(false);
    expect(SettingsSchema.safeParse({ submissionSeconds: -1 }).success).toBe(false);
    expect(SettingsSchema.safeParse({ mode: 'cheating' }).success).toBe(false);
    expect(
      CustomDeckSchema.safeParse({
        name: 'Bad',
        prompts: [{ text: '____?', pick: 4 }],
        responses: ['same', 'same'],
      }).success,
    ).toBe(false);
    expect(
      CustomDeckSchema.safeParse({
        name: 'Bad blanks',
        prompts: [{ text: '____ plus ____?', pick: 1 }],
        responses: ['Example'],
      }).success,
    ).toBe(false);
    expect(
      CustomDeckSchema.safeParse({
        name: 'Oversized unicode',
        prompts: [{ text: 'What?', pick: 1 }],
        responses: Array.from({ length: 600 }, (_, i) => '界'.repeat(150) + i),
      }).success,
    ).toBe(false);
  });
});
describe('room lifecycle', () => {
  it('enforces three-player minimum, readiness, and host permissions', () => {
    const { room, ids, host } = setup(2);
    expect(() => room.start(host)).toThrow('three');
    const third = room.addPlayer({ nickname: 'Third', color: 'pink' });
    expect(() => room.start(host)).toThrow('ready');
    room.setReady(third.id, true);
    expect(() => room.start(ids[1])).toThrow('host');
    room.start(host);
    expect(room.phase).toBe('submitting');
  });
  it('prevents case-insensitive and Unicode-normalized duplicate nicknames', () => {
    const { room } = setup(3);
    expect(() => room.addPlayer({ nickname: 'player 1', color: 'lime' })).toThrow('taken');
    expect(() => room.addPlayer({ nickname: 'Ｐｌａｙｅｒ １', color: 'lime' })).toThrow('taken');
  });
  it('supports twenty simultaneous players and rejects overflow', () => {
    const { room, host } = setup(20);
    room.start(host);
    expect(room.players.size).toBe(20);
    for (const p of room.players.values()) expect(p.hand).toHaveLength(10);
    expect(() => room.addPlayer({ nickname: 'Overflow', color: 'teal' })).toThrow('full');
    cardIntegrity(room);
  });
  it('supports a configured larger capacity when enough cards are selected', () => {
    const { room, host } = setup(21, { maxPlayers: 30 });
    room.start(host);
    expect(room.players.size).toBe(21);
    cardIntegrity(room);
  });
  it('rejects insufficient selected decks and mature packs without explicit opt-in', () => {
    const { room, host } = setup(9, { decks: ['general'] });
    expect(() => room.start(host)).toThrow('90 response');
    expect(() => room.updateSettings(host, SettingsSchema.parse({ decks: ['mature'] }))).toThrow(
      '18+',
    );
    room.updateSettings(host, SettingsSchema.parse({ decks: ['general', 'mature'], mature: true }));
    expect(room.selectedCards().responses.some((c) => c.pack === 'mature')).toBe(true);
  });
  it('requires readiness again after settings change', () => {
    const { room, ids, host } = setup(3);
    room.updateSettings(host, { ...room.settings, rounds: 2 });
    expect(room.player(ids[1]).ready).toBe(false);
    expect(() => room.start(host)).toThrow('ready');
  });
  it('transfers host permissions and keeps lobby state private', () => {
    const { room, ids, host } = setup();
    room.transferHost(host, ids[1]);
    expect(() => room.start(host)).toThrow('host');
    expect(room.hostId).toBe(ids[1]);
    const view = room.view(ids[1]);
    expect(JSON.stringify(view)).not.toContain('disconnectedAt');
  });
});
describe('authoritative card play', () => {
  it('deals unique private hands and rejects stolen cards and judge submissions', () => {
    const { room, host } = setup(9);
    room.start(host);
    cardIntegrity(room);
    const id = [...room.eligible][0];
    const other = [...room.eligible][1];
    expect(() =>
      room.submit(
        room.judgeId!,
        room.roundId,
        room.player(room.judgeId!).hand.slice(0, room.prompt!.pick),
      ),
    ).toThrow('judge');
    const stolen = room.player(other).hand.slice(0, room.prompt!.pick);
    expect(() => room.submit(id, room.roundId, stolen)).toThrow('own hand');
    const view = room.view(id);
    expect(view.me.hand).toHaveLength(10);
    expect(view.players.every((p) => !('hand' in p))).toBe(true);
    const serialized = JSON.stringify(view);
    for (const card of room.player(other).hand) expect(serialized).not.toContain(`"${card}"`);
  });
  it('locks submissions, preserves multi-card order, and reveals no owner IDs to the judge', () => {
    const { room, host } = setup();
    room.start(host);
    room.prompt = { ...room.prompt!, pick: 2 };
    const id = [...room.eligible][0];
    const hand = room.player(id).hand;
    const selected = [hand[2], hand[0]];
    expect(() => room.submit(id, room.roundId, [hand[0], hand[0]])).toThrow('different');
    room.submit(id, room.roundId, selected);
    expect(() => room.submit(id, room.roundId, selected)).toThrow('locked');
    expect(room.view(room.judgeId!).submissions).toEqual([]);
    expect(room.view(room.judgeId!).players.every((p) => !('submitted' in p))).toBe(true);
    submitAll(room);
    const judgeView = room.view(room.judgeId!);
    const sub = room.submissions.get(id)!;
    expect(judgeView.submissions.find((s) => s.id === sub.id)!.cards).toEqual(
      selected.map((c) => room.responseCards.get(c)!.text),
    );
    expect(judgeView.me.ownSubmissionId).toBeNull();
    expect(judgeView.submissions.every((s) => Object.keys(s).sort().join(',') === 'cards,id')).toBe(
      true,
    );
    cardIntegrity(room);
  });
  it('awards one point, replenishes to ten, and rotates the judge', () => {
    const { room, host } = setup();
    room.start(host);
    const judge = room.judgeId!;
    submitAll(room);
    const first = [...room.submissions.values()][0];
    room.choose(judge, room.roundId, first.id);
    expect(room.player(first.playerId).score).toBe(1);
    expect(room.result?.winnerId).toBe(first.playerId);
    expect(() => room.choose(judge, room.roundId, first.id)).toThrow('not open');
    cardIntegrity(room);
    room.next(host, room.roundId);
    expect(room.round).toBe(2);
    expect(room.judgeId).not.toBe(judge);
    for (const p of room.players.values()) expect(p.hand).toHaveLength(10);
    cardIntegrity(room);
  });
  it('rejects stale round actions', () => {
    const { room, host } = setup();
    room.start(host);
    const old = room.roundId;
    submitAll(room);
    room.choose(room.judgeId!, old, [...room.submissions.values()][0].id);
    room.next(host, old);
    expect(() => room.submit([...room.eligible][0], old, [])).toThrow('already ended');
  });
  it('safely reshuffles discard cards over fifty rounds with no duplicate held cards', () => {
    const { room, host } = setup(7, { rounds: 50, decks: ['general'] });
    room.start(host);
    for (let i = 0; i < 50; i++) {
      cardIntegrity(room);
      submitAll(room);
      room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
      cardIntegrity(room);
      room.next(host, room.roundId);
    }
    expect(room.phase).toBe('finished');
    expect(room.history).toHaveLength(50);
  });
});
describe('modes and deadlines', () => {
  it('democracy disallows self-votes and duplicate votes, resolves ties once', () => {
    const { room, host } = setup(4, { mode: 'democracy' });
    room.start(host);
    expect(room.judgeId).toBeNull();
    submitAll(room);
    const subs = [...room.submissions.values()];
    expect(() => room.vote(subs[0].playerId, room.roundId, subs[0].id)).toThrow('own answer');
    room.vote(subs[0].playerId, room.roundId, subs[1].id);
    expect(() => room.vote(subs[0].playerId, room.roundId, subs[2].id)).toThrow('locked');
    for (let i = 1; i < subs.length; i++)
      room.vote(subs[i].playerId, room.roundId, subs[(i + 1) % subs.length].id);
    expect(room.phase).toBe('results');
    expect(room.result?.reason).toContain('Tied');
    expect(room.activePlayers().reduce((n, p) => n + p.score, 0)).toBe(1);
  });
  it('allows no-vote rounds to expire with no point', () => {
    const { room, host, advance } = setup(3, { mode: 'democracy', judgingSeconds: 10 });
    room.start(host);
    submitAll(room);
    advance(10001);
    expect(room.phase).toBe('results');
    expect(room.result?.points).toBe(0);
    expect(room.result?.reason).toContain('Nobody voted');
  });
  it('speed caps the submission timer at twenty seconds', () => {
    const { room, host, advance } = setup(3, { mode: 'speed', submissionSeconds: 60 });
    room.start(host);
    expect(room.deadline).toBe(120000);
    advance(20000);
    expect(room.phase).toBe('results');
    expect(room.result?.winnerId).toBeNull();
  });
  it('handles empty submissions and timer progression through completion', () => {
    const { room, host, advance } = setup(3, {
      rounds: 1,
      submissionSeconds: 10,
      resultSeconds: 3,
    });
    room.start(host);
    advance(10000);
    expect(room.result?.reason).toContain('Nobody submitted');
    advance(3000);
    expect(room.phase).toBe('finished');
    expect(room.players.get(host)?.score).toBe(0);
  });
  it('automatically picks a winner if the judge times out', () => {
    const { room, host, advance } = setup(3, { judgingSeconds: 10 });
    room.start(host);
    submitAll(room);
    advance(10000);
    expect(room.result?.points).toBe(1);
    expect(room.result?.reason).toContain('expired');
  });
  it('chaos uses double points, anonymous random draws, and a two-card prompt', () => {
    const { room, host } = setup(4, { mode: 'chaos' });
    room.start(host);
    expect(room.modifier).toBe('double');
    submitAll(room);
    room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
    expect(room.result?.points).toBe(2);
    room.next(host, room.roundId);
    expect(room.modifier).toBe('random');
    expect(room.phase).toBe('judging');
    cardIntegrity(room);
    room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
    room.next(host, room.roundId);
    expect(room.modifier).toBe('double-pick');
    expect(room.prompt!.pick).toBeGreaterThanOrEqual(2);
    cardIntegrity(room);
  });
  it('custom deck mode uses validated original user cards', () => {
    const { room, host, ids } = setup(3);
    room.saveCustomDeck(host, {
      name: 'My deck',
      prompts: [{ text: 'The answer is ____.', pick: 1 }],
      responses: Array.from({ length: 30 }, (_, i) => `Unique original answer ${i}`),
    });
    room.updateSettings(
      host,
      SettingsSchema.parse({ mode: 'custom', decks: ['custom'], allowCustom: true }),
    );
    for (const id of ids) room.setReady(id, true);
    room.start(host);
    expect(room.prompt?.pack).toBe('custom');
    expect(room.view(ids[1]).me.customDeck).toBeNull();
    cardIntegrity(room);
  });
});
describe('disconnects, spectators, completion, restart', () => {
  it('hands and scores survive disconnect/reconnect, and host transfers', () => {
    const { room, host } = setup();
    room.start(host);
    const hand = [...room.player(host).hand];
    room.player(host).score = 3;
    room.setConnected(host, false);
    expect(room.hostId).not.toBe(host);
    room.setConnected(host, true);
    expect(room.player(host).hand).toEqual(hand);
    expect(room.player(host).score).toBe(3);
  });
  it('reassigns a disconnected judge after ten seconds without allowing them to submit', () => {
    const { room, host, advance } = setup();
    room.start(host);
    const judge = room.judgeId!;
    room.setConnected(judge, false);
    advance(10000);
    expect(room.judgeId).not.toBe(judge);
    expect(room.eligible.has(room.judgeId!)).toBe(false);
  });
  it('settles judging automatically when the judge leaves after all other players submit', () => {
    const { room, host, advance } = setup();
    room.start(host);
    submitAll(room);
    room.setConnected(room.judgeId!, false);
    advance(10000);
    expect(room.phase).toBe('results');
    expect(room.result?.reason).toContain('judge left');
  });
  it('new arrivals spectate and can join the next round with a fresh private hand', () => {
    const { room, host } = setup();
    room.start(host);
    const p = room.addPlayer({ nickname: 'Late arrival', color: 'orange' });
    expect(p.spectator).toBe(true);
    expect(room.view(p.id).me.hand).toEqual([]);
    expect(room.view(p.id).me.canSubmit).toBe(false);
    room.participate(p.id, true);
    submitAll(room);
    room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
    room.next(host, room.roundId);
    expect(room.player(p.id).spectator).toBe(false);
    expect(room.player(p.id).hand).toHaveLength(10);
    cardIntegrity(room);
  });
  it('rejects a spectator entering when there are not enough cards', () => {
    const { room, host } = setup(8, { decks: ['general'] });
    room.start(host);
    const p = room.addPlayer({ nickname: 'Ninth', color: 'pink' });
    expect(() => room.participate(p.id, true)).toThrow('90 response');
  });
  it('handles players leaving during submissions, judging, and results', () => {
    const { room, host } = setup(6);
    room.start(host);
    const leaver = [...room.eligible][0];
    room.submit(leaver, room.roundId, room.player(leaver).hand.slice(0, room.prompt!.pick));
    room.removePlayer(leaver);
    cardIntegrity(room);
    submitAll(room);
    const second = [...room.submissions.keys()][0];
    room.removePlayer(second);
    cardIntegrity(room);
    room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
    const winner = room.result!.winnerId!;
    room.removePlayer(winner);
    cardIntegrity(room);
    expect(room.history[0].winnerName).toBeTruthy();
  });
  it('ends when too few players remain and restarts without losing the room', () => {
    const { room, host, ids } = setup(3);
    room.start(host);
    room.removePlayer(ids[2]);
    expect(room.phase).toBe('finished');
    room.restart(host);
    expect(room.phase).toBe('lobby');
    expect(room.code).toBe('ABC234');
    expect(room.players.size).toBe(2);
    expect(room.player(ids[1]).ready).toBe(false);
    expect(room.history).toEqual([]);
  });
  it('ends at the configured target score, then resets scores and hands', () => {
    const { room, host, ids } = setup(3, { winBy: 'score', targetScore: 1 });
    room.start(host);
    submitAll(room);
    room.choose(room.judgeId!, room.roundId, [...room.submissions.values()][0].id);
    room.next(host, room.roundId);
    expect(room.phase).toBe('finished');
    room.restart(host);
    expect(room.activePlayers().every((p) => p.score === 0 && p.hand.length === 0)).toBe(true);
    for (const id of ids) room.setReady(id, true);
    room.start(host);
    expect(room.round).toBe(1);
    cardIntegrity(room);
  });
  it('can end early and return to the lobby with the same players', () => {
    const { room, host } = setup();
    room.start(host);
    room.end(host);
    expect(room.phase).toBe('finished');
    room.returnToLobby(host);
    expect(room.players.size).toBe(4);
    expect(room.phase).toBe('lobby');
  });
  it('provides a replaceable in-memory room repository', () => {
    const repository = new MemoryRoomRepository();
    const room = new GameRoom('ABC234');
    repository.set(room);
    expect(repository.get(room.code)).toBe(room);
    expect(repository.size).toBe(1);
    repository.delete(room.code);
    expect(repository.size).toBe(0);
  });
});
