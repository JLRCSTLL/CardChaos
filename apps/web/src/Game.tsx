import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Crown,
  Eye,
  Flag,
  Home,
  Layers,
  LockKeyhole,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { RoomView } from '@card-chaos/shared';
import type { GameApi } from './useGame';
import { Avatar, PromptText } from './components';
import { Players } from './Lobby';
function useCountdown(room: RoomView) {
  const [time, setTime] = useState(Date.now());
  const [offset, setOffset] = useState(room.serverNow - Date.now());
  useEffect(() => {
    setOffset(room.serverNow - Date.now());
  }, [room.serverNow]);
  useEffect(() => {
    const id = setInterval(() => setTime(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  return room.deadline ? Math.max(0, Math.ceil((room.deadline - time - offset) / 1000)) : 0;
}
const modifierLabels = {
  double: 'Double trouble · 2 points',
  random: 'Wild draw · the cards chose you',
  'double-pick': 'Double take · play 2 cards',
};
export function Game({ game }: { game: GameApi }) {
  const room = game.room!,
    host = room.hostId === room.me.id;
  const [selected, setSelected] = useState<string[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [scoresOpen, setScoresOpen] = useState(false);
  const remaining = useCountdown(room);
  useEffect(() => {
    setSelected([]);
    setChoice(null);
  }, [room.roundId, room.phase]);
  const me = room.players.find((p) => p.id === room.me.id)!;
  const judge = room.players.find((p) => p.id === room.judgeId);
  const isJudge = room.judgeId === room.me.id;
  const democracy = room.settings.mode === 'democracy';
  const canChoose = room.phase === 'judging' && (democracy ? room.me.canVote : isJudge);
  const pick = room.prompt?.pick ?? 1;
  const answers = selected.map((id) => room.me.hand.find((c) => c.id === id)?.text ?? '');
  const select = (id: string) =>
    setSelected((s) =>
      s.includes(id)
        ? s.filter((c) => c !== id)
        : s.length < pick
          ? [...s, id]
          : pick === 1
            ? [id]
            : s,
    );
  if (room.phase === 'finished') return <FinalResults game={game} />;
  return (
    <main className="room-page game-page">
      <div className="game-topbar">
        <div className="round-label">
          <span className="eyebrow muted">ROOM {room.code}</span>
          <h1>
            Round {String(room.round).padStart(2, '0')}
            <span>
              {room.settings.winBy === 'rounds'
                ? `/ ${room.settings.rounds}`
                : `· first to ${room.settings.targetScore}`}
            </span>
          </h1>
        </div>
        <div className="game-top-meta">
          <span className="mode-pill">
            <Shuffle size={14} />
            {room.settings.mode}
          </span>
          <button
            className="button secondary small-button mobile-score-toggle"
            onClick={() => setScoresOpen((p) => !p)}
          >
            <Trophy size={16} /> Scores <ChevronDown size={14} />
          </button>
          <div
            className={`timer ${remaining <= 10 ? 'urgent' : ''}`}
            role="timer"
            aria-label={`${remaining} seconds remaining`}
          >
            <Clock3 size={19} />
            <strong>{remaining.toString().padStart(2, '0')}</strong>
            <span>sec</span>
          </div>
        </div>
      </div>
      {me.spectator && (
        <div className="spectator-banner">
          <Eye size={18} />
          <span>
            {me.joinNext
              ? 'You’re on the list. Your cards arrive next round.'
              : 'You have a front-row seat. Join the next round whenever you’re ready.'}
          </span>
          <button
            className="button secondary small-button"
            disabled={game.busy || !game.connected}
            onClick={() => void game.act('player:participate', { participate: !me.joinNext })}
          >
            {me.joinNext ? 'Keep watching' : 'Play next round'}
          </button>
        </div>
      )}
      <div className="game-layout">
        <div className="game-table">
          <section className="prompt-area">
            <div className="prompt-card">
              <div className="prompt-header">
                <span>
                  <Zap size={15} fill="currentColor" /> THE PROMPT
                </span>
                <span className="pick-badge">PICK {pick}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={room.roundId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <PromptText text={room.prompt?.text ?? 'Waiting for your friends…'} />
                </motion.h2>
              </AnimatePresence>
              <div className="prompt-footer">
                <span>cardchaos.</span>
                <span>
                  {room.modifier
                    ? modifierLabels[room.modifier]
                    : `From ${room.packs.find((p) => p.id === room.prompt?.pack)?.name ?? 'your custom deck'}`}
                </span>
              </div>
            </div>
            <div className="round-status">
              <div>
                <span className="status-dot" />
                <b>
                  {room.phase === 'submitting'
                    ? 'Make it a bad answer.'
                    : room.phase === 'judging'
                      ? democracy
                        ? 'The room decides.'
                        : 'Judgment time.'
                      : 'We have a winner.'}
                </b>
              </div>
              <span>
                {room.phase === 'submitting'
                  ? `${room.submittedCount} of ${room.eligibleCount} answers in`
                  : room.phase === 'judging'
                    ? democracy
                      ? `${room.votedCount} votes locked`
                      : `${judge?.nickname ?? 'An automatic tiebreak'} is choosing`
                    : 'Next round coming up'}
              </span>
            </div>
            {room.phase === 'submitting' && (
              <div
                className="submission-progress"
                aria-label={`${room.submittedCount} of ${room.eligibleCount} submissions`}
              >
                <div
                  style={{
                    width: `${room.eligibleCount ? (room.submittedCount / room.eligibleCount) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </section>
          {room.phase === 'submitting' && (
            <>
              {room.me.canSubmit ? (
                <section className="hand-section">
                  <div className="hand-heading">
                    <div>
                      <h2>
                        Your hand<span className="count-badge">{room.me.hand.length}</span>
                      </h2>
                      <p>
                        {pick > 1
                          ? `Pick ${pick} cards in the order they should be read.`
                          : 'Choose the answer that will make your friends question everything.'}
                      </p>
                    </div>
                    <span className="soft-label">
                      <LockKeyhole size={13} /> Just for you
                    </span>
                  </div>
                  <div className="hand-grid">
                    {room.me.hand.map((card, index) => (
                      <motion.button
                        key={card.id}
                        className={`response-card ${selected.includes(card.id) ? 'card-selected' : ''}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.025, 0.2) }}
                        whileHover={{ y: -5 }}
                        aria-pressed={selected.includes(card.id)}
                        disabled={game.busy || !game.connected || remaining === 0}
                        onClick={() => select(card.id)}
                      >
                        <span className="selection-number">
                          {selected.includes(card.id) ? selected.indexOf(card.id) + 1 : ''}
                        </span>
                        <span className="response-text">{card.text}</span>
                        <span className="response-brand">
                          cardchaos.
                          <Sparkles size={12} />
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="submit-dock">
                    <div>
                      <span className="eyebrow muted">
                        {selected.length
                          ? 'YOUR MASTERPIECE'
                          : `${pick} CARD${pick > 1 ? 'S' : ''}. ONE QUESTIONABLE DECISION.`}
                      </span>
                      <p>
                        {selected.length ? (
                          <PromptText text={room.prompt!.text} answers={answers} />
                        ) : (
                          'Your selected answer will appear here.'
                        )}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      disabled={
                        selected.length !== pick || game.busy || !game.connected || remaining === 0
                      }
                      onClick={() =>
                        void game.act('card:submit', { roundId: room.roundId, cardIds: selected })
                      }
                    >
                      <Send size={17} /> Lock it in{' '}
                      <span>
                        {selected.length}/{pick}
                      </span>
                    </button>
                  </div>
                </section>
              ) : (
                <motion.section
                  className="waiting-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="waiting-icon">
                    {isJudge ? (
                      <Crown size={35} />
                    ) : room.me.submitted ? (
                      <CheckCircle2 size={35} />
                    ) : (
                      <Eye size={35} />
                    )}
                  </span>
                  <h2>
                    {isJudge
                      ? 'Heavy is the imaginary crown.'
                      : room.me.submitted
                        ? 'Terrible answer. Excellent choice.'
                        : 'Enjoy the questionable decisions.'}
                  </h2>
                  <p>
                    {isJudge
                      ? 'You’re the Card Judge. Your friends are picking their worst. All answers will be anonymous.'
                      : room.me.submitted
                        ? 'Your cards are locked in. Waiting for the rest of the room…'
                        : 'You’re watching this round. The answers will appear when everyone is done.'}
                  </p>
                  <div className="waiting-dots">
                    <i />
                    <i />
                    <i />
                  </div>
                </motion.section>
              )}
            </>
          )}
          {room.phase === 'judging' && (
            <section className="judging-section">
              <div className="hand-heading">
                <div>
                  <h2>{canChoose ? 'Choose your favorite disaster.' : 'The answers are in.'}</h2>
                  <p>
                    {democracy
                      ? room.me.voted
                        ? 'Your vote is locked. No lobbying the group chat.'
                        : 'One vote each. Your own answer is off limits.'
                      : isJudge
                        ? 'Read them out. Pick the answer that deserves a point.'
                        : `${judge?.nickname ?? 'The game'} will pick a winner. Sit back and enjoy.`}
                  </p>
                </div>
                <span className="soft-label">
                  <Shuffle size={14} /> Shuffled & anonymous
                </span>
              </div>
              <div className="submissions-grid">
                {room.submissions.map((submission, index) => {
                  const own = submission.id === room.me.ownSubmissionId;
                  return (
                    <motion.button
                      key={submission.id}
                      initial={{ opacity: 0, rotateY: 40 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.4) }}
                      className={`submission-card ${choice === submission.id ? 'chosen' : ''} ${own ? 'own-answer' : ''}`}
                      disabled={
                        !canChoose ||
                        (democracy && own) ||
                        game.busy ||
                        !game.connected ||
                        remaining === 0
                      }
                      onClick={() => setChoice(submission.id)}
                    >
                      <span className="answer-label">
                        ANSWER {String(index + 1).padStart(2, '0')}
                        {own ? (
                          <span>YOURS</span>
                        ) : choice === submission.id ? (
                          <Check size={16} />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </span>
                      <span className="answer-lines">
                        {submission.cards.map((card, i) => (
                          <span key={i}>
                            {i > 0 && <small>+</small>}
                            {card}
                          </span>
                        ))}
                      </span>
                      <span className="response-brand">cardchaos.</span>
                    </motion.button>
                  );
                })}
              </div>
              {canChoose && (
                <div className="judging-dock">
                  <span>
                    {choice
                      ? 'A bold choice. Ready to make it official?'
                      : 'Pick an answer above to continue.'}
                  </span>
                  <button
                    className="button primary"
                    disabled={!choice || game.busy || !game.connected || remaining === 0}
                    onClick={() =>
                      choice &&
                      void game.act(democracy ? 'vote:submit' : 'judge:choose', {
                        roundId: room.roundId,
                        submissionId: choice,
                      })
                    }
                  >
                    {democracy ? <CheckCircle2 size={18} /> : <Trophy size={18} />}{' '}
                    {democracy ? 'Cast my vote' : 'Crown the winner'}
                  </button>
                </div>
              )}
            </section>
          )}
          {room.phase === 'results' && (
            <motion.section
              className="round-result"
              key={`result-${room.roundId}`}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <span className="result-star">✳</span>
              <span className="eyebrow">
                {room.result?.winnerId ? 'A BEAUTIFULLY BAD ANSWER' : 'A MOMENT OF SILENCE'}
              </span>
              <h2>
                {room.result?.winnerName ? (
                  <>
                    {room.result.winnerName} takes the round<span>!</span>
                  </>
                ) : (
                  'This round is a draw.'
                )}
              </h2>
              <div className="winning-answer">
                {room.result?.cards.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
              <p>{room.result?.reason ?? 'Waiting for at least two players to reconnect…'}</p>
              {room.result?.points ? (
                <div className="points-earned">
                  <Trophy size={16} /> +{room.result.points} point
                  {room.result.points > 1 ? 's' : ''}
                </div>
              ) : null}
              <div className="next-round">
                <span>Continuing in {remaining}s</span>
                {host && (
                  <button
                    className="button primary"
                    disabled={game.busy || !game.connected}
                    onClick={() => void game.act('round:next', { roundId: room.roundId })}
                  >
                    {room.settings.winBy === 'rounds' && room.round >= room.settings.rounds
                      ? 'See final results'
                      : 'Keep it going'}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </motion.section>
          )}
        </div>
        <aside className={`game-sidebar ${scoresOpen ? 'open' : ''}`}>
          <section className="panel scoreboard-panel">
            <div className="panel-heading">
              <h2>
                <Trophy size={17} /> The leaderboard
              </h2>
              <span className="count-badge">{room.players.length}</span>
            </div>
            <Players game={game} scores />
            <div className="judge-info">
              {democracy ? <Users size={20} /> : <Crown size={20} />}
              <div>
                <span>{democracy ? 'POWER TO THE PEOPLE' : 'THIS ROUND’S JUDGE'}</span>
                <b>
                  {democracy
                    ? 'Every player gets a vote'
                    : (judge?.nickname ?? 'Automatic selection')}
                </b>
              </div>
            </div>
          </section>
          <div className="table-note">
            <Sparkles size={18} />
            <p>
              Keep it funny.
              <br />
              Keep it friendly.
              <br />
              <b>Keep it questionable.</b>
            </p>
          </div>
          {host && (
            <div className="host-game-controls">
              <button
                onClick={() => {
                  if (confirm('End this game and show the final scores?'))
                    void game.act('game:end', {});
                }}
                disabled={game.busy || !game.connected}
              >
                <Flag size={14} /> End game
              </button>
              <button
                onClick={() => {
                  if (confirm('Return everyone to the lobby? Current scores will reset.'))
                    void game.act('game:lobby', {});
                }}
                disabled={game.busy || !game.connected}
              >
                <Home size={14} /> Back to lobby
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
function FinalResults({ game }: { game: GameApi }) {
  const room = game.room!,
    host = room.hostId === room.me.id;
  const ranked = [...room.players].filter((p) => !p.spectator).sort((a, b) => b.score - a.score);
  const best = ranked[0]?.score ?? 0,
    winners = ranked.filter((p) => p.score === best);
  return (
    <main className="room-page final-page">
      <motion.section
        className="final-hero"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="trophy-medallion">
          <Trophy size={40} />
          <i>✦</i>
          <i>✧</i>
        </div>
        <div className="eyebrow">THE FRIENDSHIP SURVIVED. PROBABLY.</div>
        <h1>
          {best === 0 ? (
            'No points. Plenty of potential.'
          ) : winners.length > 1 ? (
            'Shared glory. Double the ego.'
          ) : (
            <>
              {winners[0].nickname}
              <br />
              <span>has won the chaos.</span>
            </>
          )}
        </h1>
        {winners.length > 1 && best > 0 && (
          <p className="tie-names">{winners.map((p) => p.nickname).join(' & ')}</p>
        )}
        <p>{room.finishReason}</p>
        <div className="final-stats">
          <div>
            <strong>{room.history.length}</strong>
            <span>rounds played</span>
          </div>
          <div>
            <strong>{best}</strong>
            <span>winning points</span>
          </div>
          <div>
            <strong>{ranked.length}</strong>
            <span>questionable people</span>
          </div>
        </div>
        <div className="final-actions">
          {host ? (
            <>
              <button
                className="button primary"
                disabled={game.busy || !game.connected}
                onClick={() => void game.act('game:restart', {})}
              >
                <RotateCcw size={17} /> Play again
              </button>
              <button
                className="button secondary"
                disabled={game.busy || !game.connected}
                onClick={() => void game.act('game:lobby', {})}
              >
                <Home size={17} /> Return to lobby
              </button>
            </>
          ) : (
            <p className="notice">Waiting for your host to set up the next game.</p>
          )}
        </div>
        {host && (
          <p className="form-footnote">Play again returns everyone to the lobby to ready up.</p>
        )}
      </motion.section>
      <div className="final-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Trophy size={18} /> The final standings
            </h2>
          </div>
          <Players game={game} scores />
        </section>
        <section className="panel recap-panel">
          <div className="panel-heading">
            <h2>
              <Layers size={18} /> For the group chat
            </h2>
            <span className="soft-label">Winning answers</span>
          </div>
          {room.history.filter((r) => r.winnerId).length === 0 ? (
            <p className="notice">No winning answers this time. A rematch is clearly necessary.</p>
          ) : (
            room.history
              .filter((r) => r.winnerId)
              .map((result) => (
                <article className="recap" key={result.round}>
                  <div>
                    <span>ROUND {String(result.round).padStart(2, '0')}</span>
                    <b>
                      {result.winnerName}
                      <small>+{result.points}</small>
                    </b>
                  </div>
                  <p>
                    <PromptText text={result.prompt} answers={result.cards} />
                  </p>
                </article>
              ))
          )}
        </section>
      </div>
    </main>
  );
}
