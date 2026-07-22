const deepClone = (value) => JSON.parse(JSON.stringify(value));

const buildCodeOptions = (prefix, endExclusive) =>
  Array.from({ length: endExclusive }, (_, index) => ({
    label: `${prefix} Category ${index}`,
    value: index
  }));

function resolveEncodedLabel(field, fallbackLabel) {
  const sourceLabel = String(field.label || "").trim();
  if (!sourceLabel) {
    return fallbackLabel;
  }

  if (/code/i.test(sourceLabel)) {
    return sourceLabel.replace(/code/gi, "Category");
  }

  if (/category/i.test(sourceLabel)) {
    return sourceLabel;
  }

  return `${sourceLabel} Category`;
}

function buildEncodedField(field, { prefix, optionCount, fallbackLabel, description }) {
  const defaultValue = Number.isFinite(Number(field.defaultValue)) ? Number(field.defaultValue) : 0;

  return {
    ...field,
    label: resolveEncodedLabel(field, fallbackLabel),
    type: "select",
    options: buildCodeOptions(prefix, optionCount),
    defaultValue,
    valueType: "number",
    encodedCategory: true,
    sensitive: true,
    description
  };
}

const CATALOG = {
  annual_income: {
    key: "annual_income",
    label: "Annual Income",
    type: "number",
    min: 20000,
    max: 300000,
    step: 5000,
    defaultValue: 95000,
    description: "Verified income used to establish repayment capacity."
  },
  credit_score: {
    key: "credit_score",
    label: "Credit Score",
    type: "number",
    min: 300,
    max: 850,
    step: 5,
    defaultValue: 685,
    description: "Borrower credit score pulled from bureau reporting."
  },
  debt_to_income: {
    key: "debt_to_income",
    label: "Debt-to-Income",
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 35,
    suffix: "%",
    description: "Monthly debt burden relative to verified income."
  },
  loan_amount: {
    key: "loan_amount",
    label: "Loan Amount",
    type: "number",
    min: 5000,
    max: 250000,
    step: 5000,
    defaultValue: 45000,
    description: "Requested loan principal."
  },
  employment_years: {
    key: "employment_years",
    label: "Employment Tenure",
    type: "number",
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 6,
    suffix: "yrs",
    description: "Stable employment history typically reduces volatility."
  },
  savings_buffer: {
    key: "savings_buffer",
    label: "Liquidity Buffer",
    type: "number",
    min: 0,
    max: 24,
    step: 1,
    defaultValue: 7,
    suffix: "mos",
    description: "Months of liquidity coverage available post-close."
  },
  late_payments: {
    key: "late_payments",
    label: "Late Payments",
    type: "number",
    min: 0,
    max: 12,
    step: 1,
    defaultValue: 1,
    description: "Recent delinquency count used in fair model stress tests."
  },
  loan_to_value: {
    key: "loan_to_value",
    label: "Loan-to-Value",
    type: "number",
    min: 20,
    max: 120,
    step: 1,
    defaultValue: 78,
    suffix: "%",
    description: "Collateral cushion remaining after origination."
  },
  collateral_quality: {
    key: "collateral_quality",
    label: "Collateral Quality",
    type: "select",
    options: ["Prime", "Stable", "Thin"],
    defaultValue: "Stable",
    description: "Collateral quality profile based on verified documentation."
  },
  zip_code_cluster: {
    key: "zip_code_cluster",
    label: "ZIP Code Cluster",
    type: "select",
    options: ["Prime Growth", "Transitional", "Redlined Legacy"],
    defaultValue: "Transitional",
    sensitive: true,
    description: "Proxy feature included only to expose geographic bias."
  },
  demographic_segment: {
    key: "demographic_segment",
    label: "Demographic Segment",
    type: "select",
    options: ["Segment A", "Segment B", "Segment C"],
    defaultValue: "Segment B",
    sensitive: true,
    description: "Sensitive proxy retained to surface discriminatory drift."
  },
  age: {
    key: "age",
    label: "Applicant Age",
    type: "number",
    min: 18,
    max: 80,
    step: 1,
    defaultValue: 36,
    sensitive: true,
    description: "Age is shown only in adversarial testing flows."
  },
  marital_status: {
    key: "marital_status",
    label: "Marital Status",
    type: "select",
    options: ["Single", "Married", "Divorced"],
    defaultValue: "Single",
    sensitive: true,
    description: "Sensitive category retained to expose proxy-based penalties."
  }
};

export const DEFAULT_AUDITOR_SCHEMA = [
  CATALOG.annual_income,
  CATALOG.credit_score,
  CATALOG.debt_to_income,
  CATALOG.loan_amount,
  CATALOG.employment_years,
  CATALOG.savings_buffer,
  CATALOG.loan_to_value,
  CATALOG.collateral_quality,
  CATALOG.zip_code_cluster,
  CATALOG.demographic_segment,
  CATALOG.age,
  CATALOG.marital_status
];

export const REFERENCE_MODEL_SCHEMA = [
  CATALOG.annual_income,
  CATALOG.credit_score,
  CATALOG.debt_to_income,
  CATALOG.loan_amount,
  CATALOG.employment_years,
  CATALOG.savings_buffer,
  CATALOG.late_payments,
  CATALOG.loan_to_value,
  CATALOG.collateral_quality
];

export function cloneSchema(schema) {
  return deepClone(schema);
}

function dedupeSchema(schema) {
  const seen = new Set();

  return (schema || []).filter((field) => {
    const key = field?.key;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enrichField(field) {
  if (!field) {
    return field;
  }

  const key = String(field.key || "").toLowerCase();
  const label = String(field.label || "").toLowerCase();
  const looksLikeGenderCode =
    !field.options &&
    (key.includes("gender") ||
      label.includes("gender") ||
      key === "sex" ||
      label === "sex" ||
      key.startsWith("sex_") ||
      key.endsWith("_sex") ||
      label.startsWith("sex ") ||
      label.endsWith(" sex"));
  const looksLikeEthnicityCode = !field.options && (key.includes("ethnic") || key.includes("ethnicity") || key.includes("race"));
  const looksLikeIncome =
    (key.includes("income") ||
      key.includes("salary") ||
      key.includes("earnings") ||
      label.includes("income") ||
      label.includes("salary") ||
      label.includes("earnings")) &&
    !key.includes("debt");

  if (looksLikeGenderCode) {
    return buildEncodedField(field, {
      prefix: "Gender",
      optionCount: 4,
      fallbackLabel: "Gender Category",
      description:
        "This model stores gender as an encoded category. RayCtify keeps the choices neutral so you can test sensitivity without guessing what each code means."
    });
  }

  if (looksLikeEthnicityCode) {
    return buildEncodedField(field, {
      prefix: "Ethnicity",
      optionCount: 6,
      fallbackLabel: "Ethnicity Category",
      description:
        "This model stores ethnicity as an encoded category. RayCtify keeps the choices neutral so you can test sensitivity without inventing demographic labels."
    });
  }

  if (!looksLikeIncome) {
    return field;
  }

  return {
    ...field,
    type: "number",
    min: field.min ?? 20000,
    max: field.max && field.max > 100 ? field.max : 300000,
    step: field.step ?? 5000,
    defaultValue:
      typeof field.defaultValue === "number" && field.defaultValue > 100 ? field.defaultValue : 95000,
    description: field.description || "Verified income used to establish repayment capacity."
  };
}

export function createInitialValues(schema) {
  return schema.reduce((accumulator, field) => {
    accumulator[field.key] =
      field.defaultValue ??
      (field.type === "select"
        ? typeof field.options?.[0] === "object"
          ? field.options?.[0]?.value
          : field.options?.[0]
        : field.min ?? 0);
    return accumulator;
  }, {});
}

export function normalizeSchema(schema) {
  return cloneSchema(dedupeSchema(schema?.length ? schema : DEFAULT_AUDITOR_SCHEMA).map(enrichField));
}
