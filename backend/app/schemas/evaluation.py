from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel, Field


class FallacyType(str, Enum):
    ad_hominem = "ad_hominem"
    straw_man = "straw_man"
    false_dilemma = "false_dilemma"
    slippery_slope = "slippery_slope"
    appeal_to_authority = "appeal_to_authority"
    appeal_to_emotion = "appeal_to_emotion"
    circular_reasoning = "circular_reasoning"
    hasty_generalization = "hasty_generalization"
    red_herring = "red_herring"
    post_hoc = "post_hoc"
    equivocation = "equivocation"
    unsupported_assertion = "unsupported_assertion"
    other = "other"


class FillerWord(BaseModel):
    word: str = Field(description="The filler as spoken, lowercase, e.g. 'um', 'like', 'you know'.")
    count: int = Field(description="Number of times it occurred in this recording.")


class Fallacy(BaseModel):
    type: FallacyType
    quote: str = Field(description="Verbatim excerpt from the speaker's argument containing the fallacy.")
    explanation: str = Field(description="One or two sentences on why this is fallacious.")
    severity: Literal["minor", "moderate", "critical"]
    fix: str = Field(description="How the speaker could repair the argument.")
    verified: bool = True
    start_char: Optional[int] = None
    end_char: Optional[int] = None


class DeliveryAnalysis(BaseModel):
    confidence_score: int = Field(description="0-100. Vocal confidence: steadiness, assertiveness, absence of hedging tone.")
    hesitation_index: int = Field(description="0-100. Higher = more hesitation: pauses, false starts, restarts, trailing off.")
    filler_words: list[FillerWord]
    pacing: Literal["too_slow", "slightly_slow", "good", "slightly_fast", "too_fast"]
    vocal_observations: list[str] = Field(description="2-4 specific, evidence-based observations about delivery, referencing moments in the audio.")


class LogicAnalysis(BaseModel):
    argument_score: int = Field(description="0-100 argument soundness: premise quality, validity, evidence, relevance.")
    claim_summary: str = Field(description="The speaker's central claim, restated in one sentence.")
    premises: list[str]
    fallacies: list[Fallacy]
    strongest_point: str
    weakest_point: str
    unaddressed_counterarguments: list[str]


class DebateEvaluationResponse(BaseModel):
    speech_detected: bool = Field(description="False if the audio is silent, unintelligible, or contains no argument.")
    transcript: str = Field(description="Accurate transcript. Keep fillers and false starts. Empty string if no speech.")
    delivery: DeliveryAnalysis
    logic: LogicAnalysis
    rebuttal_text: str = Field(description="Your spoken counter-argument, 60-130 words, plain prose with no markdown, written to be read aloud.")
    socratic_question: str = Field(description="One probing question exposing the speaker's weakest assumption.")
    coaching_tips: list[str] = Field(description="Exactly 3 prioritized, actionable tips mixing delivery and logic.")


# ---------------------------------------------------------------------------
# API-facing schema for Gemini structured output.
#
# `Optional[int]` fields compile to `anyOf: [{integer}, {null}]`, and Gemini 3.8
# rejects nullable unions in a response schema with "Request contains an invalid
# argument". The character offsets are computed server-side anyway (see
# `verify_and_align_quotes`), so the model never needs to produce them.
# ---------------------------------------------------------------------------


class GeminiFallacy(BaseModel):
    type: FallacyType
    quote: str = Field(description="Verbatim excerpt from the speaker's argument containing the fallacy.")
    explanation: str = Field(description="One or two sentences on why it is fallacious.")
    severity: Literal["minor", "moderate", "critical"]
    fix: str = Field(description="How the speaker could repair it.")


class GeminiDeliveryAnalysis(BaseModel):
    confidence_score: int = Field(description="0-100. Vocal confidence: steadiness, assertiveness, absence of hedging tone.")
    hesitation_index: int = Field(description="0-100. Hesitation: pauses, false starts, restarts, trailing off.")
    filler_words: list[FillerWord]
    pacing: Literal["too_slow", "slightly_slow", "good", "slightly_fast", "too_fast"]
    vocal_observations: list[str] = Field(description="2-4 specific, evidence-based observations about delivery, referencing moments in the audio.")


class GeminiLogicAnalysis(BaseModel):
    argument_score: int = Field(description="0-100 argument soundness: premise quality, validity, evidence, relevance.")
    claim_summary: str = Field(description="The speaker's central claim, restated in one sentence.")
    premises: list[str]
    fallacies: list[GeminiFallacy]
    strongest_point: str
    weakest_point: str
    unaddressed_counterarguments: list[str]


class GeminiEvaluationResponse(BaseModel):
    """Shape Gemini must return. Converted to DebateEvaluationResponse afterwards."""

    speech_detected: bool = Field(description="False if the audio is silent, unintelligible, or contains no argument.")
    transcript: str = Field(description="Accurate transcript. Keep fillers and false starts. Empty string if no speech.")
    delivery: GeminiDeliveryAnalysis
    logic: GeminiLogicAnalysis
    rebuttal_text: str = Field(description="Your spoken counter-argument, 60-130 words, plain prose with no markdown, written to be read aloud.")
    socratic_question: str = Field(description="One probing question exposing the speaker's weakest assumption.")
    coaching_tips: list[str] = Field(description="Exactly 3 prioritized, actionable tips mixing delivery and logic.")
