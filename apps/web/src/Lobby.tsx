import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Download,
  Edit3,
  Flag,
  Link,
  LoaderCircle,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  CustomDeckSchema,
  MODES,
  type CustomDeck,
  type RoomView,
  type Settings,
} from '@card-chaos/shared';
import type { GameApi } from './useGame';
import { Avatar, copyText, Modal } from './components';

const modeText: Record<Settings['mode'], string> = {
  classic: 'A rotating judge picks the funniest answer.',
  democracy: 'Everyone votes. No voting for yourself.',
  speed: 'The classic game, with at most 20 seconds to answer.',
  chaos: 'Double points, random draws, and two-card prompts.',
  custom: 'Play with your own creations and any selected packs.',
};
export function Players({ game, scores = false }: { game: GameApi; scores?: boolean }) {
  const room = game.room!;
  const host = room.hostId === room.me.id;
  const players = scores ? [...room.players].sort((a, b) => b.score - a.score) : room.players;
  return (
    <div className="player-list">
      {players.map((p, i) => (
        <div className={`player-row ${p.id === room.me.id ? 'is-you' : ''}`} key={p.id}>
          {scores && <span className="rank">{String(i + 1).padStart(2, '0')}</span>}
          <Avatar player={p} />
          <div className="player-identity">
            <b>
              {p.nickname}
              {p.id === room.me.id && <small>you</small>}
              {p.id === room.hostId && <Crown size={13} aria-label="Host" />}
            </b>
            <span>
              {!p.connected
                ? 'Reconnecting…'
                : p.spectator
                  ? p.joinNext
                    ? 'Playing next round'
                    : 'Spectating'
                  : p.id === room.judgeId && scores
                    ? 'Card Judge'
                    : scores
                      ? 'In the game'
                      : p.ready
                        ? 'Ready for chaos'
                        : 'Getting comfortable'}
            </span>
          </div>
          {scores ? (
            <span className="player-score" aria-label={`${p.score} points`}>
              {p.score}
              <small>pts</small>
            </span>
          ) : (
            <span
              className={`ready-dot ${p.ready && p.connected ? 'ready' : ''}`}
              title={p.ready ? 'Ready' : 'Not ready'}
            >
              {p.ready && p.connected ? <Check size={14} /> : <Clock3 size={13} />}
            </span>
          )}
          {host && p.id !== room.me.id && (
            <div className="player-actions">
              <button
                disabled={game.busy || !p.connected}
                title={`Make ${p.nickname} host`}
                aria-label={`Make ${p.nickname} host`}
                onClick={() => void game.act('host:transfer', { playerId: p.id })}
              >
                <Crown size={14} />
              </button>
              <button
                disabled={game.busy}
                title={`Remove ${p.nickname}`}
                aria-label={`Remove ${p.nickname}`}
                onClick={() => {
                  if (confirm(`Remove ${p.nickname} from this room?`))
                    void game.act('player:kick', { playerId: p.id });
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
export function Lobby({ game }: { game: GameApi }) {
  const room = game.room!,
    host = room.hostId === room.me.id,
    me = room.players.find((p) => p.id === room.me.id)!;
  const [draft, setDraft] = useState(room.settings);
  const [copied, setCopied] = useState('');
  const [note, setNote] = useState('');
  const [editor, setEditor] = useState(false);
  const closeEditor = useCallback(() => setEditor(false), []);
  const key = JSON.stringify(room.settings);
  useEffect(() => setDraft(room.settings), [key]);
  const dirty = JSON.stringify(draft) !== key;
  const update = <K extends keyof Settings>(name: K, value: Settings[K]) =>
    setDraft((p) => ({ ...p, [name]: value }));
  const copy = async (value: string, label: string) => {
    try {
      await copyText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const link = `${location.origin}/?room=${room.code}`;
  const count = room.players.filter((p) => p.ready && p.connected).length;
  const allReady = room.players.length >= 3 && count === room.players.length;
  const selectedPacks = room.packs.filter((p) =>
    draft.decks.includes(p.id as Settings['decks'][number]),
  );
  return (
    <main className="room-page lobby-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">THE PRE-PARTY</div>
          <h1>
            Make yourself comfortable<span className="purple-text">.</span>
          </h1>
          <p>Invite your favorite people. Question their sense of humor.</p>
        </div>
        <div className="room-code-chip">
          <span>YOUR ROOM</span>
          <button onClick={() => void copy(room.code, 'code')} aria-label="Copy room code">
            {room.code}
            {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
      <div className="lobby-grid">
        <section className="panel people-panel">
          <div className="panel-heading">
            <h2>
              <Users size={18} /> The good company
            </h2>
            <span className="count-badge">
              {room.players.length}/{room.settings.maxPlayers}
            </span>
          </div>
          <Players game={game} />
          {room.players.length < 3 && (
            <div className="empty-seat">
              <div className="dashed-avatar">
                <Plus size={20} />
              </div>
              <div>
                <b>A little more chaos, please</b>
                <p>
                  Invite {3 - room.players.length} more{' '}
                  {room.players.length === 2 ? 'friend' : 'friends'} to get started.
                </p>
              </div>
            </div>
          )}
          <div className="invite-box">
            <div>
              <Link size={17} />
              <b>Good times are better shared.</b>
            </div>
            <p>Send this link to your group chat.</p>
            <div className="invite-link">
              <input
                aria-label="Invitation link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
              <button aria-label="Copy invitation link" onClick={() => void copy(link, 'link')}>
                {copied === 'link' ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </div>
          </div>
          <div className="lobby-ready">
            <div>
              <span className="status-dot" />
              <span>
                {count} of {room.players.length} ready
              </span>
            </div>
            <button
              className={`button ${me.ready ? 'ready-button' : 'primary'} full-width`}
              disabled={game.busy || !game.connected}
              onClick={() => void game.act('player:ready', { ready: !me.ready })}
            >
              {me.ready ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}{' '}
              {me.ready ? 'I’m ready · click to undo' : 'I’m ready for this'}
            </button>
            {host && (
              <>
                <button
                  className="button primary full-width"
                  disabled={!allReady || game.busy || dirty || !game.connected}
                  onClick={() => void game.act('game:start', {})}
                >
                  Start the chaos <ChevronRight size={20} />
                </button>
                <p className="form-footnote">
                  {dirty
                    ? 'Save your settings before starting.'
                    : !allReady
                      ? 'Everyone needs to be ready. Minimum 3 players.'
                      : 'Everyone’s in. Let the bad answers begin.'}
                </p>
              </>
            )}
            {!host && <p className="form-footnote">Your host will start once everyone is ready.</p>}
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>
              <Settings2 size={18} /> Set the mood
            </h2>
            <span className="soft-label">{host ? 'Host controls' : 'Chosen by your host'}</span>
          </div>
          <fieldset disabled={!host || game.busy} className="settings-fieldset">
            <label>
              Game mode
              <div className="mode-selector">
                {MODES.map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={draft.mode === mode ? 'selected' : ''}
                    onClick={() =>
                      setDraft((s) => ({
                        ...s,
                        mode,
                        ...(mode === 'custom'
                          ? {
                              allowCustom: true,
                              decks: [...new Set([...s.decks, 'custom' as const])],
                            }
                          : {}),
                      }))
                    }
                  >
                    {mode === 'custom' ? 'Custom deck' : mode}
                  </button>
                ))}
              </div>
            </label>
            <p className="field-help">{modeText[draft.mode]}</p>
            <div className="setting-grid">
              <label>
                Winning condition
                <select
                  value={draft.winBy}
                  onChange={(e) => update('winBy', e.target.value as Settings['winBy'])}
                >
                  <option value="rounds">Play a set number of rounds</option>
                  <option value="score">First to a target score</option>
                </select>
              </label>
              <label>
                {draft.winBy === 'rounds' ? 'Number of rounds' : 'Points to win'}
                <input
                  type="number"
                  min="1"
                  max={draft.winBy === 'rounds' ? 50 : 30}
                  value={draft.winBy === 'rounds' ? draft.rounds : draft.targetScore}
                  onChange={(e) =>
                    update(
                      draft.winBy === 'rounds' ? 'rounds' : 'targetScore',
                      Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Answer time
                <select
                  value={draft.submissionSeconds}
                  onChange={(e) => update('submissionSeconds', +e.target.value)}
                >
                  {[10, 15, 20, 30, 45, 60, 90, 120, 180].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Judging time
                <select
                  value={draft.judgingSeconds}
                  onChange={(e) => update('judgingSeconds', +e.target.value)}
                >
                  {[10, 15, 20, 30, 45, 60, 90, 120, 180].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Room capacity
                <input
                  type="number"
                  min="3"
                  max="100"
                  value={draft.maxPlayers}
                  onChange={(e) => update('maxPlayers', +e.target.value)}
                />
              </label>
              <label>
                Results time
                <select
                  value={draft.resultSeconds}
                  onChange={(e) => update('resultSeconds', +e.target.value)}
                >
                  {[3, 5, 8, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} seconds
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <div className="decks-heading">
            <div>
              <h3>The card collection</h3>
              <p>
                {selectedPacks.reduce((n, p) => n + p.prompts, 0)} prompts ·{' '}
                {selectedPacks.reduce((n, p) => n + p.responses, 0)} answers selected
              </p>
            </div>
            {host && (
              <button className="text-button" onClick={() => setEditor(true)}>
                <Edit3 size={14} /> Custom deck
              </button>
            )}
          </div>
          <div className="deck-list">
            {room.packs.map((pack) => (
              <label
                key={pack.id}
                className={`deck-option ${draft.decks.includes(pack.id as Settings['decks'][number]) ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  disabled={
                    !host ||
                    game.busy ||
                    (pack.mature && !draft.mature) ||
                    (pack.id === 'custom' && !draft.allowCustom)
                  }
                  checked={draft.decks.includes(pack.id as Settings['decks'][number])}
                  onChange={(e) =>
                    update(
                      'decks',
                      e.target.checked
                        ? [...draft.decks, pack.id as Settings['decks'][number]]
                        : draft.decks.filter((id) => id !== pack.id),
                    )
                  }
                />
                <span className={`pack-dot ${pack.id}`} />
                <span>
                  <b>
                    {pack.name}
                    {pack.mature && <small>18+</small>}
                  </b>
                  <span>{pack.description}</span>
                </span>
                <span className="deck-count">{pack.responses + pack.prompts}</span>
              </label>
            ))}
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              disabled={!host || game.busy}
              checked={draft.allowCustom}
              onChange={(e) =>
                setDraft((s) => ({
                  ...s,
                  allowCustom: e.target.checked,
                  decks: e.target.checked ? s.decks : s.decks.filter((id) => id !== 'custom'),
                  mode: !e.target.checked && s.mode === 'custom' ? 'classic' : s.mode,
                }))
              }
            />
            <span>Allow custom cards</span>
          </label>
          <label className="toggle-row mature-toggle">
            <input
              type="checkbox"
              disabled={!host || game.busy}
              checked={draft.mature}
              onChange={(e) =>
                setDraft((s) => ({
                  ...s,
                  mature: e.target.checked,
                  decks: e.target.checked ? s.decks : s.decks.filter((id) => id !== 'mature'),
                }))
              }
            />
            <span>
              <b>Enable mature content · 18+</b>
              <small>
                Adult situations and suggestive humor. Enable only if everyone is comfortable.
              </small>
            </span>
          </label>
          {host && (
            <div className="settings-save">
              <span>{dirty ? 'You have unsaved changes' : 'Settings are up to date'}</span>
              <button
                className="button secondary small-button"
                disabled={!dirty || game.busy || !game.connected}
                onClick={() => void game.act('room:settings', { settings: draft })}
              >
                <Check size={16} /> Save settings
              </button>
            </div>
          )}
        </section>
      </div>
      {note && (
        <p role="status" className="notice">
          {note}
        </p>
      )}
      {editor && <DeckEditor game={game} onClose={closeEditor} />}
    </main>
  );
}

function DeckEditor({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const initial = game.room!.me.customDeck;
  const [name, setName] = useState(initial?.name ?? 'Our inside jokes');
  const [prompts, setPrompts] = useState(
    initial?.prompts.map((p) => `${p.pick} | ${p.text}`).join('\n') ??
      '1 | Our group chat is mostly ____.',
  );
  const [responses, setResponses] = useState(
    initial?.responses.join('\n') ??
      'A spreadsheet of inside jokes\nThe friend who is always almost there\nAn aggressively supportive group chat',
  );
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const getDeck = (): CustomDeck =>
    CustomDeckSchema.parse({
      name,
      prompts: prompts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^([1-3])\s*\|\s*(.+)$/);
          return {
            text: match ? match[2] : line,
            pick: match ? Number(match[1]) : Math.max(1, (line.match(/____/g) ?? []).length),
          };
        }),
      responses: responses
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      if (f.size > 150000) throw new Error('Use a JSON file smaller than 150 KB.');
      const deck = CustomDeckSchema.parse(JSON.parse(await f.text()));
      setName(deck.name);
      setPrompts(deck.prompts.map((p) => `${p.pick} | ${p.text}`).join('\n'));
      setResponses(deck.responses.join('\n'));
      setError('');
    } catch (e) {
      setError(
        'Import failed. Use the exported JSON format with unique card text. ' +
          (e instanceof Error && !('issues' in e) ? e.message : ''),
      );
    }
  };
  const exportFile = () => {
    try {
      const deck = getDeck();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'card-chaos-custom-deck.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
    } catch {
      setError(
        'Check your cards: each needs text; prompts use 1–3 answers, and cards must be unique.',
      );
    }
  };
  const save = async () => {
    try {
      const deck = getDeck();
      if (await game.act('room:deck', { deck })) {
        const s = game.room!.settings;
        if (
          await game.act('room:settings', {
            settings: {
              ...s,
              allowCustom: true,
              decks: [...new Set([...s.decks, 'custom' as const])],
            },
          })
        )
          onClose();
      }
    } catch {
      setError(
        'Check your cards: each needs text; prompts use 1–3 answers, and cards must be unique.',
      );
    }
  };
  return (
    <Modal title="Make it personal." wide onClose={onClose}>
      <p className="modal-intro">
        Write your own pack, or bring one from another room. One card per line.
      </p>
      <div className="editor-toolbar">
        <button className="button secondary small-button" onClick={() => file.current?.click()}>
          <Upload size={15} /> Import JSON
        </button>
        <button className="button secondary small-button" onClick={exportFile}>
          <Download size={15} /> Export JSON
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </div>
      <label>
        Pack name
        <input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="editor-grid">
        <label>
          Black prompts
          <textarea rows={11} value={prompts} onChange={(e) => setPrompts(e.target.value)} />
          <small>Format: 1 | Your prompt ____. Use 2 or 3 for multiple answers.</small>
        </label>
        <label>
          White responses
          <textarea rows={11} value={responses} onChange={(e) => setResponses(e.target.value)} />
          <small>Up to 600 unique responses, 160 characters each.</small>
        </label>
      </div>
      <p className="notice">
        A game needs 10 response cards per player. Small custom packs work alongside the bundled
        decks. Cards stay in this room; export a copy to keep them.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={game.busy || !game.connected}
        onClick={() => void save()}
      >
        Save and enable this deck <Check size={18} />
      </button>
    </Modal>
  );
}
