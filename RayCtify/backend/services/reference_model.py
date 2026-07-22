from __future__ import annotations

from typing import Any

from .feature_catalog import is_sensitive_feature, label_from_key, sanitize_key


NUMERIC_RULES = {
    "annual_income": {"min": 20000, "max": 250000, "invert": False, "weight": 0.16},
    "credit_score": {"min": 300, "max": 850, "invert": False, "weight": 0.18},
    "debt_to_income": {"min": 0, "max": 100, "invert": True, "weight": 0.15},
    "loan_amount": {"min": 5000, "max": 250000, "invert": True, "weight": 0.08},
    "employment_years": {"min": 0, "max": 30, "invert": False, "weight": 0.08},
    "savings_buffer": {"min": 0, "max": 24, "invert": False, "weight": 0.10},
    "late_payments": {"min": 0, "max": 12, "invert": True, "weight": 0.10},
    "loan_to_value": {"min": 20, "max": 120, "invert": True, "weight": 0.10},
}

CATEGORICAL_RULES = {
    "collateral_quality": {
        "Prime": 0.07,
        "Stable": 0.02,
        "Thin": -0.05,
    }
}


def _safe_number(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _normalize(value: float, lower: float, upper: float, invert: bool = False) -> float:
    if upper == lower:
        return 0.0
    scaled = (_safe_number(value, lower) - lower) / (upper - lower)
    scaled = max(0.0, min(1.0, scaled))
    centered = (scaled - 0.5) * 2
    return -centered if invert else centered


def evaluate_reference_record(record: dict[str, Any]) -> dict[str, Any]:
    score = 0.54
    breakdown: list[dict[str, Any]] = []

    for feature_name, rule in NUMERIC_RULES.items():
        value = _safe_number(record.get(feature_name))
        impact = rule["weight"] * _normalize(value, rule["min"], rule["max"], invert=rule["invert"])
        score += impact
        breakdown.append(
            {
                "feature": feature_name,
                "label": label_from_key(feature_name),
                "value": value,
                "impact": round(impact, 4),
                "sensitive": False,
                "rationale": f"{label_from_key(feature_name)} contributed through the fair financial scorecard.",
            }
        )

    for feature_name, mapping in CATEGORICAL_RULES.items():
        raw_value = record.get(feature_name, "Stable")
        impact = mapping.get(str(raw_value), 0.0)
        score += impact
        breakdown.append(
            {
                "feature": feature_name,
                "label": label_from_key(feature_name),
                "value": raw_value,
                "impact": round(impact, 4),
                "sensitive": False,
                "rationale": f"{label_from_key(feature_name)} adjusted the score without consulting demographic data.",
            }
        )

    score = max(0.01, min(0.99, score))
    decision = "ACCEPTED" if score >= 0.55 else "REJECTED"
    confidence = min(0.99, max(0.52, 0.56 + abs(score - 0.5) * 0.9))
    breakdown.sort(key=lambda item: abs(item["impact"]), reverse=True)
    top_factors = ", ".join(item["label"] for item in breakdown[:2])
    ignored_sensitive = [label_from_key(key) for key in record.keys() if is_sensitive_feature(key)]
    summary = (
        f"{decision.title()} on verified financial fundamentals led by {top_factors}. "
        + ("Sensitive inputs were present but excluded from scoring." if ignored_sensitive else "")
    ).strip()

    return {
        "decision": decision,
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "feature_breakdown": breakdown[:6],
        "flagged_sensitive_features": [],
        "summary": summary,
    }

