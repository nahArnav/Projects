import { useEffect, useRef, useState } from "react";
import { BatchResultsTable } from "../common/BatchResultsTable";
import { DecisionPanel } from "../common/DecisionPanel";
import { SectionHeader } from "../common/SectionHeader";
import { SecureDropzone } from "../common/SecureDropzone";
import { SessionLogTable } from "../common/SessionLogTable";
import { DEFAULT_AUDITOR_SCHEMA, createInitialValues, normalizeSchema } from "../../data/schemas";
import { getPresetValueForField } from "../../data/testVectors";
import { useSessionStore } from "../../store/sessionStore";
import { evaluateUserModel, introspectModel } from "../../utils/api";
import { parseCsvFile, mergeRecordsWithSchema } from "../../utils/csv";
import { formatMetric } from "../../utils/formatters";
import { exportAuditorReport } from "../../utils/pdf";

/* ───────────── How-it-works steps (concise) ───────────── */
const howItWorks = [
  "Upload a model to begin.",
  "Adjust parameters or pick a preset.",
  "Review results and export a PDF."
];

/* ───────────── Presets ─────────────────────────────────── */
const PRESETS = {
  high_income_high_risk: {
    label: "High Income / High Risk",
    description: "Strong financials with sensitive markers left in place.",
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
  thin_credit: {
    label: "Thin Credit",
    description: "Weak profile — should be rejected on fundamentals alone.",
    values: {
      annual_income: 32000,
      credit_score: 540,
      debt_to_income: 55,
      loan_amount: 120000,
      employment_years: 1,
      savings_buffer: 1,
      loan_to_value: 98,
      collateral_quality: "Thin",
      zip_code_cluster: "Prime Growth",
      demographic_segment: "Segment A",
      age: 24,
      marital_status: "Single"
    }
  },
  borderline_fairness: {
    label: "Borderline Fairness",
    description: "Near-threshold case — exposes proxy-reliance vs. real credit data.",
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
};

/* ───────────── Helpers ────────────────────────────────── */
function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildSessionLogEntry({ id, caseId, mode, decision, summary, parameters }) {
  return { id, caseId, mode, decision, summary, parameters, timestamp: timestamp() };
}

function getOptionValue(option) {
  return typeof option === "object" ? option.value : option;
}

function getOptionLabel(option) {
  return typeof option === "object" ? option.label : option;
}

function buildPresetState(schema, presetId) {
  const baseValues = createInitialValues(schema);
  const preset = PRESETS[presetId];
  if (!preset) return baseValues;

  schema.forEach((field) => {
    const presetValue = getPresetValueForField(field.key, preset.values);
    if (presetValue !== undefined) {
      baseValues[field.key] = presetValue;
    }
  });
  return baseValues;
}

function formatFieldValue(field, value) {
  if (field.type === "select") {
    const selectedOption = field.options?.find((option) => String(getOptionValue(option)) === String(value));
    return selectedOption ? getOptionLabel(selectedOption) : String(value ?? "");
  }
  return formatMetric(value ?? field.defaultValue ?? 0, field.suffix || "");
}

/* ═══════════════════════════════════════════════════════════
   ModelAuditorSection — Phase 1 / 2 / 3 refactored
   ═══════════════════════════════════════════════════════════ */
export function ModelAuditorSection() {
  const reportRef = useRef(null);
  const {
    uploadedModelFile,
    uploadedModelName,
    uploadedModelSchema,
    uploadedModelSummary,
    uploadedModelEngine,
    uploadedModelType,
    auditorHistory,
    setUploadedModel,
    resetHistory,
    appendHistoryEntries
  } = useSessionStore();

  const [values, setValues] = useState(createInitialValues(uploadedModelSchema));
  const [modelType, setModelType] = useState(uploadedModelType ?? null);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [manualResult, setManualResult] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const hasLoadedModel = Boolean(uploadedModelFile);
  const numericFields = uploadedModelSchema.filter((field) => field.type !== "select");
  const selectFields = uploadedModelSchema.filter((field) => field.type === "select");
  const activePreset = PRESETS[selectedPreset] || null;

  useEffect(() => {
    setValues(createInitialValues(uploadedModelSchema));
  }, [uploadedModelSchema]);

  useEffect(() => {
    setModelType(uploadedModelType ?? null);
  }, [uploadedModelType]);

  function handleValueChange(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handlePresetChange(presetId) {
    setSelectedPreset(presetId);
    setValues(buildPresetState(uploadedModelSchema, presetId));
  }

  async function handleModelUpload(file) {
    setError("");
    setModelType(null);
    setStatus("Introspecting model…");

    try {
      const response = await introspectModel(file);
      const schema = normalizeSchema(response.schema?.length ? response.schema : DEFAULT_AUDITOR_SCHEMA);
      const detectedModelType = response.model_type ?? null;

      setUploadedModel({
        file,
        schema,
        summary: response.summary,
        engine: response.engine,
        modelType: detectedModelType
      });
      setModelType(detectedModelType);
      setSelectedPreset("");
      setManualResult(null);
      setBatchResults([]);
      setValues(createInitialValues(schema));
      resetHistory("auditorHistory");
      resetHistory("arenaHistory");
      resetHistory("arenaUserHistory");
      resetHistory("arenaReferenceHistory");
      setStatus("✅ Model active — ready to test.");
    } catch (caughtError) {
      setModelType(null);
      setError(caughtError.message);
      setStatus("");
    }
  }

  async function runManualAudit() {
    if (!uploadedModelFile) {
      setError("Upload a model first.");
      return;
    }

    setError("");
    setStatus("Running audit…");

    try {
      const response = await evaluateUserModel(uploadedModelFile, [{ case_id: "manual-audit", ...values }]);
      const result = response.records?.[0];
      if (response.model_type) setModelType(response.model_type);
      setManualResult(result);
      setBatchResults([]);
      setStatus("Audit complete.");
      appendHistoryEntries("auditorHistory", [
        buildSessionLogEntry({
          id: `manual-${Date.now()}`,
          caseId: result?.case_id || "manual-audit",
          mode: "Manual",
          decision: result?.decision || "N/A",
          summary: result?.summary || "Manual audit complete.",
          parameters: { ...values }
        })
      ]);
    } catch (caughtError) {
      setError(caughtError.message);
      setStatus("");
    }
  }

  async function handleBatchUpload(file) {
    if (!uploadedModelFile) {
      setError("Upload a model before running a batch.");
      return;
    }

    setError("");
    setStatus("Parsing CSV locally…");

    try {
      const parsedRecords = await parseCsvFile(file);
      const records = mergeRecordsWithSchema(parsedRecords, uploadedModelSchema, values);
      const response = await evaluateUserModel(uploadedModelFile, records);
      const logTimestamp = Date.now();
      if (response.model_type) setModelType(response.model_type);
      setBatchResults(response.records || []);
      setManualResult(response.records?.[0] || null);
      setStatus(`Batch complete — ${response.records?.length || 0} records.`);
      const batchLogEntries = (response.records || []).map((result, index) =>
        buildSessionLogEntry({
          id: `batch-${logTimestamp}-${index}`,
          caseId: result?.case_id || records[index]?.case_id || `case-${index + 1}`,
          mode: "CSV Batch",
          decision: result?.decision || "N/A",
          summary: result?.summary || "Batch tested.",
          parameters: Object.fromEntries(
            Object.entries(records[index] || {}).filter(([key]) => key !== "case_id")
          )
        })
      );
      appendHistoryEntries("auditorHistory", batchLogEntries);
    } catch (caughtError) {
      setError(caughtError.message);
      setStatus("");
    }
  }

  /* ── Phase 2: PDF export using jsPDF + autotable ─────── */
  const exportCounterRef = useRef(0);
  function handleExport() {
    setError("");
    try {
      exportCounterRef.current += 1;
      const seq = String(exportCounterRef.current).padStart(3, "0");
      exportAuditorReport({
        modelName: uploadedModelName,
        engine: uploadedModelEngine,
        modelType,
        history: auditorHistory,
        filename: `RayCtify_Model_Auditor_Report_${seq}.pdf`
      });
    } catch (caughtError) {
      setError(caughtError.message);
    }
  }

  /* ═══════════════════════ RENDER ════════════════════════ */
  return (
    <div className="w-full max-w-7xl mx-auto px-8 lg:px-12 py-10 flex flex-col gap-10">
      <section ref={reportRef} className="section-anchor w-full luxe-panel rounded-[2rem] p-4 sm:p-6 lg:p-8">
        {/* ── Section Header (trimmed copy) ──────────── */}
        <SectionHeader
          eyebrow="Feature Section 1"
          title="The Model Auditor"
          description="Upload a model, test applicant scenarios, and review decisions. Files stay in-session only."
          howItWorks={howItWorks}
          onExport={handleExport}
        />

        <div className="mt-6 w-full space-y-6">
          {/* ── Status / Error bar ────────────────────── */}
          {(status || error) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                error ? "border-rust/40 bg-rust/10 text-rust" : "border-line-subtle bg-ink/80 text-parchment-muted"
              }`}
            >
              {error || status}
            </div>
          )}

          {/* ── Full-width single-column flow (matches Reference / Arena) ── */}

          {/* Upload card */}
          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Model Upload</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Upload a loan model</h3>
              </div>
              <div className="rounded-full border border-line-subtle px-3 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                Session only
              </div>
            </div>

            <div className="mt-4">
              <SecureDropzone
                accept=".pkl,.pmml,.onnx,.joblib"
                title="Drop model file here"
                helperText=".pkl  .pmml  .onnx  .joblib"
                onFileSelected={handleModelUpload}
                selectedLabel={uploadedModelName ? `${uploadedModelName} loaded.` : undefined}
              />
            </div>

            {hasLoadedModel && modelType ? (
              <div
                aria-live="polite"
                className={`mt-4 rounded-full border px-4 py-3 text-xs uppercase tracking-[0.22em] shadow-panel ${
                  modelType === "rayctified"
                    ? "border-gold/40 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),rgba(17,17,21,0.95)_72%)] text-gold shadow-[0_0_30px_rgba(212,175,55,0.15)]"
                    : "border-rust/35 bg-black/20 text-rust"
                }`}
              >
                {modelType === "rayctified"
                  ? "🛡️ RayCtified Model (Post-Processing Active)"
                  : "⚠️ Standard Model (Unmitigated)"}
              </div>
            ) : null}
          </div>

          {/* ── After model load ────────────────────── */}
          {hasLoadedModel ? (
            <>
              {/* Model-active banner */}
              <div
                aria-live="polite"
                className="rounded-[1.75rem] border border-gold/35 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),rgba(17,17,21,0.95)_58%)] p-5 shadow-panel"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/10 shadow-[0_0_30px_rgba(212,175,55,0.18)]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-gold" aria-hidden="true">
                        <path
                          d="M5 13.2 9.2 17.5 19 7.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-display text-xl text-parchment">✅ Model Active</h3>
                      <p className="mt-1 text-sm text-parchment-muted">{uploadedModelSummary}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-gold">
                      {uploadedModelName}
                    </div>
                    <div className="rounded-full border border-line-subtle px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                      {uploadedModelEngine}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── PARAMETER GRID (full-width horizontal) ── */}
              <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.26em] text-gold-soft">Command Center</div>
                    <h3 className="mt-2 font-display text-2xl text-parchment">Parameter Testing</h3>
                  </div>
                  <div className="rounded-full border border-line-subtle px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                    {numericFields.length + selectFields.length} controls
                  </div>
                </div>

                {/* ── Numeric sliders ── */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
                  {numericFields.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-2xl border border-line-subtle bg-ink/80 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-parchment">{field.label}</span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                            field.sensitive
                              ? "border-rust/40 bg-rust/10 text-rust"
                              : "border-line-subtle text-parchment-muted"
                          }`}
                        >
                          {field.sensitive ? "Sensitive" : "Financial"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-xs text-parchment-muted">Value</span>
                        <span className="font-display text-lg text-gold">
                          {formatMetric(values[field.key] ?? field.defaultValue ?? 0, field.suffix || "")}
                        </span>
                      </div>

                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={values[field.key] ?? field.defaultValue ?? 0}
                        onChange={(event) => handleValueChange(field.key, Number(event.target.value))}
                        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-parchment-muted/20 accent-gold"
                      />

                      <div className="mt-1.5 flex justify-between text-[11px] text-parchment-muted">
                        <span>{formatMetric(field.min ?? 0, field.suffix || "")}</span>
                        <span>{formatMetric(field.max ?? 0, field.suffix || "")}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Select dropdowns ── */}
                {selectFields.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
                    {selectFields.map((field) => (
                      <div
                        key={field.key}
                        className="rounded-2xl border border-line-subtle bg-ink/80 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-parchment">{field.label}</span>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                              field.sensitive
                                ? "border-rust/40 bg-rust/10 text-rust"
                                : "border-line-subtle text-parchment-muted"
                            }`}
                          >
                            {field.sensitive ? "Sensitive" : "Context"}
                          </span>
                        </div>

                        <div className="mt-3 font-display text-lg text-gold">
                          {formatFieldValue(field, values[field.key] ?? field.defaultValue)}
                        </div>

                        <select
                          value={String(values[field.key] ?? field.defaultValue ?? "")}
                          onChange={(event) =>
                            handleValueChange(
                              field.key,
                              field.valueType === "number" ? Number(event.target.value) : event.target.value
                            )
                          }
                          className="mt-3 w-full rounded-xl border border-line-subtle bg-black/30 px-3 py-2.5 text-sm text-parchment outline-none transition focus:border-gold/50"
                        >
                          {field.options?.map((option) => (
                            <option key={String(getOptionValue(option))} value={String(getOptionValue(option))}>
                              {getOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Action row: Preset + Run Audit ───── */}
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-1 min-w-0">
                    <div className="w-full sm:w-64">
                      <label className="block text-xs uppercase tracking-[0.22em] text-parchment-muted mb-2">
                        Preset
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={(event) => handlePresetChange(event.target.value)}
                        className="w-full rounded-xl border border-line-subtle bg-black/30 px-3 py-2.5 text-sm text-parchment outline-none transition focus:border-gold/50"
                      >
                        <option value="">Choose a preset</option>
                        {Object.entries(PRESETS).map(([presetId, preset]) => (
                          <option key={presetId} value={presetId}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {activePreset && (
                      <p className="text-sm text-parchment-muted leading-snug max-w-md">
                        {activePreset.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={runManualAudit}
                    className="shrink-0 rounded-2xl border border-gold/50 bg-gold/10 px-8 py-4 font-display text-xl text-parchment font-semibold transition hover:bg-gold/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.18)] active:scale-[0.98]"
                  >
                    Run Audit
                  </button>
                </div>
              </div>

              {/* ── CSV Batch + Run button row ────────── */}
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <SecureDropzone
                  accept=".csv"
                  compact
                  title="Batch CSV test"
                  helperText="CSV is parsed locally. Missing fields use current slider values."
                  onFileSelected={handleBatchUpload}
                />
              </div>
            </>
          ) : (
            /* ── Empty state before model upload ───── */
            <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-6 shadow-panel">
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Awaiting Upload</div>
              <h3 className="mt-2 font-display text-2xl text-parchment">Upload a model to begin</h3>
              <p className="mt-2 text-sm text-parchment-muted">
                The parameter testing controls will appear after a model is loaded.
              </p>
            </div>
          )}

          {/* ── Decision Panel (full-width) ────────── */}
          {manualResult ? (
            <DecisionPanel
              title="Decision Output"
              subtitle="Confidence and factors behind the current test."
              result={manualResult}
              highlightSensitive
            />
          ) : null}

          {/* ── Session Log (full-width) ───────────── */}
          <SessionLogTable title="Session Log" rows={auditorHistory} />

          {/* ── Batch Results (full-width) ──────────── */}
          {batchResults.length ? <BatchResultsTable title="Batch Results" rows={batchResults} /> : null}
        </div>
      </section>
    </div>
  );
}
