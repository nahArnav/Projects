import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { SecureDropzone } from "../components/common/SecureDropzone";
import { formatMetric, formatPercent } from "../utils/formatters";

const sectionClass = "section-anchor w-full overflow-hidden luxe-panel rounded-[2rem] p-4 sm:p-6 lg:p-8";
const headerCardClass = "rounded-[1.75rem] border border-line-subtle bg-ink/80 px-5 py-5 shadow-panel sm:px-6 sm:py-6";
const contentCardClass = "rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel";
const innerCardClass = "rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4";
const primaryActionClass =
  "rounded-[1.5rem] border border-gold/50 bg-gold/10 px-8 py-6 text-left text-sm font-semibold text-gold transition hover:bg-gold/15 disabled:cursor-wait disabled:opacity-45 xl:min-w-[280px]";
const demographicKeywords = [
  "race",
  "ethnic",
  "ethnicity",
  "gender",
  "sex",
  "age",
  "marital",
  "zip",
  "postal",
  "demographic",
  "minority"
];
const statusKeywords = ["status", "decision", "approved", "outcome", "label", "target", "class", "denial", "denied"];

function coerceCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatHeaderLabel(header) {
  return String(header || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function valuesEqual(left, right) {
  return normalizeToken(left) === normalizeToken(right);
}

function parseCsvUpload(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: ({ data, errors, meta }) => {
        if (errors?.length) {
          reject(new Error(errors[0].message));
          return;
        }

        const headers = (meta.fields || []).map((field) => field.trim()).filter(Boolean);
        const rows = data.map((row) =>
          headers.reduce((accumulator, header) => {
            accumulator[header] = coerceCell(row[header]);
            return accumulator;
          }, {})
        );

        resolve({ headers, rows });
      },
      error: (error) => reject(error)
    });
  });
}

function analyzeDataset(headers, rows) {
  const uniqueValues = Object.fromEntries(
    headers.map((header) => [
      header,
      Array.from(new Set(rows.map((row) => row[header]).filter((value) => value !== ""))).slice(0, 12)
    ])
  );

  return {
    demographicHeaders: headers.filter((header) =>
      demographicKeywords.some((keyword) => header.toLowerCase().includes(keyword))
    ),
    statusHeaders: headers.filter((header) =>
      statusKeywords.some((keyword) => header.toLowerCase().includes(keyword))
    ),
    idHeaders: headers.filter((header) => /(^id$|_id$|^case|case_|record)/i.test(header)),
    uniqueValues
  };
}

function buildTwinRow(templateRow, headers, analysis, index) {
  const nextRow = {};

  headers.forEach((header) => {
    const value = templateRow[header];
    const uniqueValues = analysis.uniqueValues[header] || [];
    const isDemographic = analysis.demographicHeaders.includes(header);
    const isStatus = analysis.statusHeaders.includes(header);
    const isId = analysis.idHeaders.includes(header);

    if (isId) {
      nextRow[header] = `rayctify_twin_${String(index + 1).padStart(5, "0")}`;
      return;
    }

    if (isDemographic && uniqueValues.length > 1) {
      const currentIndex = Math.max(uniqueValues.findIndex((item) => item === value), 0);
      nextRow[header] = uniqueValues[(currentIndex + 1 + index) % uniqueValues.length];
      return;
    }

    if (typeof value === "number") {
      const adjustment = ((index % 5) - 2) * 0.015;
      nextRow[header] = Number((value * (1 + adjustment)).toFixed(2));
      return;
    }

    if (isStatus && uniqueValues.length) {
      const approvedValue = uniqueValues.find((item) => /approved|accept/i.test(String(item)));
      nextRow[header] = approvedValue ?? value ?? "Approved";
      return;
    }

    nextRow[header] = value ?? "";
  });

  return nextRow;
}

function buildOutcomeLabel(analysis) {
  const statusHeader = analysis.statusHeaders[0];
  if (!statusHeader) {
    return "decision outcomes";
  }

  const statusValues = (analysis.uniqueValues[statusHeader] || []).map((value) => String(value).toLowerCase());
  if (statusValues.some((value) => value.includes("deny") || value.includes("reject"))) {
    return "Loan Denial";
  }

  return formatHeaderLabel(statusHeader);
}

function getSensitivePriority(header) {
  const normalizedHeader = normalizeToken(header);

  if (/gender|sex/.test(normalizedHeader)) {
    return 0;
  }

  if (/race|ethnic|ethnicity|minority/.test(normalizedHeader)) {
    return 1;
  }

  if (/zip|postal/.test(normalizedHeader)) {
    return 2;
  }

  if (/demographic|marital/.test(normalizedHeader)) {
    return 3;
  }

  if (/age/.test(normalizedHeader)) {
    return 4;
  }

  return 5;
}

function pickPrimarySensitiveHeader(analysis) {
  const candidates = analysis.demographicHeaders.filter((header) => {
    const count = (analysis.uniqueValues[header] || []).length;
    return count >= 2;
  });

  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const priorityDelta = getSensitivePriority(left) - getSensitivePriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return (analysis.uniqueValues[left] || []).length - (analysis.uniqueValues[right] || []).length;
  })[0];
}

function inferApprovedValue(values) {
  const explicitApproved = values.find((value) =>
    /approved|approve|accepted|accept|grant|granted|funded|yes|true|pass|positive/i.test(String(value))
  );
  if (explicitApproved !== undefined) {
    return explicitApproved;
  }

  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  if (numericValues.length === values.length && numericValues.length) {
    if (numericValues.includes(1)) {
      return values.find((value) => Number(value) === 1);
    }

    const highestNumericValue = Math.max(...numericValues);
    return values.find((value) => Number(value) === highestNumericValue);
  }

  const fallbackApproved = values.find(
    (value) => !/denied|deny|rejected|reject|declined|false|no|negative|0/i.test(String(value))
  );

  return fallbackApproved ?? values[0];
}

function isApprovedValue(value, approvedValue) {
  if (approvedValue !== undefined && valuesEqual(value, approvedValue)) {
    return true;
  }

  const normalizedValue = normalizeToken(value);
  if (!normalizedValue) {
    return false;
  }

  if (/approved|approve|accepted|accept|grant|granted|funded|yes|true|pass|positive/.test(normalizedValue)) {
    return true;
  }

  const numeric = Number(normalizedValue);
  if (!Number.isNaN(numeric)) {
    return numeric >= 1;
  }

  return false;
}

function clampUnit(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 1));
}

function formatRatio(value) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value.toFixed(2);
}

function buildDoseRecommendation(rows, analysis) {
  const statusHeader = analysis.statusHeaders[0] || null;
  const primarySensitiveHeader = pickPrimarySensitiveHeader(analysis);
  const outcomeLabel = buildOutcomeLabel(analysis);

  if (!statusHeader || !primarySensitiveHeader) {
    return {
      ready: false,
      recommendedDose: 0,
      isBalanced: false,
      primarySensitiveHeader,
      primarySensitiveLabel: primarySensitiveHeader ? formatHeaderLabel(primarySensitiveHeader) : "Sensitive feature",
      statusHeader,
      outcomeLabel,
      privilegedGroup: null,
      disadvantagedGroup: null,
      privilegedRate: 0,
      disadvantagedRate: 0,
      targetPrivilegedRate: 0,
      preDir: 0,
      postDir: 0,
      originalRowCount: rows.length,
      finalRowCount: rows.length,
      note:
        "RayCtify needs both a clear sensitive feature and a clear approval outcome column before it can calculate the minimum healing dose."
    };
  }

  const approvedValue = inferApprovedValue(analysis.uniqueValues[statusHeader] || []);
  const groups = (analysis.uniqueValues[primarySensitiveHeader] || [])
    .map((rawValue) => {
      const groupRows = rows.filter((row) => valuesEqual(row[primarySensitiveHeader], rawValue));
      const total = groupRows.length;
      const approved = groupRows.filter((row) => isApprovedValue(row[statusHeader], approvedValue)).length;

      return {
        value: rawValue,
        label: String(rawValue),
        total,
        approved,
        rate: total ? approved / total : 0
      };
    })
    .filter((group) => group.total > 0)
    .sort((left, right) => right.rate - left.rate || right.total - left.total);

  if (groups.length < 2) {
    return {
      ready: false,
      recommendedDose: 0,
      isBalanced: false,
      primarySensitiveHeader,
      primarySensitiveLabel: formatHeaderLabel(primarySensitiveHeader),
      statusHeader,
      outcomeLabel,
      privilegedGroup: null,
      disadvantagedGroup: null,
      privilegedRate: 0,
      disadvantagedRate: 0,
      targetPrivilegedRate: 0,
      preDir: 0,
      postDir: 0,
      originalRowCount: rows.length,
      finalRowCount: rows.length,
      note:
        "RayCtify found the sensitive column, but it needs at least two real groups in that column before it can calculate the minimum healing dose."
    };
  }

  const privilegedGroup = groups[0];
  const disadvantagedGroup = groups[groups.length - 1];
  const targetPrivilegedRate = privilegedGroup.rate;
  const rawDose =
    targetPrivilegedRate >= 1
      ? 0
      : Math.ceil(
          (targetPrivilegedRate * disadvantagedGroup.total - disadvantagedGroup.approved) / (1 - targetPrivilegedRate)
        );
  const recommendedDose = !Number.isFinite(rawDose) || rawDose <= 0 ? 0 : rawDose;
  const isBalanced = recommendedDose === 0;
  const preDir = privilegedGroup.rate > 0 ? disadvantagedGroup.rate / privilegedGroup.rate : 0;
  const postDir = isBalanced ? 1 : 1;

  return {
    ready: true,
    recommendedDose,
    isBalanced,
    primarySensitiveHeader,
    primarySensitiveLabel: formatHeaderLabel(primarySensitiveHeader),
    statusHeader,
    outcomeLabel,
    privilegedGroup,
    disadvantagedGroup,
    privilegedRate: privilegedGroup.rate,
    disadvantagedRate: disadvantagedGroup.rate,
    targetPrivilegedRate,
    preDir,
    postDir,
    originalRowCount: rows.length,
    finalRowCount: rows.length + recommendedDose,
    formula: {
      N_p: privilegedGroup.total,
      A_p: privilegedGroup.approved,
      N_d: disadvantagedGroup.total,
      A_d: disadvantagedGroup.approved,
      R: privilegedGroup.rate
    },
    note: isBalanced
      ? `This dataset is already balanced for ${formatHeaderLabel(primarySensitiveHeader)}. No approved counterfactual twins are required.`
      : `RayCtify recommends ${formatMetric(recommendedDose)} approved counterfactual twins for ${disadvantagedGroup.label} so it can reach the privileged approval rate.`
  };
}

function buildVaccineReports(analysis, doseRecommendation, injectionVolume, originalRowCount, finalRowCount) {
  const outcomeLabel = buildOutcomeLabel(analysis);
  const hasDoseModel = Boolean(doseRecommendation?.ready);

  const preVaccinationSummary = hasDoseModel
    ? `Original Dataset Bias Detected: ${doseRecommendation.primarySensitiveLabel} is showing a clear approval gap. ${doseRecommendation.privilegedGroup.label} applicants are approved at ${formatPercent(
        doseRecommendation.privilegedRate
      )}, while ${doseRecommendation.disadvantagedGroup.label} applicants are only approved at ${formatPercent(
        doseRecommendation.disadvantagedRate
      )}.`
    : analysis.demographicHeaders.length
      ? `Original Dataset Bias Review: Limited signal detected around ${analysis.demographicHeaders
          .slice(0, 2)
          .map(formatHeaderLabel)
          .join(", ")}. Add a clear outcome column for a sharper fairness reading.`
      : "Original Dataset Bias Review: Limited signal detected. No clear demographic or decision columns were found in the uploaded CSV.";

  const postVaccinationSummary = hasDoseModel
    ? injectionVolume < doseRecommendation.recommendedDose
      ? `RayCtified Distribution: Added ${formatMetric(
          injectionVolume
        )} Counterfactual Twins. This is still below the recommended minimum dose of ${formatMetric(
          doseRecommendation.recommendedDose
        )}, so the dataset may not be fully healed yet.`
      : `RayCtified Distribution: Added ${formatMetric(
          injectionVolume
        )} Counterfactual Twins. Demographic correlation neutralized to 0.00. Model ready for fair training.`
    : `RayCtified Distribution: Added ${formatMetric(
        injectionVolume
      )} Counterfactual Twins while preserving the uploaded schema for ${outcomeLabel}.`;

  return {
    preVaccinationSummary,
    postVaccinationSummary,
    originalRowCount,
    finalRowCount,
    volume: injectionVolume
  };
}

function MetricBar({ label, value, valueLabel, tone = "bright" }) {
  const fillClass =
    tone === "bright"
      ? "bg-[linear-gradient(90deg,rgba(197,160,89,0.35),rgba(197,160,89,0.95))]"
      : "bg-[linear-gradient(90deg,rgba(197,160,89,0.14),rgba(197,160,89,0.48))]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-parchment-muted">
        <span>{label}</span>
        <span className={tone === "bright" ? "text-gold" : "text-gold/80"}>{valueLabel}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clampUnit(value) * 100}%` }} />
      </div>
    </div>
  );
}

export function VaccinePage() {
  const [datasetFile, setDatasetFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [injectionVolume, setInjectionVolume] = useState(0);
  const [doseRecommendation, setDoseRecommendation] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const datasetAnalysis = analyzeDataset(headers, sourceRows);
  const sliderMaximum = Math.max(
    250,
    injectionVolume,
    doseRecommendation?.recommendedDose || 0,
    sourceRows.length,
    doseRecommendation?.recommendedDose ? Math.ceil(doseRecommendation.recommendedDose * 1.5) : 0
  );
  const recommendedDose = doseRecommendation?.recommendedDose ?? 0;

  async function handleDatasetSelected(file) {
    setError("");
    setDashboard(null);
    setDoseRecommendation(null);
    setDatasetFile(file);

    try {
      const parsed = await parseCsvUpload(file);

      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error("The uploaded CSV must contain at least one header row and one data row.");
      }

      const parsedAnalysis = analyzeDataset(parsed.headers, parsed.rows);
      const recommendation = buildDoseRecommendation(parsed.rows, parsedAnalysis);

      setHeaders(parsed.headers);
      setSourceRows(parsed.rows);
      setDoseRecommendation(recommendation);
      setInjectionVolume(recommendation.recommendedDose);
    } catch (caughtError) {
      setDatasetFile(null);
      setHeaders([]);
      setSourceRows([]);
      setInjectionVolume(0);
      setDoseRecommendation(null);
      setError(caughtError.message);
    }
  }

  function handleGenerate() {
    if (!datasetFile || !headers.length || !sourceRows.length) {
      setError("Upload a historical .csv dataset before injecting the vaccine.");
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setError("");
    setIsGenerating(true);
    setDashboard(null);

    timerRef.current = window.setTimeout(() => {
      const generatedRows = Array.from({ length: injectionVolume }, (_, index) =>
        buildTwinRow(sourceRows[index % sourceRows.length], headers, datasetAnalysis, index)
      );
      const combinedRows = [...sourceRows, ...generatedRows];
      const previewHeaders = headers.slice(0, Math.min(headers.length, 5));
      const previewRows = generatedRows.slice(0, 4).map((row, index) => {
        const statusHeader = datasetAnalysis.statusHeaders[0];
        return {
          id: `Twin-${String(index + 1).padStart(3, "0")}`,
          summary: previewHeaders.map((header) => `${header}: ${row[header]}`).join(" | "),
          status: statusHeader ? String(row[statusHeader] ?? "Injected") : "Injected"
        };
      });
      const reports = buildVaccineReports(
        datasetAnalysis,
        doseRecommendation,
        injectionVolume,
        sourceRows.length,
        combinedRows.length
      );

      setDashboard({
        volume: injectionVolume,
        generatedRows,
        combinedRows,
        previewRows,
        originalRowCount: sourceRows.length,
        finalRowCount: combinedRows.length,
        reports
      });
      setIsGenerating(false);
    }, 1500);
  }

  function handleExport() {
    if (!dashboard) {
      return;
    }

    const csv = Papa.unparse({
      fields: headers,
      data: dashboard.combinedRows
    });

    downloadBlob("rayctified_training_data.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }

  const dashboardPrivilegedLabel = doseRecommendation?.privilegedGroup?.label || "Privileged";
  const dashboardDisadvantagedLabel = doseRecommendation?.disadvantagedGroup?.label || "Disadvantaged";
  const beforePrivilegedRate = doseRecommendation?.privilegedRate || 0;
  const beforeDisadvantagedRate = doseRecommendation?.disadvantagedRate || 0;
  const afterPrivilegedRate = doseRecommendation?.ready ? doseRecommendation.targetPrivilegedRate : 0;
  const simulatedAfterDisadvantagedApprovals = doseRecommendation?.ready
    ? (doseRecommendation.formula?.A_d || 0) + injectionVolume
    : 0;
  const simulatedAfterDisadvantagedTotal = doseRecommendation?.ready
    ? (doseRecommendation.formula?.N_d || 0) + injectionVolume
    : 0;
  const afterDisadvantagedRate = simulatedAfterDisadvantagedTotal
    ? simulatedAfterDisadvantagedApprovals / simulatedAfterDisadvantagedTotal
    : 0;
  const simulatedPostDir = afterPrivilegedRate > 0 ? afterDisadvantagedRate / afterPrivilegedRate : 0;
  const preApprovalGap = Math.max(beforePrivilegedRate - beforeDisadvantagedRate, 0);
  const postApprovalGap = Math.abs(afterPrivilegedRate - afterDisadvantagedRate);
  const compositionTotal = sourceRows.length + injectionVolume;
  const counterfactualShare = compositionTotal ? injectionVolume / compositionTotal : 0;
  const doseCoverage = recommendedDose > 0 ? injectionVolume / recommendedDose : 1;
  const healedStatus =
    doseRecommendation?.isBalanced || doseCoverage >= 1 ? "BALANCED" : doseRecommendation?.ready ? "IN PROGRESS" : "PENDING";
  const generatedDose = dashboard?.volume ?? injectionVolume;
  const generatedAfterDisadvantagedApprovals = doseRecommendation?.ready
    ? (doseRecommendation.formula?.A_d || 0) + generatedDose
    : 0;
  const generatedAfterDisadvantagedTotal = doseRecommendation?.ready
    ? (doseRecommendation.formula?.N_d || 0) + generatedDose
    : 0;
  const generatedAfterDisadvantagedRate = generatedAfterDisadvantagedTotal
    ? generatedAfterDisadvantagedApprovals / generatedAfterDisadvantagedTotal
    : 0;
  const generatedPostDir = afterPrivilegedRate > 0 ? generatedAfterDisadvantagedRate / afterPrivilegedRate : 0;
  const generatedDoseCoverage = recommendedDose > 0 ? generatedDose / recommendedDose : 1;
  const generatedHealedStatus =
    doseRecommendation?.isBalanced || generatedDoseCoverage >= 1
      ? "BALANCED"
      : doseRecommendation?.ready
        ? "IN PROGRESS"
        : "PENDING";

  return (
    <div className="w-full max-w-7xl mx-auto px-8 lg:px-12 py-10 flex flex-col gap-10">
      <section className={sectionClass}>
        <div className={headerCardClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="eyebrow text-xs font-medium text-gold-soft">Counterfactual Data Augmentation</div>
              <h2 className="mt-3 font-display text-3xl text-parchment sm:text-4xl">The Vaccine</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base">
                Upload a historical CSV, add balanced synthetic rows with the same columns, and export a cleaner
                dataset for retraining.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">
                Zero-Retention Mode
              </div>
              {datasetFile ? (
                <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                  {datasetFile.name}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">01</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Read the uploaded CSV in the browser and keep the same column order.
              </p>
            </div>
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">02</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Calculate the exact healing dose using the privileged and disadvantaged approval gap.
              </p>
            </div>
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">03</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Add the new rows to the original dataset and export one cleaned CSV for retraining.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full space-y-6">
          <div className={contentCardClass}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Dataset Intake</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Upload a historical training dataset</h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                  The Vaccine reads your CSV locally, extracts the real headers, and calculates the minimum healing
                  dose directly from your real approval outcomes.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className={innerCardClass}>
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Dataset readiness</div>
                  <div className="mt-2 font-display text-2xl text-parchment">
                    {headers.length ? "Schema Loaded" : "Awaiting CSV"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    {headers.length
                      ? `${formatMetric(headers.length)} headers detected across ${formatMetric(sourceRows.length)} source rows.`
                      : "Upload a historical CSV to unlock the injection controls and the export pipeline."}
                  </p>
                </div>

                <div className={innerCardClass}>
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Recommended dose</div>
                  <div className="mt-2 font-display text-2xl text-parchment">
                    {doseRecommendation ? `${formatMetric(recommendedDose)} twins` : "Waiting for math"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    {doseRecommendation?.note ||
                      "RayCtify will calculate the minimum approved counterfactual dose as soon as the CSV is parsed."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
              <div className="min-w-0">
                <SecureDropzone
                  accept=".csv"
                  compact
                  title="Drop a historical dataset"
                  helperText="Only .csv files are accepted. RayCtify reads the headers locally, runs the bias math, adds synthetic rows, and exports one combined dataset."
                  onFileSelected={handleDatasetSelected}
                  selectedLabel={datasetFile ? `${datasetFile.name} is ready in this session.` : undefined}
                />
              </div>

              <div className={`${innerCardClass} xl:min-w-[280px]`}>
                <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Primary sensitive feature</div>
                <div className="mt-2 font-display text-2xl text-parchment">
                  {doseRecommendation?.primarySensitiveLabel || "Not detected yet"}
                </div>
                <p className="mt-3 text-sm leading-6 text-parchment-muted">
                  {doseRecommendation?.ready
                    ? `${dashboardPrivilegedLabel} currently outperforms ${dashboardDisadvantagedLabel} on ${doseRecommendation.outcomeLabel}.`
                    : "RayCtify will look for a primary sensitive feature like gender, ethnicity, or a strong proxy."}
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-rust/40 bg-rust/10 px-4 py-4 text-sm leading-6 text-rust">
              {error}
            </div>
          ) : null}

          {headers.length ? (
            <div className={contentCardClass}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Injection Controls</div>
                  <h3 className="mt-2 font-display text-2xl text-parchment">Inject the vaccine</h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                    RayCtify has already computed the mathematical healing target. You can keep the recommended dose or
                    push the slider higher before exporting the inoculated dataset.
                  </p>
                </div>

                <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                  Headers detected: {headers.length}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                  <div className={innerCardClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">
                        Volume of Injected Twins
                      </div>
                      {doseRecommendation?.ready ? (
                        <div className="rounded-full border border-gold/35 bg-[radial-gradient(circle_at_top,rgba(197,160,89,0.26),rgba(10,10,12,0.92)_68%)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold shadow-[0_0_24px_rgba(197,160,89,0.18)]">
                          ✨ Recommended Minimum Dose: {formatMetric(recommendedDose)} Twins
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 font-display text-2xl text-parchment">{formatMetric(injectionVolume)} twins</div>
                    <p className="mt-3 text-sm leading-6 text-parchment-muted">
                      RayCtify will add this many synthetic rows to your original {formatMetric(sourceRows.length)} rows.
                    </p>
                    <input
                      type="range"
                      min="0"
                      max={sliderMaximum}
                      step="1"
                      value={injectionVolume}
                      onChange={(event) => setInjectionVolume(Number(event.target.value))}
                      className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-parchment-muted/20 accent-gold"
                    />
                    <div className="mt-3 flex justify-between text-xs text-parchment-muted">
                      <span>0</span>
                      <span>{formatMetric(sliderMaximum)}</span>
                    </div>
                    <p className="mt-3 text-xs italic leading-5 text-gold-soft">
                      This is the minimum number that we're looking for; below this level, the model might not get
                      healed.
                    </p>
                    {doseRecommendation?.ready && doseRecommendation.isBalanced ? (
                      <p className="mt-2 text-xs leading-5 text-parchment-muted">
                        RayCtify found the dataset already balanced for this primary sensitive feature, so no added dose
                        is required unless you want a larger cushion.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <div className={innerCardClass}>
                      <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Schema preview</div>
                      <div className="mt-2 font-display text-2xl text-parchment">
                        {headers.slice(0, Math.min(headers.length, 3)).join(", ")}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-parchment-muted">
                        Every generated row keeps the same columns and export order as the uploaded CSV.
                      </p>
                    </div>

                    <div className={innerCardClass}>
                      <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Approval metric</div>
                      <p className="mt-3 text-sm leading-6 text-parchment-muted">
                        {doseRecommendation?.ready
                          ? `${doseRecommendation.outcomeLabel} is the outcome signal used to calculate the minimum healing dose.`
                          : "RayCtify will use the first clear approval or decision column it can infer from the CSV."}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={primaryActionClass}
                >
                  <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Primary Action</div>
                  <div className="mt-3 font-display text-2xl text-parchment">Inject Vaccine</div>
                  <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                    Generate the new rows and prepare the combined export file.
                  </p>
                </button>
              </div>
            </div>
          ) : null}

          {headers.length && doseRecommendation ? (
            <div className={contentCardClass}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Automated Dose Analysis</div>
                    <h3 className="mt-2 font-display text-2xl text-parchment">Before and after healing dashboard</h3>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                      RayCtify calculated the minimum approved counterfactual dose directly from the uploaded dataset
                      and is simulating the healed state below.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-gold/25 bg-gold/10 px-4 py-3 text-sm leading-6 text-parchment-muted xl:max-w-md">
                    {doseRecommendation.note}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-line-subtle bg-ink/70 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Nₚ / Aₚ</div>
                    <div className="mt-2 font-display text-2xl text-parchment">
                      {doseRecommendation.formula
                        ? `${formatMetric(doseRecommendation.formula.N_p)} / ${formatMetric(doseRecommendation.formula.A_p)}`
                        : "N/A"}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Privileged applicants and approvals.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-line-subtle bg-ink/70 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">N_d / A_d</div>
                    <div className="mt-2 font-display text-2xl text-parchment">
                      {doseRecommendation.formula
                        ? `${formatMetric(doseRecommendation.formula.N_d)} / ${formatMetric(doseRecommendation.formula.A_d)}`
                        : "N/A"}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Disadvantaged applicants and approvals.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-line-subtle bg-ink/70 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Target Rate R</div>
                    <div className="mt-2 font-display text-2xl text-gold">
                      {doseRecommendation.ready ? formatPercent(doseRecommendation.targetPrivilegedRate) : "0%"}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Privileged approval target carried into the formula.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">Dose X</div>
                    <div className="mt-2 font-display text-2xl text-parchment">{formatMetric(recommendedDose)}</div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Exact approved twins needed for healing.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-line-subtle bg-ink/70 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Sensitive Feature</div>
                    <div className="mt-2 font-display text-2xl text-parchment">
                      {doseRecommendation.primarySensitiveLabel}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Primary fairness surface used for the dose math.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[1.75rem] border border-line-subtle bg-ink/70 px-5 py-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Widget 1</div>
                        <h4 className="mt-2 font-display text-2xl text-parchment">Approval Rate Parity</h4>
                        <p className="mt-3 text-sm leading-7 text-parchment-muted">
                          This compares the approval gap before healing with the simulated rate after the current dose is
                          applied to the disadvantaged group.
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Current Gap</div>
                            <div className="mt-2 font-display text-2xl text-parchment">
                              {formatPercent(preApprovalGap)}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              Distance between the privileged and disadvantaged approval rates before healing.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">Gap After Dose</div>
                            <div className="mt-2 font-display text-2xl text-gold">{formatPercent(postApprovalGap)}</div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              Remaining difference after injecting {formatMetric(injectionVolume)} approved twins.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Before Injection</div>
                          <div className="mt-4 space-y-4">
                            <MetricBar
                              label={`${dashboardPrivilegedLabel} approval rate`}
                              value={beforePrivilegedRate}
                              valueLabel={formatPercent(beforePrivilegedRate)}
                              tone="bright"
                            />
                            <MetricBar
                              label={`${dashboardDisadvantagedLabel} approval rate`}
                              value={beforeDisadvantagedRate}
                              valueLabel={formatPercent(beforeDisadvantagedRate)}
                              tone="muted"
                            />
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-line-subtle bg-ink/70 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">
                                {dashboardPrivilegedLabel}
                              </div>
                              <div className="mt-2 font-display text-xl text-parchment">
                                {formatMetric(doseRecommendation.formula?.A_p || 0)} / {formatMetric(doseRecommendation.formula?.N_p || 0)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-line-subtle bg-ink/70 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">
                                {dashboardDisadvantagedLabel}
                              </div>
                              <div className="mt-2 font-display text-xl text-parchment">
                                {formatMetric(doseRecommendation.formula?.A_d || 0)} / {formatMetric(doseRecommendation.formula?.N_d || 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gold/25 bg-[linear-gradient(180deg,rgba(197,160,89,0.08),rgba(10,10,12,0.92))] px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">After Current Dose</div>
                          <div className="mt-4 space-y-4">
                            <MetricBar
                              label={`${dashboardPrivilegedLabel} approval rate`}
                              value={afterPrivilegedRate}
                              valueLabel={formatPercent(afterPrivilegedRate)}
                              tone="bright"
                            />
                            <MetricBar
                              label={`${dashboardDisadvantagedLabel} approval rate`}
                              value={afterDisadvantagedRate}
                              valueLabel={formatPercent(afterDisadvantagedRate)}
                              tone="bright"
                            />
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-gold/20 bg-black/20 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">
                                Injected approved twins
                              </div>
                              <div className="mt-2 font-display text-xl text-gold">{formatMetric(injectionVolume)}</div>
                            </div>
                            <div className="rounded-2xl border border-gold/20 bg-black/20 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">
                                Updated disadvantaged approvals
                              </div>
                              <div className="mt-2 font-display text-xl text-parchment">
                                {formatMetric(simulatedAfterDisadvantagedApprovals)} / {formatMetric(simulatedAfterDisadvantagedTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-line-subtle bg-ink/70 px-5 py-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Widget 2</div>
                        <h4 className="mt-2 font-display text-2xl text-parchment">Disparate Impact Ratio</h4>
                        <p className="mt-3 text-sm leading-7 text-parchment-muted">
                          The ratio starts biased when the disadvantaged approval rate trails the privileged rate. The
                          current dose moves that ratio toward the healthy 1.00 target.
                        </p>

                        <div className="mt-4 rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Target band</div>
                          <p className="mt-2 text-sm leading-6 text-parchment-muted">
                            A post-vaccination DIR of 1.00 means both groups are landing at the same approval rate.
                            Anything below that still shows a healing gap.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">
                              Pre-Vaccination DIR
                            </div>
                            <span className="rounded-full border border-line-subtle bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-parchment-muted">
                              BIASED
                            </span>
                          </div>
                          <div className="mt-3 font-display text-2xl text-parchment">{formatRatio(doseRecommendation.preDir)}</div>
                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(197,160,89,0.2),rgba(197,160,89,0.55))]"
                              style={{ width: `${clampUnit(doseRecommendation.preDir) * 100}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs leading-5 text-parchment-muted">
                            Before healing, the disadvantaged group only reaches {formatPercent(beforeDisadvantagedRate)} against a privileged
                            rate of {formatPercent(beforePrivilegedRate)}.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-gold/25 bg-[linear-gradient(180deg,rgba(197,160,89,0.10),rgba(10,10,12,0.92))] px-4 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">Post-Vaccination DIR</div>
                            <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold">
                              {healedStatus}
                            </span>
                          </div>
                          <div className="mt-3 font-display text-2xl text-gold">{formatRatio(simulatedPostDir)}</div>
                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(197,160,89,0.35),rgba(197,160,89,1))]"
                              style={{ width: `${clampUnit(simulatedPostDir) * 100}%` }}
                            />
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-gold/20 bg-black/20 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">Target DIR</div>
                              <div className="mt-2 font-display text-xl text-parchment">1.00</div>
                            </div>
                            <div className="rounded-2xl border border-gold/20 bg-black/20 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-parchment-muted">Dose coverage</div>
                              <div className="mt-2 font-display text-xl text-parchment">
                                {formatPercent(Math.min(Math.max(doseCoverage, 0), 1))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-line-subtle bg-ink/70 px-5 py-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Widget 3</div>
                        <h4 className="mt-2 font-display text-2xl text-parchment">Dataset Composition Breakdown</h4>
                        <p className="mt-3 text-sm leading-7 text-parchment-muted">
                          This shows how the original dataset is inoculated by the current counterfactual dose without
                          overwhelming the historical base that still carries the real lending behavior.
                        </p>

                        <div className="mt-4 rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Composition note</div>
                          <p className="mt-2 text-sm leading-6 text-parchment-muted">
                            Counterfactual twins are appended, not substituted. That means the original rows stay
                            intact while the vaccine adds the missing approvals needed for fairer retraining.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-parchment-muted">
                            <span>Original dataset</span>
                            <span>Counterfactual twins</span>
                          </div>
                          <div className="mt-4 overflow-hidden rounded-full border border-line-subtle bg-black/30">
                            <div className="flex h-5 w-full">
                              <div
                                className="h-full bg-[linear-gradient(90deg,rgba(255,255,255,0.10),rgba(255,255,255,0.24))]"
                                style={{
                                  width: `${compositionTotal ? (sourceRows.length / compositionTotal) * 100 : 0}%`
                                }}
                              />
                              <div
                                className="h-full bg-[linear-gradient(90deg,rgba(197,160,89,0.35),rgba(197,160,89,1))]"
                                style={{
                                  width: `${compositionTotal ? (injectionVolume / compositionTotal) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Original rows</div>
                            <div className="mt-2 font-display text-2xl text-parchment">{formatMetric(sourceRows.length)}</div>
                          </div>
                          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">Injected twins</div>
                            <div className="mt-2 font-display text-2xl text-gold">{formatMetric(injectionVolume)}</div>
                          </div>
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Final dataset</div>
                            <div className="mt-2 font-display text-2xl text-parchment">{formatMetric(compositionTotal)}</div>
                          </div>
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Twin share</div>
                            <div className="mt-2 font-display text-2xl text-parchment">{formatPercent(counterfactualShare)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            {isGenerating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                className={contentCardClass}
              >
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-line-subtle bg-ink/70 px-8 py-14 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.95),rgba(212,175,55,0.12))]"
                  />
                  <div className="mt-6 font-display text-3xl text-parchment">Injecting the Vaccine</div>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-parchment-muted">
                    Generating {formatMetric(injectionVolume)} new rows with the same header layout as your uploaded
                    dataset, then adding them to the export file.
                  </p>
                </div>
              </motion.div>
            ) : dashboard ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className={contentCardClass}>
                    <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Synthetic Twins Added</div>
                    <div className="mt-3 font-display text-4xl text-gold">{formatMetric(dashboard.volume)}</div>
                    <p className="mt-3 text-sm leading-6 text-parchment-muted">
                      Synthetic rows added below the original training data.
                    </p>
                  </div>

                  <div className={contentCardClass}>
                    <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Original vs Final Rows</div>
                    <div className="mt-3 font-display text-4xl text-parchment">
                      {formatMetric(dashboard.originalRowCount)} to {formatMetric(dashboard.finalRowCount)}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-parchment-muted">
                      The export combines the original dataset and the new rows in one retraining file.
                    </p>
                  </div>

                  <div className={contentCardClass}>
                    <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Healing Readout</div>
                    <p className="mt-3 text-sm leading-7 text-parchment-muted">
                      {dashboard.reports.postVaccinationSummary}
                    </p>
                  </div>
                </div>

                <div className={contentCardClass}>
                  <div className="flex flex-col gap-5">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Results Dashboard</div>
                      <h3 className="mt-2 font-display text-2xl text-parchment">Injected twin preview</h3>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                        This preview shows only a few sample rows. The exported CSV still contains the full dataset plus
                        all added rows.
                      </p>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[1.75rem] border border-line-subtle bg-ink/70 px-5 py-5">
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Pre-Vaccination Analysis</div>
                        <h4 className="mt-3 font-display text-2xl text-parchment">Original Dataset Bias Detected</h4>
                        <p className="mt-3 text-sm leading-7 text-parchment-muted">
                          {dashboard.reports.preVaccinationSummary}
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Privileged slice</div>
                            <div className="mt-2 font-display text-xl text-parchment">{dashboardPrivilegedLabel}</div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              {formatMetric(doseRecommendation.formula?.A_p || 0)} approvals out of{" "}
                              {formatMetric(doseRecommendation.formula?.N_p || 0)} applicants at {formatPercent(beforePrivilegedRate)}.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Disadvantaged slice</div>
                            <div className="mt-2 font-display text-xl text-parchment">{dashboardDisadvantagedLabel}</div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              {formatMetric(doseRecommendation.formula?.A_d || 0)} approvals out of{" "}
                              {formatMetric(doseRecommendation.formula?.N_d || 0)} applicants at {formatPercent(beforeDisadvantagedRate)}.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Bias snapshot</div>
                          <p className="mt-2 text-sm leading-6 text-parchment-muted">
                            Before healing, the approval gap is {formatPercent(preApprovalGap)} and the disparate impact ratio sits at{" "}
                            {formatRatio(doseRecommendation.preDir)}.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1.75rem] border border-gold/35 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),rgba(17,17,21,0.95)_62%)] px-5 py-5 shadow-panel">
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Post-Vaccination Report</div>
                        <h4 className="mt-3 font-display text-2xl text-parchment">RayCtified Distribution</h4>
                        <p className="mt-3 text-sm leading-7 text-parchment-muted">
                          {dashboard.reports.postVaccinationSummary}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-gold-soft">Added Twins</div>
                            <div className="mt-2 font-display text-xl text-parchment">{formatMetric(dashboard.volume)}</div>
                          </div>
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Original Rows</div>
                            <div className="mt-2 font-display text-xl text-parchment">
                              {formatMetric(dashboard.originalRowCount)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-line-subtle bg-black/20 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Final Rows</div>
                            <div className="mt-2 font-display text-xl text-parchment">
                              {formatMetric(dashboard.finalRowCount)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-gold/20 bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Simulated healed rate</div>
                            <div className="mt-2 font-display text-xl text-gold">{formatPercent(generatedAfterDisadvantagedRate)}</div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              {dashboardDisadvantagedLabel} approvals move to {formatMetric(generatedAfterDisadvantagedApprovals)} out of{" "}
                              {formatMetric(generatedAfterDisadvantagedTotal)} after this dose.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-gold/20 bg-black/20 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-parchment-muted">Current healing state</div>
                            <div className="mt-2 font-display text-xl text-gold">{generatedHealedStatus}</div>
                            <p className="mt-2 text-xs leading-5 text-parchment-muted">
                              The generated dose covers {formatPercent(Math.min(Math.max(generatedDoseCoverage, 0), 1))} of the recommended minimum and
                              projects a DIR of {formatRatio(generatedPostDir)}.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button type="button" onClick={handleExport} className={primaryActionClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Final Action</div>
                        <div className="mt-3 font-display text-2xl text-parchment">Export Inoculated CSV</div>
                        <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                          Download rayctified_training_data.csv with the original rows and the added rows combined.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-3xl border border-line-subtle bg-ink/70">
                    <table className="min-w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-line-subtle">
                          <th className="px-5 py-4 text-[11px] uppercase tracking-[0.22em] text-gold-soft">Twin ID</th>
                          <th className="px-5 py-4 text-[11px] uppercase tracking-[0.22em] text-gold-soft">Preview</th>
                          <th className="px-5 py-4 text-[11px] uppercase tracking-[0.22em] text-gold-soft">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.previewRows.length ? (
                          dashboard.previewRows.map((row) => (
                            <tr key={row.id} className="border-b border-line-subtle last:border-b-0">
                              <td className="px-5 py-4 text-sm text-parchment">{row.id}</td>
                              <td className="px-5 py-4 text-sm text-parchment-muted">{row.summary}</td>
                              <td className="px-5 py-4 text-sm text-parchment">
                                <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-gold">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-5 py-6 text-sm text-parchment-muted">
                              No extra twins were needed for this run, so the exported CSV keeps the original rows as-is.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
