import { z } from 'zod';
export const COLORS = ['violet', 'lime', 'pink', 'blue', 'orange', 'teal'] as const;
export const DECK_IDS = ['general', 'office', 'filipino', 'tech', 'mature', 'custom'] as const;
export const MODES = ['classic', 'democracy', 'speed', 'chaos', 'custom'] as const;
export const ProfileSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(20)
      .regex(/^[\p{L}\p{N} _.'-]+$/u, 'Use letters, numbers, spaces, or simple punctuation.'),
    color: z.enum(COLORS),
  })
  .strict();
export const SettingsSchema = z
  .object({
    mode: z.enum(MODES).default('classic'),
    winBy: z.enum(['rounds', 'score']).default('rounds'),
    rounds: z.number().int().min(1).max(50).default(10),
    targetScore: z.number().int().min(1).max(30).default(5),
    submissionSeconds: z.number().int().min(10).max(180).default(60),
    judgingSeconds: z.number().int().min(10).max(180).default(45),
    resultSeconds: z.number().int().min(3).max(20).default(8),
    maxPlayers: z.number().int().min(3).max(100).default(20),
    decks: z
      .array(z.enum(DECK_IDS))
      .min(1)
      .max(6)
      .refine((a) => new Set(a).size === a.length, 'Select each deck once.')
      .default(['general', 'office', 'filipino', 'tech']),
    allowCustom: z.boolean().default(false),
    mature: z.boolean().default(false),
  })
  .strict();
export const CustomDeckSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    prompts: z
      .array(
        z
          .object({ text: z.string().trim().min(3).max(240), pick: z.number().int().min(1).max(3) })
          .strict(),
      )
      .min(1)
      .max(100),
    responses: z.array(z.string().trim().min(1).max(160)).min(1).max(600),
  })
  .strict()
  .superRefine((deck, ctx) => {
    if (new Set(deck.responses.map((s) => s.toLocaleLowerCase())).size !== deck.responses.length)
      ctx.addIssue({ code: 'custom', message: 'Response cards must be unique.' });
    if (new Set(deck.prompts.map((p) => p.text.toLocaleLowerCase())).size !== deck.prompts.length)
      ctx.addIssue({ code: 'custom', message: 'Prompt cards must be unique.' });
    if (
      deck.prompts.some((p) => {
        const blanks = (p.text.match(/____/g) ?? []).length;
        return blanks > 0 && blanks !== p.pick;
      })
    )
      ctx.addIssue({
        code: 'custom',
        message: 'The answer count must match the number of ____ blanks in each prompt.',
      });
    if (new TextEncoder().encode(JSON.stringify(deck)).byteLength > 150000)
      ctx.addIssue({ code: 'custom', message: 'Keep the complete custom deck below 150 KB.' });
  });
export type Profile = z.infer<typeof ProfileSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type CustomDeck = z.infer<typeof CustomDeckSchema>;
export interface PromptCard {
  id: string;
  text: string;
  pick: number;
  pack: string;
}
export interface ResponseCard {
  id: string;
  text: string;
  pack: string;
}
export interface CardPack {
  id: string;
  name: string;
  description: string;
  mature: boolean;
  prompts: PromptCard[];
  responses: ResponseCard[];
}
export interface PackInfo {
  id: string;
  name: string;
  description: string;
  mature: boolean;
  prompts: number;
  responses: number;
}
export type Phase = 'lobby' | 'submitting' | 'judging' | 'results' | 'finished';
export interface PublicPlayer extends Profile {
  id: string;
  score: number;
  connected: boolean;
  ready: boolean;
  spectator: boolean;
  joinNext: boolean;
}
export interface PublicSubmission {
  id: string;
  cards: string[];
}
export interface RoundResult {
  round: number;
  prompt: string;
  cards: string[];
  winnerId: string | null;
  winnerName: string | null;
  points: number;
  reason: string;
}
export interface RoomView {
  code: string;
  hostId: string;
  revision: number;
  phase: Phase;
  settings: Settings;
  players: PublicPlayer[];
  round: number;
  roundId: string;
  judgeId: string | null;
  prompt: PromptCard | null;
  modifier: 'double' | 'random' | 'double-pick' | null;
  deadline: number | null;
  serverNow: number;
  submittedCount: number;
  eligibleCount: number;
  votedCount: number;
  submissions: PublicSubmission[];
  result: RoundResult | null;
  history: RoundResult[];
  finishReason: string | null;
  packs: PackInfo[];
  me: {
    id: string;
    hand: ResponseCard[];
    submitted: boolean;
    voted: boolean;
    ownSubmissionId: string | null;
    canSubmit: boolean;
    canVote: boolean;
    customDeck: CustomDeck | null;
  };
}
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Enter a valid six-character room code.');
export const BaseActionSchema = z.object({ requestId: z.string().uuid() });
export const RoundActionSchema = BaseActionSchema.extend({ roundId: z.string().min(1).max(50) });
export const ActionSchemas = {
  'room:create': BaseActionSchema.extend({ profile: ProfileSchema }),
  'room:join': BaseActionSchema.extend({ code: RoomCodeSchema, profile: ProfileSchema }),
  'room:resume': BaseActionSchema.extend({
    code: RoomCodeSchema,
    token: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  'room:leave': BaseActionSchema,
  'room:sync': BaseActionSchema,
  'player:ready': BaseActionSchema.extend({ ready: z.boolean() }),
  'player:participate': BaseActionSchema.extend({ participate: z.boolean() }),
  'room:settings': BaseActionSchema.extend({ settings: SettingsSchema }),
  'room:deck': BaseActionSchema.extend({ deck: CustomDeckSchema }),
  'player:kick': BaseActionSchema.extend({ playerId: z.string().uuid() }),
  'host:transfer': BaseActionSchema.extend({ playerId: z.string().uuid() }),
  'game:start': BaseActionSchema,
  'game:end': BaseActionSchema,
  'game:restart': BaseActionSchema,
  'game:lobby': BaseActionSchema,
  'card:submit': RoundActionSchema.extend({
    cardIds: z.array(z.string().min(1).max(80)).min(1).max(3),
  }),
  'vote:submit': RoundActionSchema.extend({ submissionId: z.string().uuid() }),
  'judge:choose': RoundActionSchema.extend({ submissionId: z.string().uuid() }),
  'round:next': RoundActionSchema,
} as const;
export type ActionName = keyof typeof ActionSchemas;
export type ActionPayload<K extends ActionName> = z.input<(typeof ActionSchemas)[K]>;
export type Ack =
  | { ok: true; session?: { code: string; playerId: string; token: string } }
  | { ok: false; error: string; code: string };
export type ClientToServerEvents = {
  [K in ActionName]: (payload: ActionPayload<K>, ack: (response: Ack) => void) => void;
};
export type ServerToClientEvents = {
  'room:update': (view: RoomView) => void;
  'round:start': (view: RoomView) => void;
  'submission:update': (view: RoomView) => void;
  'judging:start': (view: RoomView) => void;
  'round:result': (view: RoomView) => void;
  'score:update': (view: RoomView) => void;
  'game:end': (view: RoomView) => void;
  'session:revoked': (reason: string) => void;
  'server:notice': (message: string) => void;
};
export { PACKS, PACK_INFO } from './cards.js';
