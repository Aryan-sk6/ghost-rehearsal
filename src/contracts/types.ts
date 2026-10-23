import { z } from "zod";

export const DifficultySchema = z.number().int().min(1).max(5);

export const ScenarioSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(80),
  userGoal: z.string().trim().min(1).max(300),
  counterpartRole: z.string().trim().min(1).max(120),
  counterpartTraits: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  difficulty: DifficultySchema,
  openingLine: z.string().trim().min(1).max(400),
  hiddenBottomLine: z.string().trim().min(1).max(300),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

/** What the custom scenario builder collects; the app assigns the id. */
export const CustomScenarioInputSchema = ScenarioSchema.omit({ id: true });
export type CustomScenarioInput = z.infer<typeof CustomScenarioInputSchema>;

export const SpeakerSchema = z.enum(["user", "counterpart"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const TurnSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
  startedAtMs: z.number().nonnegative(),
  endedAtMs: z.number().nonnegative(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const MoodSchema = z.enum(["warm", "open", "neutral", "guarded", "impatient", "irritated"]);
export type Mood = z.infer<typeof MoodSchema>;

/** Raw counterpart output. `give` is a proposal; the engine clamps it. */
export const CounterpartReplySchema = z.object({
  reply: z.string().trim().min(1).max(600),
  mood: MoodSchema,
  give: z.number(),
});
export type CounterpartReply = z.infer<typeof CounterpartReplySchema>;

export const SessionStatusSchema = z.enum([
  "counterpart_opening",
  "awaiting_user",
  "awaiting_counterpart",
  "ended",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const EndReasonSchema = z.enum(["user_ended", "turn_cap", "goal_reached", "give_zero"]);
export type EndReason = z.infer<typeof EndReasonSchema>;

export const GiveSchema = z.number().int().min(0).max(100);

export const SessionSchema = z.object({
  id: z.string().min(1),
  scenario: ScenarioSchema,
  status: SessionStatusSchema,
  turns: z.array(TurnSchema),
  /** Same length as turns: counterpart give after each turn. */
  giveHistory: z.array(GiveSchema),
  /** Same length as turns: counterpart mood after each turn. */
  moodHistory: z.array(MoodSchema),
  endReason: EndReasonSchema.nullable(),
  startedAtMs: z.number().nonnegative(),
  endedAtMs: z.number().nonnegative().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

const CountSchema = z.number().int().nonnegative();

export const SessionMetricsSchema = z.object({
  userWordCount: CountSchema,
  wordsPerMinute: z.number().nonnegative(),
  talkRatio: z.number().min(0).max(1),
  fillerCount: CountSchema,
  /** One key per FILLER_PHRASES entry. */
  fillers: z.record(z.string(), CountSchema),
  hedgeCount: CountSchema,
  /** One key per HEDGE_PHRASES entry. */
  hedges: z.record(z.string(), CountSchema),
  longestPauseMs: CountSchema,
  concededFirstCount: CountSchema,
});
export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

export const ScoreSchema = z.number().int().min(1).max(10);

export const LostGroundMomentSchema = z.object({
  turnIndex: z.number().int().min(0),
  userSaid: z.string().min(1),
  whyItHurt: z.string().trim().min(1).max(400),
  strongerLine: z.string().trim().min(1).max(300),
});
export type LostGroundMoment = z.infer<typeof LostGroundMomentSchema>;

export const SessionAnalysisSchema = z.object({
  scores: z.object({
    clarity: ScoreSchema,
    confidence: ScoreSchema,
    handlingPushback: ScoreSchema,
    outcome: ScoreSchema,
  }),
  summary: z.string().trim().min(1).max(600),
  lostGround: z.array(LostGroundMomentSchema).length(3),
});
export type SessionAnalysis = z.infer<typeof SessionAnalysisSchema>;

/** Shape of the "Download transcript (JSON)" file. */
export const TranscriptExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  scenario: ScenarioSchema,
  turns: z.array(TurnSchema),
  endReason: EndReasonSchema.nullable(),
  metrics: SessionMetricsSchema,
  analysis: SessionAnalysisSchema.nullable(),
});
export type TranscriptExport = z.infer<typeof TranscriptExportSchema>;
