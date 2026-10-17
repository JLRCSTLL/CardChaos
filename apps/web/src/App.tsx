import { lazy, Suspense, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  Crown,
  Gamepad2,
  Globe2,
  Link,
  LockKeyhole,
  Menu,
  Plus,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { COLORS, PACK_INFO, type Profile } from '@card-chaos/shared';
import { readSession, useGame } from './useGame';
import { Brand, Modal } from './components';
const Lobby = lazy(() => import('./Lobby').then((module) => ({ default: module.Lobby })));
const Game = lazy(() => import('./Game').then((module) => ({ default: module.Game })));

const modeDescriptions = [
  { name: 'Classic', icon: Crown, text: 'One judge. Zero good answers.', color: 'purple' },
  { name: 'Democracy', icon: Users, text: 'The group has the final say.', color: 'green' },
  { name: 'Speed', icon: Zap, text: 'Less thinking. More regretting.', color: 'orange' },
  { name: 'Chaos', icon: Shuffle, text: 'Expect the very unexpected.', color: 'pink' },
];
export default function App() {
  const game = useGame();
  const inviteCode = new URLSearchParams(location.search).get('room') ?? '';
  const [dialog, setDialog] = useState<'create' | 'join' | 'rules' | 'packs' | null>(
    inviteCode && !readSession() ? 'join' : null,
  );
  const [code, setCode] = useState(inviteCode);
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('card-chaos-profile') ?? 'null') ?? {
          nickname: '',
          color: 'violet',
        }
      );
    } catch {
      return { nickname: '', color: 'violet' };
    }
  });
  const close = useCallback(() => setDialog(null), []);
  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok =
      dialog === 'create'
        ? await game.act('room:create', { profile })
        : await game.act('room:join', { profile, code: code.trim().toUpperCase() });
    if (ok) {
      try {
        localStorage.setItem('card-chaos-profile', JSON.stringify(profile));
      } catch {}
      close();
    }
  };
  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          {!game.room && (
            <>
              <button onClick={() => setDialog('rules')}>How to play</button>
              <button onClick={() => setDialog('packs')}>
                The decks <span className="tiny-tag">5</span>
              </button>
              <span className="nav-divider" />
            </>
          )}
          <span className={`connection ${game.connected ? 'online' : ''}`}>
            <span className="status-dot" />
            {game.connected ? 'Let’s get together' : 'Connecting…'}
          </span>
          {game.room && (
            <button
              className="button ghost small-button"
              disabled={game.busy}
              onClick={() => {
                if (confirm('Leave this room? Your seat and score will be removed.'))
                  void game.act('room:leave', {});
              }}
            >
              Leave room
            </button>
          )}
        </nav>
      </header>
      {game.room && (!game.connected || game.restoring) && (
        <div className="connection-banner" role="status">
          {game.restoring
            ? 'Restoring your cards and score…'
            : 'Connection lost. Your seat is saved for two minutes.'}
          <button onClick={game.reconnect}>Reconnect</button>
        </div>
      )}
      {game.restoring && !game.room ? (
        <main className="restore-state">
          <span className="loading-orbit" />
          <h1>Finding your seat…</h1>
          <p>Your cards are right where you left them.</p>
        </main>
      ) : game.room ? (
        <Suspense
          fallback={
            <main className="restore-state" role="status">
              <span className="loading-orbit" />
              <p>Setting the table…</p>
            </main>
          }
        >
          {game.room.phase === 'lobby' ? <Lobby game={game} /> : <Game game={game} />}
        </Suspense>
      ) : (
        <>
          <main className="landing">
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="status-dot" /> THE GROUP CHAT JUST GOT AN UPGRADE
                </div>
                <h1>
                  Bad answers.
                  <br />
                  <span>Great friends.</span>
                </h1>
                <p className="hero-description">
                  A party card game for people with questionable humor
                  <br className="desktop-break" /> and excellent taste in friends. Bring your worst.
                </p>
                <div className="hero-actions">
                  <button className="button primary" onClick={() => setDialog('create')}>
                    <Plus size={19} /> Create a game <ArrowRight size={18} />
                  </button>
                  <button className="button secondary" onClick={() => setDialog('join')}>
                    <Link size={18} /> Join a game
                  </button>
                </div>
                <div className="hero-meta">
                  <span>
                    <Users size={15} /> 3–20 players
                  </span>
                  <i />
                  <span>
                    <Globe2 size={15} /> Any browser
                  </span>
                  <i />
                  <span>
                    <LockKeyhole size={14} /> No sign-up
                  </span>
                </div>
                <div className="friend-note">
                  <div className="mini-friends">
                    <span>✦</span>
                    <span>☻</span>
                    <span>↯</span>
                    <span>☺</span>
                  </div>
                  <p>
                    A little unhinged.
                    <br />
                    <strong>A lot better together.</strong>
                  </p>
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="Example cards: My superpower? Making every situation slightly more awkward."
              >
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <span className="floating-symbol symbol-star">✳</span>
                <span className="floating-symbol symbol-plus">+</span>
                <span className="floating-symbol symbol-spark">✧</span>
                <motion.div
                  className="sample-card black-sample"
                  initial={{ opacity: 0, rotate: -16, y: 24 }}
                  animate={{ opacity: 1, rotate: -11, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="sample-top">
                    <span>THE PROMPT</span>
                    <Zap size={18} />
                  </div>
                  <p>
                    My superpower?
                    <br />
                    <span className="sample-underline">__________</span>
                  </p>
                  <div className="sample-bottom">
                    <span>cardchaos.</span>
                    <span>PICK 1</span>
                  </div>
                </motion.div>
                <motion.div
                  className="sample-card white-sample"
                  initial={{ opacity: 0, rotate: 15, y: 40 }}
                  animate={{ opacity: 1, rotate: 9, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.12 }}
                >
                  <div className="sample-top">
                    <span>YOUR BAD ANSWER</span>
                    <Sparkles size={18} />
                  </div>
                  <p>Making every situation slightly more awkward.</p>
                  <div className="sample-bottom">
                    <span>cardchaos.</span>
                    <span>✦</span>
                  </div>
                </motion.div>
                <div className="funny-sticker">
                  <span>100%</span>
                  <strong>
                    friendship
                    <br />
                    testing
                  </strong>
                </div>
                <div className="example-label">
                  <span /> A perfectly terrible combination.
                </div>
              </div>
            </section>
            <section className="how-strip" id="how-to-play" aria-label="How to play">
              <div className="strip-title">
                <span>THE VERY SHORT VERSION</span>
                <h2>
                  Easy to play.
                  <br />
                  Hard to explain to your parents.
                </h2>
              </div>
              <div className="how-step">
                <span className="step-number">01</span>
                <div>
                  <h3>Gather your people</h3>
                  <p>Make a room. Drop the link.</p>
                </div>
              </div>
              <div className="how-step">
                <span className="step-number">02</span>
                <div>
                  <h3>Play your worst card</h3>
                  <p>Make the prompt a little worse.</p>
                </div>
              </div>
              <div className="how-step">
                <span className="step-number">03</span>
                <div>
                  <h3>Win the room</h3>
                  <p>The funniest answer takes the point.</p>
                </div>
              </div>
            </section>
            <section className="modes-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow muted">SAME FRIENDS. DIFFERENT FLAVOR OF CHAOS.</span>
                  <h2>Find your kind of trouble.</h2>
                </div>
                <span className="soft-label">
                  <Shuffle size={14} /> Switch it up in the lobby
                </span>
              </div>
              <div className="mode-grid">
                {modeDescriptions.map(({ name, icon: Icon, text, color }) => (
                  <button
                    key={name}
                    className={`mode-card ${color}`}
                    onClick={() => setDialog('create')}
                  >
                    <span className="mode-icon">
                      <Icon size={21} />
                    </span>
                    <div>
                      <h3>
                        {name} <ArrowRight size={14} />
                      </h3>
                      <p>{text}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </main>
          <footer className="site-footer">
            <Brand small />
            <span>Original cards. Unoriginal excuses for losing.</span>
            <button onClick={() => setDialog('packs')}>
              Made for your kind of people <span>↗</span>
            </button>
          </footer>
        </>
      )}
      <AnimatePresence>
        {game.error && (
          <motion.div
            role="alert"
            className="toast error-toast"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={20} />
            <span>{game.error}</span>
            <button onClick={game.clearError} aria-label="Dismiss error">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {(dialog === 'create' || dialog === 'join') && !game.room && (
        <Modal
          title={dialog === 'create' ? 'Your people. Your room.' : 'You’re on the guest list.'}
          onClose={close}
        >
          <p className="modal-intro">
            {dialog === 'create'
              ? 'Pick a name. We’ll handle the bad decisions.'
              : 'Enter your name and the six-character room code.'}
          </p>
          <form onSubmit={join} className="join-form">
            <label>
              Your nickname
              <input
                autoComplete="nickname"
                minLength={2}
                maxLength={20}
                required
                placeholder="e.g. Captain Chaos"
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
              />
            </label>
            <fieldset className="color-fieldset">
              <legend>Pick your color</legend>
              <div className="color-picker">
                {COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`${color} avatar`}
                    aria-pressed={profile.color === color}
                    onClick={() => setProfile({ ...profile, color })}
                    className={`color-swatch ${color}`}
                  >
                    {profile.color === color && <Check size={20} />}
                  </button>
                ))}
              </div>
            </fieldset>
            {dialog === 'join' && (
              <label>
                Room code
                <input
                  className="code-input"
                  required
                  minLength={6}
                  maxLength={6}
                  value={code}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABC234"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </label>
            )}
            <button className="button primary full-width" disabled={game.busy || !game.connected}>
              {game.busy
                ? 'Finding your seat…'
                : dialog === 'create'
                  ? 'Create my room'
                  : 'Join the chaos'}
              <ArrowRight size={18} />
            </button>
            <p className="form-footnote">
              <ShieldCheck size={14} /> Private rooms. No accounts. Just your people.
            </p>
          </form>
        </Modal>
      )}
      {dialog === 'rules' && (
        <Modal title="A very good time. A very bad answer." onClose={close}>
          <ol className="rules-list">
            <li>
              <b>Get everyone in.</b> Create a room, share the link, and have at least three players
              mark ready.
            </li>
            <li>
              <b>Read the prompt.</b> Everyone gets ten response cards. Select the required cards in
              the order you want them read.
            </li>
            <li>
              <b>Commit to the bit.</b> Submit before time runs out. The judge sees shuffled,
              anonymous answers.
            </li>
            <li>
              <b>Make someone laugh.</b> The judge picks a winner. In Democracy, everyone votes and
              cannot choose their own answer.
            </li>
            <li>
              <b>Do it all again.</b> Draw back to ten cards, rotate the judge, and play until the
              round or score goal is met.
            </li>
          </ol>
          <p className="notice">
            Speed caps answers at 20 seconds. Chaos rotates double points, random draws, and
            two-card prompts. Late arrivals can watch or join the next round.
          </p>
          <button className="button primary full-width" onClick={() => setDialog('create')}>
            Okay, let’s play <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {dialog === 'packs' && (
        <Modal title="Five decks. Endless bad ideas." onClose={close}>
          <div className="pack-preview-list">
            {PACK_INFO.map((p) => (
              <div key={p.id}>
                <span className={`pack-dot ${p.id}`} />
                <div>
                  <b>
                    {p.name}
                    {p.mature && <small>18+</small>}
                  </b>
                  <p>{p.description}</p>
                  <span>
                    {p.prompts} prompts · {p.responses} answers
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="notice">
            After hours is off by default and requires the host’s explicit opt-in. You can also
            write, edit, import, and export custom packs in the lobby.
          </p>
        </Modal>
      )}
    </div>
  );
}
