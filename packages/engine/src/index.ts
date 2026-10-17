import { randomInt, randomUUID } from 'node:crypto';
import {
  CustomDeckSchema,
  PACKS,
  PACK_INFO,
  SettingsSchema,
  type CustomDeck,
  type Profile,
  type PromptCard,
  type PublicSubmission,
  type ResponseCard,
  type RoomView,
  type RoundResult,
  type Settings,
} from '@card-chaos/shared';

export class RuleError extends Error {
  constructor(
    message: string,
    public code = 'INVALID_ACTION',
  ) {
    super(message);
  }
}
function requireRule(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) throw new RuleError(message, code);
}
export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export interface Player extends Profile {
  id: string;
  score: number;
  connected: boolean;
  disconnectedAt: number | null;
  ready: boolean;
  spectator: boolean;
  joinNext: boolean;
  hand: string[];
}
interface Submission {
  id: string;
  playerId: string;
  cardIds: string[];
}

/** All mutations are synchronous and atomic within a single Node process.
 * The network boundary supplies validated actions; view() is the sole serialization boundary.
 */
export class GameRoom {
  players = new Map<string, Player>();
  hostId = '';
  revision = 0;
  phase: RoomView['phase'] = 'lobby';
  settings: Settings = SettingsSchema.parse({});
  round = 0;
  roundId = '';
  judgeId: string | null = null;
  prompt: PromptCard | null = null;
  modifier: RoomView['modifier'] = null;
  deadline: number | null = null;
  result: RoundResult | null = null;
  history: RoundResult[] = [];
  finishReason: string | null = null;
  customDeck: CustomDeck | null = null;
  eligible = new Set<string>();
  submissions = new Map<string, Submission>();
  votes = new Map<string, string>();
  judgingOrder: string[] = [];
  responseCards = new Map<string, ResponseCard>();
  promptCards: PromptCard[] = [];
  drawPile: string[] = [];
  discardPile: string[] = [];
  promptPile: PromptCard[] = [];
  lastActiveAt: number;
  private judgeCursor: string | null = null;
  private customVersion = 0;

  constructor(
    public code: string,
    public maxCapacity = 40,
    private now: () => number = Date.now,
  ) {
    this.lastActiveAt = now();
  }
  touch() {
    this.revision++;
    this.lastActiveAt = this.now();
  }
  player(id: string) {
    const p = this.players.get(id);
    requireRule(p, 'You are no longer in this room.', 'SESSION_EXPIRED');
    return p;
  }
  assertHost(id: string) {
    this.player(id);
    requireRule(id === this.hostId, 'Only the host can do that.', 'HOST_ONLY');
  }
  assertLobby() {
    requireRule(this.phase === 'lobby', 'Change this setting in the lobby.');
  }
  assertRound(roundId: string) {
    requireRule(
      roundId === this.roundId,
      'That round has already ended. Please try the current round.',
      'STALE_ROUND',
    );
  }

  addPlayer(profile: Profile) {
    requireRule(
      this.players.size < Math.min(this.settings.maxPlayers, this.maxCapacity),
      'This room is full.',
      'ROOM_FULL',
    );
    const name = profile.nickname.normalize('NFKC');
    requireRule(
      ![...this.players.values()].some(
        (p) => p.nickname.normalize('NFKC').toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
      'That nickname is already taken. Try another.',
      'NAME_TAKEN',
    );
    const id = randomUUID();
    const p: Player = {
      ...profile,
      nickname: name,
      id,
      score: 0,
      connected: true,
      disconnectedAt: null,
      ready: this.players.size === 0,
      spectator: this.phase !== 'lobby',
      joinNext: false,
      hand: [],
    };
    this.players.set(id, p);
    if (!this.hostId) this.hostId = id;
    this.touch();
    return p;
  }
  setReady(id: string, ready: boolean) {
    this.assertLobby();
    this.player(id).ready = ready;
    this.touch();
  }
  participate(id: string, participate: boolean) {
    const p = this.player(id);
    requireRule(p.spectator, 'You are already playing.');
    requireRule(this.phase !== 'finished', 'Wait for the host to start another game.');
    if (participate)
      this.validateDeckCapacity(
        this.activePlayers().length +
          [...this.players.values()].filter((x) => x.joinNext && x.id !== id).length +
          1,
      );
    p.joinNext = participate;
    this.touch();
  }
  activePlayers() {
    return [...this.players.values()].filter((p) => !p.spectator);
  }
  setConnected(id: string, connected: boolean) {
    const p = this.player(id);
    p.connected = connected;
    p.disconnectedAt = connected ? null : this.now();
    if (!connected && id === this.hostId)
      this.hostId = [...this.players.values()].find((x) => x.id !== id && x.connected)?.id ?? id;
    if (connected && !this.players.get(this.hostId)?.connected) this.hostId = id;
    this.touch();
  }
  transferHost(id: string, target: string) {
    this.assertHost(id);
    requireRule(this.player(target).connected, 'Choose a connected player.');
    this.hostId = target;
    this.touch();
  }
  removePlayer(id: string) {
    const p = this.player(id);
    this.discardPile.push(...p.hand);
    const own = this.submissions.get(id);
    // Result cards were already discarded when the result was committed.
    if (own && this.phase !== 'results' && this.phase !== 'finished')
      this.discardPile.push(...own.cardIds);
    this.submissions.delete(id);
    this.votes.delete(id);
    this.eligible.delete(id);
    if (own) for (const [voter, sub] of this.votes) if (sub === own.id) this.votes.delete(voter);
    this.players.delete(id);
    if (id === this.hostId)
      this.hostId =
        [...this.players.values()].find((x) => x.connected)?.id ??
        this.players.keys().next().value ??
        '';
    if (this.judgeCursor === id) this.judgeCursor = null;
    if (this.phase !== 'lobby' && this.phase !== 'finished') {
      if (this.activePlayers().length < 3)
        this.finish('The game ended because fewer than three players remain.');
      else {
        if (this.judgeId === id) this.replaceJudge();
        this.maybeAdvance();
      }
    }
    this.touch();
  }
  updateSettings(id: string, settings: Settings) {
    this.assertHost(id);
    this.assertLobby();
    const parsed = SettingsSchema.parse(settings);
    requireRule(
      parsed.maxPlayers <= this.maxCapacity,
      `This server allows up to ${this.maxCapacity} players per room.`,
    );
    requireRule(
      parsed.maxPlayers >= this.players.size,
      'The player limit cannot be lower than the current room size.',
    );
    requireRule(
      !parsed.decks.includes('mature') || parsed.mature,
      'Enable the 18+ content warning before selecting After hours.',
    );
    requireRule(
      !parsed.decks.includes('custom') || parsed.allowCustom,
      'Enable custom cards before selecting a custom pack.',
    );
    requireRule(
      parsed.mode !== 'custom' || (parsed.allowCustom && parsed.decks.includes('custom')),
      'Custom Deck mode requires custom cards and the custom pack.',
    );
    this.settings = parsed;
    // Material rule changes require players to confirm readiness again.
    for (const p of this.players.values()) p.ready = p.id === this.hostId;
    this.touch();
  }
  saveCustomDeck(id: string, deck: CustomDeck) {
    this.assertHost(id);
    this.assertLobby();
    this.customDeck = CustomDeckSchema.parse(deck);
    this.customVersion++;
    for (const p of this.players.values()) p.ready = p.id === this.hostId;
    this.touch();
  }
  selectedCards() {
    const selected = PACKS.filter(
      (p) =>
        this.settings.decks.includes(p.id as Settings['decks'][number]) &&
        (!p.mature || this.settings.mature),
    );
    const responses = selected.flatMap((p) => p.responses);
    const prompts = selected.flatMap((p) => p.prompts);
    if (this.settings.allowCustom && this.settings.decks.includes('custom')) {
      requireRule(this.customDeck, 'Create or import a custom deck first.');
      responses.push(
        ...this.customDeck.responses.map((text, i) => ({
          id: `custom-${this.customVersion}-r${i}`,
          text,
          pack: 'custom',
        })),
      );
      prompts.push(
        ...this.customDeck.prompts.map((p, i) => ({
          ...p,
          id: `custom-${this.customVersion}-p${i}`,
          pack: 'custom',
        })),
      );
    }
    return { responses, prompts };
  }
  validateDeckCapacity(players: number) {
    const { responses, prompts } = this.selectedCards();
    requireRule(prompts.length > 0, 'Select at least one pack with prompt cards.');
    requireRule(
      responses.length >= players * 10,
      `This game needs at least ${players * 10} response cards for ${players} players. Select more packs (${responses.length} available).`,
      'INSUFFICIENT_CARDS',
    );
  }
  start(id: string) {
    this.assertHost(id);
    this.assertLobby();
    const players = [...this.players.values()];
    requireRule(players.length >= 3, 'You need at least three players to start.', 'MIN_PLAYERS');
    requireRule(
      players.every((p) => p.connected),
      'Wait for disconnected players or remove them before starting.',
    );
    requireRule(
      players.every((p) => p.ready),
      'Everyone needs to be ready before the game starts.',
    );
    this.validateDeckCapacity(players.length);
    const cards = this.selectedCards();
    this.responseCards = new Map(cards.responses.map((c) => [c.id, c]));
    this.promptCards = cards.prompts;
    this.drawPile = shuffle([...this.responseCards.keys()]);
    this.discardPile = [];
    this.promptPile = shuffle(this.promptCards);
    this.history = [];
    this.result = null;
    this.round = 0;
    this.finishReason = null;
    for (const p of players) {
      p.score = 0;
      p.hand = [];
      p.spectator = false;
      p.joinNext = false;
    }
    this.judgeCursor = null;
    this.beginRound();
  }
  returnToLobby(id: string) {
    this.assertHost(id);
    this.phase = 'lobby';
    this.round = 0;
    this.roundId = '';
    this.deadline = null;
    this.prompt = null;
    this.judgeId = null;
    this.result = null;
    this.history = [];
    this.finishReason = null;
    this.modifier = null;
    this.eligible.clear();
    this.submissions.clear();
    this.votes.clear();
    this.judgingOrder = [];
    this.drawPile = [];
    this.discardPile = [];
    this.responseCards.clear();
    this.promptCards = [];
    this.promptPile = [];
    for (const p of this.players.values()) {
      p.score = 0;
      p.hand = [];
      p.spectator = false;
      p.joinNext = false;
      p.ready = p.id === this.hostId;
    }
    this.touch();
  }
  restart(id: string) {
    this.assertHost(id);
    requireRule(this.phase === 'finished', 'Finish the current game first.');
    // Return to lobby for renewed readiness and any rule changes.
    this.returnToLobby(id);
  }
  end(id: string) {
    this.assertHost(id);
    requireRule(
      this.phase !== 'lobby' && this.phase !== 'finished',
      'There is no active game to end.',
    );
    this.finish('The host ended the game.');
  }

  private draw() {
    if (this.drawPile.length === 0) {
      this.drawPile = shuffle(this.discardPile);
      this.discardPile = [];
    }
    const card = this.drawPile.pop();
    requireRule(
      card,
      'No response cards available. Return to the lobby and select more packs.',
      'INSUFFICIENT_CARDS',
    );
    return card;
  }
  private beginRound() {
    for (const p of this.players.values())
      if (p.spectator && p.joinNext && p.connected) {
        p.spectator = false;
        p.joinNext = false;
      }
    const active = this.activePlayers();
    const connected = active.filter((p) => p.connected);
    if (active.length < 3) return this.finish('At least three players are required to continue.');
    if (connected.length < 2) {
      // Preserve current state and retry; disconnect grace eventually removes absent players.
      this.phase = 'results';
      this.deadline = this.now() + 3000;
      this.touch();
      return;
    }
    for (const p of active) while (p.hand.length < 10) p.hand.push(this.draw());
    this.round++;
    this.roundId = randomUUID();
    this.phase = 'submitting';
    this.result = null;
    this.submissions.clear();
    this.votes.clear();
    this.judgingOrder = [];
    if (this.promptPile.length === 0) this.promptPile = shuffle(this.promptCards);
    this.prompt = { ...this.promptPile.pop()! };
    this.modifier =
      this.settings.mode === 'chaos'
        ? (['double', 'random', 'double-pick'] as const)[(this.round - 1) % 3]
        : null;
    if (this.modifier === 'double-pick' && this.prompt.pick < 2) {
      this.prompt.pick = 2;
      this.prompt.text += ' And somehow, ____ made it worse.';
    }
    if (this.settings.mode === 'democracy') this.judgeId = null;
    else {
      const start = this.judgeCursor ? active.findIndex((p) => p.id === this.judgeCursor) : -1;
      const order =
        start < 0 ? shuffle(active) : [...active.slice(start + 1), ...active.slice(0, start + 1)];
      this.judgeId = order.find((p) => p.connected)!.id;
      this.judgeCursor = this.judgeId;
    }
    this.eligible = new Set(connected.filter((p) => p.id !== this.judgeId).map((p) => p.id));
    const seconds =
      this.settings.mode === 'speed'
        ? Math.min(20, this.settings.submissionSeconds)
        : this.settings.submissionSeconds;
    this.deadline = this.now() + seconds * 1000;
    if (this.modifier === 'random') {
      for (const id of this.eligible)
        this.recordSubmission(id, shuffle(this.player(id).hand).slice(0, this.prompt.pick));
      this.beginJudging();
    }
    this.touch();
  }
  submit(id: string, roundId: string, cardIds: string[]) {
    this.assertRound(roundId);
    requireRule(this.phase === 'submitting', 'Submissions are closed.');
    requireRule(
      this.deadline !== null && this.now() < this.deadline,
      'The submission timer has expired.',
    );
    requireRule(this.eligible.has(id), 'You are watching this round. The judge cannot submit.');
    requireRule(!this.submissions.has(id), 'Your cards are already locked in.');
    requireRule(
      cardIds.length === this.prompt!.pick && new Set(cardIds).size === cardIds.length,
      `Select ${this.prompt!.pick} different card${this.prompt!.pick > 1 ? 's' : ''}.`,
    );
    requireRule(
      cardIds.every((card) => this.player(id).hand.includes(card)),
      'You can only submit cards from your own hand.',
      'CARD_OWNERSHIP',
    );
    this.recordSubmission(id, cardIds);
    this.maybeAdvance();
    this.touch();
  }
  private recordSubmission(id: string, cardIds: string[]) {
    const p = this.player(id);
    p.hand = p.hand.filter((c) => !cardIds.includes(c));
    this.submissions.set(id, { id: randomUUID(), playerId: id, cardIds: [...cardIds] });
  }
  private beginJudging() {
    if (this.submissions.size === 0) {
      this.resolve(null, 'Nobody submitted before the timer ended. No point awarded.');
      return;
    }
    this.phase = 'judging';
    this.judgingOrder = shuffle([...this.submissions.values()].map((s) => s.id));
    this.deadline = this.now() + this.settings.judgingSeconds * 1000;
    this.touch();
  }
  private findSubmission(id: string) {
    return [...this.submissions.values()].find((s) => s.id === id);
  }
  private votingPlayers() {
    return this.activePlayers().filter(
      (p) => p.connected && [...this.submissions.values()].some((s) => s.playerId !== p.id),
    );
  }
  vote(id: string, roundId: string, submissionId: string) {
    this.assertRound(roundId);
    requireRule(
      this.phase === 'judging' && this.settings.mode === 'democracy',
      'Voting is not open.',
    );
    requireRule(
      this.deadline !== null && this.now() < this.deadline,
      'The voting timer has expired.',
    );
    requireRule(
      this.votingPlayers().some((p) => p.id === id),
      'You are watching this round.',
    );
    requireRule(!this.votes.has(id), 'Your vote is already locked in.');
    const sub = this.findSubmission(submissionId);
    requireRule(sub, 'That submission is no longer available.');
    requireRule(sub.playerId !== id, 'You cannot vote for your own answer.', 'SELF_VOTE');
    this.votes.set(id, submissionId);
    this.maybeAdvance();
    this.touch();
  }
  choose(id: string, roundId: string, submissionId: string) {
    this.assertRound(roundId);
    requireRule(
      this.phase === 'judging' && this.settings.mode !== 'democracy',
      'Judging is not open.',
    );
    requireRule(
      id === this.judgeId && this.player(id).connected,
      'Only the current judge can choose the winner.',
    );
    requireRule(
      this.deadline !== null && this.now() < this.deadline,
      'The judging timer has expired.',
    );
    const sub = this.findSubmission(submissionId);
    requireRule(sub, 'That submission is no longer available.');
    this.resolve(sub, 'Chosen by the Card Judge.');
  }
  private tally() {
    if (!this.submissions.size) return this.resolve(null, 'No valid submissions remain.');
    const counts = new Map<string, number>();
    for (const sub of this.submissions.values()) counts.set(sub.id, 0);
    for (const id of this.votes.values()) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
    if (!this.votes.size) return this.resolve(null, 'Nobody voted. No point awarded.');
    const best = Math.max(...counts.values());
    const candidates = [...counts]
      .filter(([, n]) => n === best)
      .map(([id]) => this.findSubmission(id)!);
    this.resolve(
      candidates[randomInt(candidates.length)],
      candidates.length > 1
        ? `Tied at ${best} vote${best === 1 ? '' : 's'}; a random tiebreak picked the winner.`
        : `Won with ${best} vote${best === 1 ? '' : 's'}.`,
    );
  }
  private resolve(sub: Submission | null, reason: string) {
    const winner = sub ? this.players.get(sub.playerId) : null;
    const points = winner ? (this.modifier === 'double' ? 2 : 1) : 0;
    if (winner) winner.score += points;
    this.result = {
      round: this.round,
      prompt: this.prompt?.text ?? '',
      cards: sub?.cardIds.map((id) => this.responseCards.get(id)!.text) ?? [],
      winnerId: winner?.id ?? null,
      winnerName: winner?.nickname ?? null,
      points,
      reason,
    };
    this.history.push(this.result);
    for (const s of this.submissions.values()) this.discardPile.push(...s.cardIds);
    this.phase = 'results';
    this.deadline = this.now() + this.settings.resultSeconds * 1000;
    this.touch();
  }
  private advanceAfterResults() {
    if (
      (this.settings.winBy === 'rounds' && this.round >= this.settings.rounds) ||
      (this.settings.winBy === 'score' &&
        this.activePlayers().some((p) => p.score >= this.settings.targetScore))
    ) {
      this.finish('The winning condition was reached.');
    } else if (this.round >= 100) this.finish('The 100-round safety limit was reached.');
    else this.beginRound();
  }
  next(id: string, roundId: string) {
    this.assertHost(id);
    this.assertRound(roundId);
    requireRule(this.phase === 'results', 'The round is still in progress.');
    this.advanceAfterResults();
  }
  private finish(reason: string) {
    this.phase = 'finished';
    this.deadline = null;
    this.finishReason = reason;
    this.touch();
  }
  private replaceJudge() {
    if (this.settings.mode === 'democracy') return;
    const candidate = this.activePlayers().find(
      (p) => p.connected && !this.submissions.has(p.id) && p.id !== this.judgeId,
    );
    if (candidate) {
      this.judgeId = candidate.id;
      this.judgeCursor = candidate.id;
      this.eligible.delete(candidate.id);
    } else this.judgeId = null;
  }
  private maybeAdvance() {
    if (this.phase === 'submitting' && [...this.eligible].every((id) => this.submissions.has(id)))
      this.beginJudging();
    else if (this.phase === 'judging' && !this.submissions.size)
      this.resolve(null, 'No valid submissions remain.');
    else if (
      this.phase === 'judging' &&
      this.settings.mode === 'democracy' &&
      this.votingPlayers().every((p) => this.votes.has(p.id))
    )
      this.tally();
  }
  tick() {
    const before = this.revision;
    if (this.phase === 'submitting' || this.phase === 'judging') {
      const judge = this.judgeId ? this.players.get(this.judgeId) : undefined;
      if (
        this.settings.mode !== 'democracy' &&
        (!judge ||
          (!judge.connected &&
            judge.disconnectedAt !== null &&
            this.now() - judge.disconnectedAt >= 10000))
      ) {
        this.replaceJudge();
        this.touch();
        this.maybeAdvance();
        if (this.phase === 'judging' && !this.judgeId && this.submissions.size)
          this.resolve(
            shuffle([...this.submissions.values()])[0],
            'The judge left; a random submission wins.',
          );
      }
    }
    if (this.deadline !== null && this.now() >= this.deadline) {
      if (this.phase === 'submitting') this.beginJudging();
      else if (this.phase === 'judging') {
        if (this.settings.mode === 'democracy') this.tally();
        else
          this.resolve(
            shuffle([...this.submissions.values()])[0] ?? null,
            'Judging time expired; a random submission wins.',
          );
      } else if (this.phase === 'results') this.advanceAfterResults();
    }
    return this.revision !== before;
  }
  view(id: string): RoomView {
    const me = this.player(id);
    const visible =
      this.phase === 'judging' || this.phase === 'results' || this.phase === 'finished';
    const submissions: PublicSubmission[] = visible
      ? this.judgingOrder.flatMap((sid) => {
          const s = this.findSubmission(sid);
          return s
            ? [{ id: s.id, cards: s.cardIds.map((c) => this.responseCards.get(c)!.text) }]
            : [];
        })
      : [];
    return {
      code: this.code,
      hostId: this.hostId,
      revision: this.revision,
      phase: this.phase,
      settings: structuredClone(this.settings),
      players: [...this.players.values()].map(({ hand: _hand, disconnectedAt: _at, ...p }) => ({
        ...p,
      })),
      round: this.round,
      roundId: this.roundId,
      judgeId: this.judgeId,
      prompt: this.prompt ? { ...this.prompt } : null,
      modifier: this.modifier,
      deadline: this.deadline,
      serverNow: this.now(),
      submittedCount: this.submissions.size,
      eligibleCount: this.eligible.size,
      votedCount: this.votes.size,
      submissions,
      result: this.result ? structuredClone(this.result) : null,
      history: structuredClone(this.history),
      finishReason: this.finishReason,
      packs: [
        ...PACK_INFO,
        ...(this.customDeck
          ? [
              {
                id: 'custom',
                name: this.customDeck.name,
                description: 'Your room’s custom cards.',
                mature: false,
                prompts: this.customDeck.prompts.length,
                responses: this.customDeck.responses.length,
              },
            ]
          : []),
      ],
      me: {
        id,
        hand: me.hand.map((c) => ({ ...this.responseCards.get(c)! })),
        submitted: this.submissions.has(id),
        voted: this.votes.has(id),
        ownSubmissionId: this.submissions.get(id)?.id ?? null,
        canSubmit:
          this.phase === 'submitting' && this.eligible.has(id) && !this.submissions.has(id),
        canVote:
          this.phase === 'judging' &&
          this.settings.mode === 'democracy' &&
          !this.votes.has(id) &&
          this.votingPlayers().some((p) => p.id === id),
        customDeck: this.hostId === id && this.customDeck ? structuredClone(this.customDeck) : null,
      },
    };
  }
}

/** Replace with a durable repository plus serialized room actors when scaling beyond one process. */
export interface RoomRepository {
  get(code: string): GameRoom | undefined;
  set(room: GameRoom): void;
  delete(code: string): void;
  values(): IterableIterator<GameRoom>;
  size: number;
}
export class MemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, GameRoom>();
  get size() {
    return this.rooms.size;
  }
  get(code: string) {
    return this.rooms.get(code);
  }
  set(room: GameRoom) {
    this.rooms.set(room.code, room);
  }
  delete(code: string) {
    this.rooms.delete(code);
  }
  values() {
    return this.rooms.values();
  }
}
