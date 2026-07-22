from __future__ import annotations

import re
from copy import deepcopy


FEATURE_CATALOG = {
    "annual_income": {
        "key": "annual_income",
        "label": "Annual Income",
        "type": "number",
        "min": 20000,
        "max": 300000,
        "step": 5000,
        "defaultValue": 95000,
        "description": "Verified borrower income used to establish repayment capacity.",
    },
    "credit_score": {
        "key": "credit_score",
        "label": "Credit Score",
        "type": "number",
        "min": 300,
        "max": 850,
        "step": 5,
        "defaultValue": 685,
        "description": "Credit bureau score used in underwriting.",
    },
    "debt_to_income": {
        "key": "debt_to_income",
        "label": "Debt-to-Income",
        "type": "number",
        "min": 0,
        "max": 100,
        "step": 1,
        "defaultValue": 35,
        "suffix": "%",
        "description": "Monthly debt burden relative to verified income.",
    },
    "loan_amount": {
        "key": "loan_amount",
        "label": "Loan Amount",
        "type": "number",
        "min": 5000,
        "max": 250000,
        "step": 5000,
        "defaultValue": 45000,
        "description": "Requested loan principal.",
    },
    "employment_years": {
        "key": "employment_years",
        "label": "Employment Tenure",
        "type": "number",
        "min": 0,
        "max": 30,
        "step": 1,
        "defaultValue": 6,
        "suffix": "yrs",
        "description": "Stable employment history typically reduces volatility.",
    },
    "savings_buffer": {
        "key": "savings_buffer",
        "label": "Liquidity Buffer",
        "type": "number",
        "min": 0,
        "max": 24,
        "step": 1,
        "defaultValue": 7,
        "suffix": "mos",
        "description": "Months of savings coverage available post-close.",
    },
    "late_payments": {
        "key": "late_payments",
        "label": "Late Payments",
        "type": "number",
        "min": 0,
        "max": 12,
        "step": 1,
        "defaultValue": 1,
        "description": "Recent delinquency count used in fair model stress tests.",
    },
    "loan_to_value": {
        "key": "loan_to_value",
        "label": "Loan-to-Value",
        "type": "number",
        "min": 20,
        "max": 120,
        "step": 1,
        "defaultValue": 78,
        "suffix": "%",
        "description": "Collateral cushion remaining after origination.",
    },
    "collateral_quality": {
        "key": "collateral_quality",
        "label": "Collateral Quality",
        "type": "select",
        "options": ["Prime", "Stable", "Thin"],
        "defaultValue": "Stable",
        "description": "Collateral quality profile based on verified documentation.",
    },
    "zip_code_cluster": {
        "key": "zip_code_cluster",
        "label": "ZIP Code Cluster",
        "type": "select",
        "options": ["Prime Growth", "Transitional", "Redlined Legacy"],
        "defaultValue": "Transitional",
        "sensitive": True,
        "description": "Proxy variable retained to expose geographic bias pressure.",
    },
    "demographic_segment": {
        "key": "demographic_segment",
        "label": "Demographic Segment",
        "type": "select",
        "options": ["Segment A", "Segment B", "Segment C"],
        "defaultValue": "Segment B",
        "sensitive": True,
        "description": "Sensitive grouping retained only for adversarial testing.",
    },
    "age": {
        "key": "age",
        "label": "Applicant Age",
        "type": "number",
        "min": 18,
        "max": 80,
        "step": 1,
        "defaultValue": 36,
        "sensitive": True,
        "description": "Age is surfaced only so discrimination can be detected.",
    },
    "marital_status": {
        "key": "marital_status",
        "label": "Marital Status",
        "type": "select",
        "options": ["Single", "Married", "Divorced"],
        "defaultValue": "Single",
        "sensitive": True,
        "description": "Sensitive category retained to expose proxy-based drift.",
    },
}

DEFAULT_AUDITOR_FEATURES = [
    "annual_income",
    "credit_score",
    "debt_to_income",
    "loan_amount",
    "employment_years",
    "savings_buffer",
    "loan_to_value",
    "collateral_quality",
    "zip_code_cluster",
    "demographic_segment",
    "age",
    "marital_status",
]

REFERENCE_FEATURES = [
    "annual_income",
    "credit_score",
    "debt_to_income",
    "loan_amount",
    "employment_years",
    "savings_buffer",
    "late_payments",
    "loan_to_value",
    "collateral_quality",
]

SENSITIVE_KEYWORDS = {
    "zip",
    "postal",
    "geo",
    "region",
    "state",
    "race",
    "ethnic",
    "gender",
    "sex",
    "religion",
    "marital",
    "age",
    "nationality",
    "citizenship",
    "disability",
    "demographic",
    "education",
}


def sanitize_key(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", str(value).strip().lower()).strip("_")
    return cleaned or "feature"


def label_from_key(value: str) -> str:
    return str(value).replace("_", " ").title()


def is_sensitive_feature(feature_name: str) -> bool:
    normalized = sanitize_key(feature_name)
    return (
        (normalized in FEATURE_CATALOG and FEATURE_CATALOG[normalized].get("sensitive", False))
        or any(keyword in normalized for keyword in SENSITIVE_KEYWORDS)
    )


def build_coded_options(prefix: str, codes: range) -> list[dict]:
    return [{"label": f"{prefix} Category {code}", "value": code} for code in codes]


def resolve_encoded_label(display_name: str, fallback_label: str) -> str:
    label = label_from_key(display_name)
    if not label:
        return fallback_label
    if "Code" in label:
        return label.replace("Code", "Category")
    if "Category" in label:
        return label
    return f"{label} Category"


def build_parameter_spec(feature_name: str, display_name: str | None = None) -> dict:
    normalized = sanitize_key(feature_name)
    display = display_name or feature_name

    if normalized in FEATURE_CATALOG:
        spec = deepcopy(FEATURE_CATALOG[normalized])
        spec["key"] = normalized
        spec["label"] = spec.get("label") or label_from_key(display)
        return spec

    if "gender" in normalized or normalized == "sex" or normalized.startswith("sex_") or normalized.endswith("_sex"):
        return {
            "key": normalized,
            "label": resolve_encoded_label(display, "Gender Category"),
            "type": "select",
            "options": build_coded_options("Gender", range(0, 4)),
            "defaultValue": 0,
            "valueType": "number",
            "encodedCategory": True,
            "sensitive": True,
            "description": (
                "This model stores gender as an encoded category. "
                "RayCtify keeps the choices neutral so you can test sensitivity without guessing what each category means."
            ),
        }

    if "ethnic" in normalized or "ethnicity" in normalized or "race" in normalized:
        return {
            "key": normalized,
            "label": resolve_encoded_label(display, "Ethnicity Category"),
            "type": "select",
            "options": build_coded_options("Ethnicity", range(0, 6)),
            "defaultValue": 0,
            "valueType": "number",
            "encodedCategory": True,
            "sensitive": True,
            "description": (
                "This model stores ethnicity as an encoded category. "
                "RayCtify keeps the choices neutral so you can test sensitivity without inventing demographic labels."
            ),
        }

    if "income" in normalized or "salary" in normalized or "earnings" in normalized:
        return {
            "key": normalized,
            "label": label_from_key(display),
            "type": "number",
            "min": 20000,
            "max": 300000,
            "step": 5000,
            "defaultValue": 95000,
            "sensitive": is_sensitive_feature(normalized),
            "description": "Income-related field extracted from the uploaded model for secure testing.",
        }

    if "zip" in normalized or "postal" in normalized:
        return {
            "key": normalized,
            "label": label_from_key(display),
            "type": "select",
            "options": ["Prime Growth", "Transitional", "Redlined Legacy"],
            "defaultValue": "Transitional",
            "sensitive": True,
            "description": "Proxy variable extracted from the uploaded model.",
        }

    if "age" in normalized:
        return {
            "key": normalized,
            "label": label_from_key(display),
            "type": "number",
            "min": 18,
            "max": 80,
            "step": 1,
            "defaultValue": 36,
            "sensitive": True,
            "description": "Sensitive attribute extracted from the uploaded model.",
        }

    return {
        "key": normalized,
        "label": label_from_key(display),
        "type": "number",
        "min": 0,
        "max": 100,
        "step": 1,
        "defaultValue": 50,
        "sensitive": is_sensitive_feature(normalized),
        "description": "Generic feature extracted from the uploaded model for secure testing.",
    }


def schema_for_features(feature_names: list[str]) -> list[dict]:
    if not feature_names:
        feature_names = DEFAULT_AUDITOR_FEATURES
    return [build_parameter_spec(feature_name) for feature_name in feature_names]


def reference_schema() -> list[dict]:
    return [deepcopy(FEATURE_CATALOG[key]) for key in REFERENCE_FEATURES]
