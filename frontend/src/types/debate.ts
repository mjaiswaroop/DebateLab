export type FallacySeverity = "minor" | "moderate" | "critical";

export type PacingCategory =
  | "too_slow"
  | "slightly_slow"
  | "good"
  | "slightly_fast"
  | "too_fast";

export interface FillerWord {
  word: string;
  count: number;
}

export interface Fallacy {
  type: string;
  fallacy_type?: string;
  quote: string;
  explanation: string;
  severity: FallacySeverity;
  fix: string;
  verified?: boolean;
  start_char?: number | null;
  end_char?: number | null;
}

export interface MeasuredPause {
  start_ms: number;
  duration_ms: number;
}

export interface FixedFallacyItem {
  type: string;
  quote: string;
  explanation?: string;
  fix?: string;
}

export interface RedoDelta {
  parent_turn_id: string;
  parent_attempt_number?: number;
  attempt_number: number;
  is_demo?: boolean;
  delta_available?: boolean;
  explanation?: string | null;
  soundness_before?: number | null;
  soundness_after?: number | null;
  soundness_delta?: number | null;
  confidence_before?: number | null;
  confidence_after?: number | null;
  confidence_delta?: number | null;
  filler_before?: number | null;
  filler_after?: number | null;
  filler_delta?: number | null;
  wpm_before?: number | null;
  wpm_after?: number | null;
  wpm_delta?: number | null;
  fallacies_fixed?: Array<string | FixedFallacyItem>;
  fallacies_fixed_count?: number;
  fallacies_still_flagged?: Array<{
    type: string;
    original_quote: string;
    new_quote?: string;
    status: string;
    explanation?: string;
  }>;
  premises_before?: number | null;
  premises_after?: number | null;
  premises_delta?: number | null;
  warrants_added?: number;
  argument_score_delta?: number;
  filler_count_delta?: number;
}


export interface DeliveryAnalysis {
  confidence_score: number;
  hesitation_index: number;
  filler_words: FillerWord[];
  filler_total: number;
  words_per_minute: number;
  pacing: PacingCategory;
  vocal_observations: string[];
}

export interface LogicAnalysis {
  argument_score: number;
  claim_summary: string;
  premises: string[];
  fallacies: Fallacy[];
  strongest_point: string;
  weakest_point: string;
  unaddressed_counterarguments: string[];
}

export interface TurnResponse {
  turn_number: number;
  attempt_number?: number;
  parent_turn_id?: string | null;
  speech_detected: boolean;
  transcript: string;
  delivery: DeliveryAnalysis;
  logic: LogicAnalysis;
  rebuttal_text: string;
  socratic_question: string;
  coaching_tips: string[];
  session_overall_score?: number | null;
  pauses_detected?: MeasuredPause[];
  verified_fallacy_count?: number;
  total_fallacy_count?: number;
  redo_delta?: RedoDelta | null;
}

export interface TrendPoint {
  turn_number: number;
  confidence: number | null;
  argument: number | null;
  hesitation: number | null;
  filler_total: number;
  wpm: number | null;
}

export interface TurnHistoryItem {
  id: string;
  turn_number: number;
  attempt_number?: number;
  parent_turn_id?: string | null;
  speaker: "user" | "assistant";
  user_transcript?: string | null;
  rebuttal_text?: string | null;
  confidence_score?: number | null;
  argument_score?: number | null;
  hesitation_index?: number | null;
  words_per_minute?: number | null;
  duration_ms?: number | null;
  filler_words_detected?: FillerWord[];
  fallacies_flagged?: Fallacy[];
  pauses_detected?: MeasuredPause[];
  verified_fallacy_count?: number;
  total_fallacy_count?: number;
  created_at: string;
}

export interface SessionResponse {
  id: string;
  topic: string;
  user_side?: "government" | "opposition";
  format?: string;
  target_wpm_min?: number;
  target_wpm_max?: number;
  initial_thesis?: string | null;
  difficulty: "novice" | "intermediate" | "advanced";
  status: "active" | "completed" | "abandoned";
  overall_score?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface SessionDetailResponse {
  id: string;
  topic: string;
  user_side?: "government" | "opposition";
  format?: string;
  target_wpm_min?: number;
  target_wpm_max?: number;
  initial_thesis?: string | null;

  difficulty: "novice" | "intermediate" | "advanced";
  status: "active" | "completed" | "abandoned";
  overall_score?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  turns: TurnHistoryItem[];
  trend: TrendPoint[];
}

export interface TextDebateTurnRequest {
  topic: string;
  difficulty: "novice" | "intermediate" | "advanced";
  user_side: "government" | "opposition";
  round_number: number;
  user_text: string;
  history: Array<{ speaker: string; text: string; round?: number }>;
}

export interface TextDebateTurnResponse {
  turn_number: number;
  opponent_speech: string;
  opponent_poi: string;
  user_argument_score: number | null;
  user_premises: string[];
  fallacies_flagged: Fallacy[];
  verified_fallacy_count?: number;
  total_fallacy_count?: number;
  coaching_tip: string;
  model?: string;
  is_demo?: boolean;
  demo_reason?: string | null;
}

export interface ClashResultItem {
  clash_name: string;
  winner: "user" | "opponent" | "draw";
  analysis: string;
}

export interface SkillBreakdown {
  soundness: number;
  responsiveness: number;
  warrants: number;
  fallacy_discipline: number;
  impact_calculus: number;
}

export interface DebateVerdictRequest {
  topic: string;
  difficulty: "novice" | "intermediate" | "advanced";
  user_side: "government" | "opposition";
  history: Array<{ speaker: string; text: string; round?: number }>;
}

export interface DebateVerdictResponse {
  outcome: "win" | "loss" | "close_split";
  user_score: number;
  opponent_score: number;
  speaker_rank: string;
  rfd: string;
  clashes: ClashResultItem[];
  skill_breakdown: SkillBreakdown;
  strongest_user_point: string;
  opponent_best_blow: string;
  key_coaching_advice: string;
  model?: string;
  is_demo?: boolean;
  demo_reason?: string | null;
}

export interface SkillRadar {
  logic_soundness: number;
  delivery_confidence: number;
  cadence_stability: number;
  fallacy_discipline: number;
  responsiveness: number;
}

export interface ProgressionPoint {
  date: string;
  overall_score: number;
  soundness: number;
  confidence: number;
  filler_rate: number;
  wpm: number;
}

export interface DrillResponse {
  id: string;
  drill_type: string;
  prompt_text: string;
  duration_seconds: number;
  score: number;
  target_metric: string;
  triggering_weakness?: string | null;
  metrics: Record<string, unknown>;
  feedback: string;
  created_at: string;
}

export interface BallotResponse {
  id: string;
  session_id: string;
  persona: string;
  winner: string;
  user_score: number;
  opponent_score: number;
  rfd: string;
  key_factors: string[];
  what_would_change_decision: string;
  created_at: string;
}

export interface DebaterProfileResponse {
  user_id: string;
  username: string;
  total_sessions: number;
  completed_sessions: number;
  average_score: number;
  current_tier: string;
  skill_radar: SkillRadar;
  progression: ProgressionPoint[];
  fallacies_eliminated_count: number;
  recent_sessions: Array<{
    id: string;
    topic: string;
    format?: string;
    overall_score?: number | null;
    difficulty: string;
    date: string;
    status: string;
  }>;
  recent_drills: DrillResponse[];
}
