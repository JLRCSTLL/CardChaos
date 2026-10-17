import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, X, Zap } from 'lucide-react';
import type { PublicPlayer } from '@card-chaos/shared';
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <a
      href="/"
      className={`brand ${small ? 'small' : ''}`}
      aria-label="Card Chaos home"
      onClick={(e) => {
        if (location.search) e.preventDefault();
      }}
    >
      <span className="brand-icon">
        <Zap size={21} strokeWidth={2.6} fill="currentColor" />
      </span>
      <span>
        card<span className="brand-light">chaos</span>
        <span className="brand-dot">.</span>
      </span>
    </a>
  );
}
export function Avatar({
  player,
  size = '',
}: {
  player: Pick<PublicPlayer, 'nickname' | 'color'>;
  size?: string;
}) {
  return (
    <span className={`avatar ${player.color} ${size}`} aria-hidden="true">
      {player.nickname.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusable = () => [
      ...el.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
      ),
    ];
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          end = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          end?.focus();
        } else if (!event.shiftKey && document.activeElement === end) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = previous;
      last?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  else throw new Error('Clipboard unavailable. Select and copy the room code instead.');
}
export function CopyButton({
  text,
  label,
  copied,
  onCopy,
}: {
  text: string;
  label: string;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <button className="button secondary small-button" onClick={() => onCopy(text)}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
export function PromptText({ text, answers = [] }: { text: string; answers?: string[] }) {
  const parts = text.split('____');
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && (
            <span className={`blank ${answers[index] ? 'filled' : ''}`}>
              {answers[index] ?? '________'}
            </span>
          )}
        </span>
      ))}
      {answers.length > parts.length - 1 && (
        <span className="blank filled"> {answers.slice(parts.length - 1).join(' + ')}</span>
      )}
    </>
  );
}
