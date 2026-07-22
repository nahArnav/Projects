"""
Decision Engine for Truth Bureau
Combines ML prediction, verification similarity, source credibility,
and NLP analysis into a final verdict.
"""

from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class Decision:
    prediction: str        # "REAL", "FAKE", or "UNCERTAIN"
    confidence: int        # 0 – 100
    explanation: str
    factors: dict = field(default_factory=dict)

def make_decision(
    ml_label: str,
    ml_confidence: float,
    similarity_score: float,
    sources_verified: bool,
    suspicious_info: dict,
    high_trust_count: int = 0,
    low_trust_count: int = 0,
) -> Decision:
    """Weighted decision combining multiple signals."""

    # ── ML score contribution (0-45) ────────────────────────────────────────
    if ml_label == "FAKE":
        ml_score = (1 - ml_confidence) * 45  
    elif ml_label == "REAL":
        ml_score = ml_confidence * 45         
    else:
        ml_score = 22.5  

    # ── Verification score contribution (0-25) ──────────────────────────────
    if sources_verified:
        verify_score = similarity_score * 25
    else:
        verify_score = 12.5  

    # ── Source credibility contribution (0-15) ──────────────────────────────
    if high_trust_count + low_trust_count > 0:
        cred_ratio = high_trust_count / (high_trust_count + low_trust_count)
        cred_score = cred_ratio * 15
    elif sources_verified:
        cred_score = 7.5
    else:
        cred_score = 7.5

    # ── Suspicious language penalty (0-15) ──────────────────────────────────
    sus_count = suspicious_info.get("total_suspicious_count", 0)
    if sus_count == 0:
        sus_score = 15
    elif sus_count <= 2:
        sus_score = 10
    elif sus_count <= 5:
        sus_score = 5
    else:
        sus_score = 0

    # ── Aggregate ───────────────────────────────────────────────────────────
    total = ml_score + verify_score + cred_score + sus_score  
    total = max(0, min(100, total))

    # ── Guard: prevent FAKE ML prediction from flipping to Real ─────────
    ml_fake_overridden = False
    if ml_label == "FAKE" and ml_confidence >= 0.6 and total >= 65:
        total = 55
        ml_fake_overridden = True

    # ── Decide verdict (STANDARDIZED TO UPPERCASE) ──────────────────────
    if total >= 65:
        prediction = "REAL"
    elif total <= 40:
        prediction = "FAKE"
    else:
        prediction = "UNCERTAIN"

    # ── Confidence relative to the prediction ───────────────────────────
    if prediction == "REAL":
        confidence = int(round(total))           
    elif prediction == "FAKE":
        confidence = 100 - int(round(total))     
    else:
        distance = abs(total - 52.5)
        confidence = max(30, min(50, int(round(50 - distance))))

    # ── Build explanation ───────────────────────────────────────────────────
    explanations: list[str] = []

    if ml_label == "FAKE":
        explanations.append(f"The AI model classified this as FAKE with {ml_confidence:.0%} confidence.")
        if ml_fake_overridden:
            explanations.append("Although related articles exist online, they may be debunking the claim rather than confirming it.")
    elif ml_label == "REAL":
        explanations.append(f"The AI model classified this as REAL with {ml_confidence:.0%} confidence.")
    else:
        explanations.append("The AI model could not reach a strong conclusion.")

    if sources_verified:
        if similarity_score > 0.6:
            explanations.append("The claim is well-corroborated by multiple online sources.")
        elif similarity_score > 0.3:
            explanations.append("Some related articles were found, but corroboration is partial.")
        else:
            explanations.append("Very few matching sources were found online.")
    else:
        explanations.append("Internet verification was not available; the verdict relies on AI analysis.")

    if sus_count > 3:
        explanations.append("High levels of suspicious, sensationalist, or emotional language detected.")
    elif sus_count > 0:
        explanations.append("Minor suspicious language patterns were noted.")

    explanation = " ".join(explanations)

    factors = {
        "ml_score": round(ml_score, 2),
        "verification_score": round(verify_score, 2),
        "credibility_score": round(cred_score, 2),
        "language_score": round(sus_score, 2),
    }

    return Decision(
        prediction=prediction,
        confidence=confidence,
        explanation=explanation,
        factors=factors,
    )