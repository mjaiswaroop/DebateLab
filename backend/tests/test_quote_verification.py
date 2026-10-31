import pytest
from app.services.quote_verifier import (
    normalize_text_for_verification,
    verify_and_align_quotes,
)


def test_quote_verification_exact_match():
    transcript = "We must ban algorithmic feeds because they polarize the public debate and cause harm."
    fallacies = [
        {
            "type": "slippery_slope",
            "quote": "they polarize the public debate and cause harm",
            "explanation": "Assumes polarization without establishing intermediate causal links.",
            "severity": "moderate",
            "fix": "Provide empirical evidence of polarization mechanisms.",
        }
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert verified_count == 1
    assert total_count == 1
    assert len(verified) == 1
    assert verified[0]["verified"] is True
    assert verified[0]["quote"] == "they polarize the public debate and cause harm"
    assert verified[0]["start_char"] is not None
    assert verified[0]["end_char"] is not None


def test_quote_verification_punctuation_difference():
    # Transcript has commas, punctuation, and capitalizations
    transcript = "We cannot, however, afford this mechanism—it will, you know, destroy local markets!"
    # Model quoted with different punctuation and case
    fallacies = [
        {
            "type": "hasty_generalization",
            "quote": "We cannot however afford this mechanism it will destroy local markets",
            "explanation": "Sweeping claim regarding local market disruption.",
            "severity": "critical",
            "fix": "Bound the claim to specific sectors.",
        }
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert total_count == 1
    assert verified_count == 1
    assert len(verified) == 1
    assert verified[0]["verified"] is True


def test_quote_verification_fabricated_quote_discarded():
    transcript = "Virat Kohli is the greatest batsman because he averages over fifty across all formats and dominates run chases."
    # Fabricated quote that debater never said
    fallacies = [
        {
            "type": "strawman",
            "quote": "Sachin Tendulkar never scored runs in fourth inning chases under pressure",
            "explanation": "Fabricated claim attacking an unmentioned player.",
            "severity": "critical",
            "fix": "Stick to the actual debate claims.",
        }
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert total_count == 1
    assert verified_count == 0
    assert len(verified) == 0  # Fabricated fallacy quote MUST be discarded!


def test_quote_verification_empty_list():
    transcript = "Well-reasoned argument with sound warrants and empirical validation."
    verified, verified_count, total_count = verify_and_align_quotes(transcript, [])
    assert total_count == 0
    assert verified_count == 0
    assert verified == []


def test_quote_verification_partial_mix():
    transcript = "The government policy is completely useless, and everyone knows that ministers are corrupt."
    fallacies = [
        {
            "type": "ad_populum",
            "quote": "everyone knows that ministers are corrupt",
            "explanation": "Appeals to common belief without proof.",
            "severity": "moderate",
            "fix": "Cite specific audit findings.",
        },
        {
            "type": "false_dilemma",
            "quote": "either we execute the criminals or society falls apart tonight",
            "explanation": "Fabricated quote.",
            "severity": "critical",
            "fix": "Address spectrum of penal reforms.",
        },
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert total_count == 2
    assert verified_count == 1
    assert len(verified) == 1
    assert verified[0]["type"] == "ad_populum"


def test_short_quote_false_positive_rejected():
    """
    Requirement 5: Quotes shorter than 4 words (< 4 words) require an exact substring match.
    Fuzzy matching is strictly disabled for short phrases to eliminate false positives.
    """
    # Debater said "protect free speech", model hallucinated quote "protect hate speech" (3 words)
    transcript = "We believe that the government must protect free speech online at all costs."
    fallacies = [
        {
            "type": "strawman",
            "quote": "protect hate speech",  # 3 words, not an exact substring!
            "explanation": "Debater advocated protecting hate speech.",
            "severity": "critical",
            "fix": "Focus on actual words.",
        }
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert total_count == 1
    assert verified_count == 0
    assert len(verified) == 0  # Short quote false positive MUST be rejected!


def test_longer_legitimate_fuzzy_match_accepted():
    """
    Requirement 5: For normalized quotes of 4 or more words (>= 4 words), allows fuzzy
    fallback using rapidfuzz partial_ratio >= 90.0 to tolerate minor ASR/punctuation differences.
    """
    # Original spoken sentence:
    transcript = "The administration's economic policies will inevitably cause widespread inflation across all sectors."
    # Model quote with minor ASR/formatting discrepancy: 'causes' instead of 'cause' and omitted punctuation
    fallacies = [
        {
            "type": "slippery_slope",
            "quote": "administrations economic policies will inevitably causes widespread inflation",  # 8 words
            "explanation": "Claims inevitable inflation without demonstrating the causal transmission mechanism.",
            "severity": "moderate",
            "fix": "Cite empirical supply-side inflation indicators.",
        }
    ]

    verified, verified_count, total_count = verify_and_align_quotes(transcript, fallacies)
    assert total_count == 1
    assert verified_count == 1
    assert len(verified) == 1
    assert verified[0]["verified"] is True
    assert verified[0]["type"] == "slippery_slope"

