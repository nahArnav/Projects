from __future__ import annotations

from typing import Any

from .feature_analysis import (
    build_feature_breakdown,
    confidence_from_score,
    sensitive_penalty_percent,
    summarize_user_result,
)
from .reference_model import evaluate_reference_record


def evaluate_user_records(loaded_model: Any, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Use the higher-level pipeline to handle feature mapping
    predictions = loaded_model.predict_many(records)
    results: list[dict[str, Any]] = []
    for index, (record, prediction) in enumerate(zip(records, predictions)):
        breakdown, sensitive_flags = build_feature_breakdown(
            record=record,
            feature_names=loaded_model.feature_names,
            score=prediction["score"],
            model=getattr(loaded_model, "model", loaded_model),
        )
        decision = prediction["decision"]
        results.append({
            "case_id": record.get("case_id", f"case-{index + 1}"),
            "decision": decision,
            "score": prediction["score"],
            "confidence": confidence_from_score(prediction["score"]),
            "feature_breakdown": breakdown,
            "flagged_sensitive_features": sensitive_flags,
            "summary": summarize_user_result(decision, breakdown, sensitive_flags),
        })
    return results


def evaluate_reference_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for index, record in enumerate(records):
        result = evaluate_reference_record(record)
        result["case_id"] = record.get("case_id", f"case-{index + 1}")
        results.append(result)
    return results


def compare_records(loaded_model: Any, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    user_results = evaluate_user_records(loaded_model, records)
    reference_results = evaluate_reference_records(records)
    comparisons = []

    for user_result, reference_result in zip(user_results, reference_results):
        user_sensitive_penalty = sensitive_penalty_percent(user_result)
        overall_delta = max(0.0, round((reference_result["score"] - user_result["score"]) * 100, 1))
        bias_delta = max(user_sensitive_penalty, overall_delta)

        highlighted_sensitive = next(
            (
                item
                for item in user_result["feature_breakdown"]
                if item.get("sensitive") and item.get("impact", 0) < 0
            ),
            None,
        )

        if highlighted_sensitive and bias_delta > 0:
            delta_summary = (
                f"The uploaded model penalized this applicant by {bias_delta:.1f}% due to "
                f"{highlighted_sensitive['label']}. RayCtify removed that penalty."
            )
        elif bias_delta > 0:
            delta_summary = (
                f"RayCtify improved the applicant's score by {bias_delta:.1f}% after removing non-financial noise."
            )
        else:
            delta_summary = "Both models were directionally aligned on this borrower profile."

        comparisons.append(
            {
                "case_id": user_result["case_id"],
                "user_result": user_result,
                "reference_result": reference_result,
                "bias_delta": round(bias_delta, 1),
                "delta_summary": delta_summary,
            }
        )

    return comparisons

