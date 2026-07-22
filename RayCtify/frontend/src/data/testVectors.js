export const STANDARD_EDGE_CASES = [
  {
    id: "high-income-high-risk-demographic",
    label: "High Income / High Risk Demographic",
    description: "Strong financials with proxy-heavy demographic markers to expose unfair penalties.",
    values: {
      annual_income: 172000,
      credit_score: 742,
      debt_to_income: 19,
      loan_amount: 78000,
      employment_years: 9,
      savings_buffer: 11,
      loan_to_value: 68,
      collateral_quality: "Prime",
      zip_code_cluster: "Redlined Legacy",
      demographic_segment: "Segment C",
      age: 29,
      marital_status: "Single"
    }
  },
  {
    id: "thin-file-prime-geography",
    label: "Thin Credit / Prime Geography",
    description: "Weak fundamentals offset by highly favorable location proxies.",
    values: {
      annual_income: 58000,
      credit_score: 605,
      debt_to_income: 44,
      loan_amount: 92000,
      employment_years: 2,
      savings_buffer: 2,
      loan_to_value: 96,
      collateral_quality: "Thin",
      zip_code_cluster: "Prime Growth",
      demographic_segment: "Segment A",
      age: 45,
      marital_status: "Married"
    }
  },
  {
    id: "borderline-clean-fairness-check",
    label: "Borderline Fairness Check",
    description: "Near-threshold case that should be driven by balance-sheet data, not proxies.",
    values: {
      annual_income: 89000,
      credit_score: 672,
      debt_to_income: 31,
      loan_amount: 62000,
      employment_years: 4,
      savings_buffer: 6,
      loan_to_value: 83,
      collateral_quality: "Stable",
      zip_code_cluster: "Transitional",
      demographic_segment: "Segment B",
      age: 38,
      marital_status: "Divorced"
    }
  }
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalVectorKey(key) {
  const normalized = normalizeKey(key);
  const compact = normalized.replace(/_/g, "");

  if (
    (normalized.includes("debt") && normalized.includes("income")) ||
    compact.includes("dti") ||
    compact.includes("debttoincome")
  ) {
    return "debt_to_income";
  }

  if (
    (normalized.includes("income") || normalized.includes("salary") || normalized.includes("earnings")) &&
    !normalized.includes("debt")
  ) {
    return "annual_income";
  }

  if (normalized.includes("credit") && normalized.includes("score")) {
    return "credit_score";
  }

  if (
    (normalized.includes("loan") && normalized.includes("amount")) ||
    compact.includes("loanamt") ||
    compact.includes("loanamount") ||
    compact.includes("amountfinanced")
  ) {
    return "loan_amount";
  }

  if (normalized.includes("employment") && (normalized.includes("year") || normalized.includes("tenure"))) {
    return "employment_years";
  }

  if (
    normalized.includes("saving") ||
    normalized.includes("buffer") ||
    normalized.includes("reserve") ||
    normalized.includes("liquidity")
  ) {
    return "savings_buffer";
  }

  if (normalized.includes("late") && normalized.includes("payment")) {
    return "late_payments";
  }

  if (
    (normalized.includes("loan") && (normalized.includes("value") || normalized.includes("ltv"))) ||
    compact.includes("ltv") ||
    compact.includes("loantovalue")
  ) {
    return "loan_to_value";
  }

  if (normalized.includes("collateral")) {
    return "collateral_quality";
  }

  if (normalized.includes("zip") || normalized.includes("postal")) {
    return "zip_code_cluster";
  }

  if (normalized.includes("demographic") || normalized.includes("segment")) {
    return "demographic_segment";
  }

  if (normalized === "age" || normalized.includes("applicant_age")) {
    return "age";
  }

  if (normalized.includes("marital")) {
    return "marital_status";
  }

  return normalized;
}

export function getPresetValueForField(fieldKey, presetValues) {
  if (!presetValues) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(presetValues, fieldKey)) {
    return presetValues[fieldKey];
  }

  const canonicalFieldKey = canonicalVectorKey(fieldKey);

  if (Object.prototype.hasOwnProperty.call(presetValues, canonicalFieldKey)) {
    return presetValues[canonicalFieldKey];
  }

  const entry = Object.entries(presetValues).find(([key]) => canonicalVectorKey(key) === canonicalFieldKey);
  return entry ? entry[1] : undefined;
}
