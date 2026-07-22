import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BatchResultsTable } from "../common/BatchResultsTable";
import { DecisionPanel } from "../common/DecisionPanel";
import { DynamicParameterForm } from "../common/DynamicParameterForm";
import { SectionHeader } from "../common/SectionHeader";
import { SecureDropzone } from "../common/SecureDropzone";
import { SessionLogTable } from "../common/SessionLogTable";
import { DEFAULT_AUDITOR_SCHEMA, createInitialValues } from "../../data/schemas";
import { getPresetValueForField } from "../../data/testVectors";
import { useSessionStore } from "../../store/sessionStore";
import { parseCsvFile, mergeRecordsWithSchema } from "../../utils/csv";
import { exportElementToPdf } from "../../utils/pdf";
import { runArenaComparison } from "../../utils/api";

const howItWorks = [
  "Use one shared form so both models are tested with the same applicant details.",
  "Run the comparison to see how your uploaded model differs from RayCtify's fair reference model.",
  "Review the side-by-side results and the saved logs from this session."
];

const PRESETS = {
  high_income_high_risk: {
    label: "High Income / High Risk",
    description: "Strong financials with sensitive or proxy markers still present so the gap stays easy to spot.",
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
    description: "A weak borrower profile that should be rejected cleanly when both models read the same applicant state.",
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
    description: "A near-threshold case that highlights whether the uploaded model is drifting away from the fair reference benchmark.",
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

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildArenaLogEntry({ id, caseId, mode, decision, summary, parameters, loggedAt }) {
  return {
    id,
    caseId,
    mode,
    decision,
    summary,
    parameters,
    timestamp: loggedAt
  };
}

function buildPresetState(schema, presetId) {
  const baseValues = createInitialValues(schema);
  const preset = PRESETS[presetId];

  if (!preset) {
    return baseValues;
  }

  schema.forEach((field) => {
    const presetValue = getPresetValueForField(field.key, preset.values);
    if (presetValue !== undefined) {
      baseValues[field.key] = presetValue;
    }
  });

  return baseValues;
}

export function ArenaSection() {
  const reportRef = useRef(null);
  const {
    uploadedModelFile,
    uploadedModelSchema,
    uploadedModelName,
    uploadedModelSummary,
    auditorHistory,
    referenceHistory,
    arenaUserHistory,
    arenaReferenceHistory,
    appendHistoryEntries
  } = useSessionStore();
  const schema = uploadedModelSchema?.length ? uploadedModelSchema : DEFAULT_AUDITOR_SCHEMA;
  const [values, setValues] = useState(createInitialValues(schema));
  const [selectedPreset, setSelectedPreset] = useState("");
  const [comparison, setComparison] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState("Upload a model in The Model Auditor, then compare it here.");
  const [error, setError] = useState("");
  const activePreset = PRESETS[selectedPreset] || null;

  useEffect(() => {
    setValues(createInitialValues(schema));
    setSelectedPreset("");
  }, [schema]);

  function handleValueChange(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handlePresetChange(presetId) {
    setSelectedPreset(presetId);
    setValues(buildPresetState(schema, presetId));
  }

  async function runComparativeAudit(records) {
    if (!uploadedModelFile) {
      setError("Load a model in The Model Auditor first so the Arena can compare it against RayCtify.");
      return;
    }

    setError("");
    setStatus("Running both models on the same applicant details...");

    try {
      const response = await runArenaComparison(uploadedModelFile, records);
      const normalizedRecords = response.records || [];
      const firstRecord = normalizedRecords[0] || null;
      const loggedAt = timestamp();
      const logSeed = Date.now();

      setComparison(firstRecord);
      setBatchResults(normalizedRecords);
      setRevealed(Boolean(firstRecord));
      setStatus("Comparison complete. Review the side-by-side results and logs below.");

      const uploadedEntries = normalizedRecords.map((result, index) =>
        buildArenaLogEntry({
          id: `arena-user-${logSeed}-${index}`,
          caseId: result?.case_id || records[index]?.case_id || `case-${index + 1}`,
          mode: records.length > 1 ? "CSV Batch" : "Manual",
          decision: result?.user_result?.decision || "N/A",
          summary:
            result?.user_result?.summary ||
            result?.delta_summary ||
            "Uploaded model checked for this applicant.",
          parameters: Object.fromEntries(Object.entries(records[index] || {}).filter(([key]) => key !== "case_id")),
          loggedAt
        })
      );

      const referenceEntries = normalizedRecords.map((result, index) =>
        buildArenaLogEntry({
          id: `arena-reference-${logSeed}-${index}`,
          caseId: result?.case_id || records[index]?.case_id || `case-${index + 1}`,
          mode: records.length > 1 ? "CSV Batch" : "Manual",
          decision: result?.reference_result?.decision || "N/A",
          summary:
            result?.reference_result?.summary ||
            result?.delta_summary ||
            "Reference model checked for this applicant.",
          parameters: Object.fromEntries(Object.entries(records[index] || {}).filter(([key]) => key !== "case_id")),
          loggedAt
        })
      );

      appendHistoryEntries("arenaUserHistory", uploadedEntries);
      appendHistoryEntries("arenaReferenceHistory", referenceEntries);
    } catch (caughtError) {
      setError(caughtError.message);
      setStatus("");
    }
  }

  async function handleManualAudit() {
    await runComparativeAudit([{ case_id: "arena-manual", ...values }]);
  }

  async function handleBatchUpload(file) {
    if (!uploadedModelFile) {
      setError("Load a model in The Model Auditor first so the Arena can compare it against RayCtify.");
      return;
    }

    setError("");
    setStatus("Reading the CSV and preparing both models for comparison...");

    try {
      const parsedRecords = await parseCsvFile(file);
      const records = mergeRecordsWithSchema(parsedRecords, schema, values);
      await runComparativeAudit(records);
    } catch (caughtError) {
      setError(caughtError.message);
      setStatus("");
    }
  }

  const exportCounterRef = useRef(0);
  async function handleExport() {
    setError("");

    try {
      exportCounterRef.current += 1;
      const seq = String(exportCounterRef.current).padStart(3, "0");
      await exportElementToPdf(reportRef.current, `RayCtify_Arena_Comparison_Report_${seq}.pdf`);
    } catch (caughtError) {
      setError(caughtError.message);
    }
  }

  const averageBiasDelta = batchResults.length
    ? Math.round(batchResults.reduce((sum, row) => sum + (row.bias_delta || 0), 0) / batchResults.length)
    : Math.round(comparison?.bias_delta || 0);
  const comparedCases = batchResults.length || (comparison ? 1 : 0);
  const hasUploadedModel = Boolean(uploadedModelFile);

  return (
    <div className="w-full max-w-7xl mx-auto px-8 lg:px-12 py-10 flex flex-col gap-10">
      <section
        ref={reportRef}
        className="section-anchor w-full overflow-hidden luxe-panel rounded-[2rem] p-4 sm:p-6 lg:p-8"
      >
        <SectionHeader
          eyebrow="Feature Section 3"
          title="The Arena"
          description="Compare your uploaded model with RayCtify's fair reference model using the same applicant details."
          howItWorks={howItWorks}
          onExport={handleExport}
        />

        <div className="mt-6 w-full space-y-6">
          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Shared Arena Inputs</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">
                  {hasUploadedModel ? `Live comparison against ${uploadedModelName}` : "Awaiting uploaded model"}
                </h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                  Both models use the same applicant details here, so any difference is easy to spot. Your uploaded
                  model may still react to sensitive or proxy fields, while the RayCtify benchmark does not.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Model readiness</div>
                  <div className="mt-2 font-display text-2xl text-parchment">
                    {hasUploadedModel ? "Comparison Ready" : "Upload Required"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    {hasUploadedModel
                      ? uploadedModelSummary
                      : "Load a model in The Model Auditor to unlock this comparison view."}
                  </p>
                </div>

                <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Bias delta preview</div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    This shows how much the gap shrinks when the same applicant is scored without demographic or proxy pressure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DynamicParameterForm
            schema={schema}
            values={values}
            onChange={handleValueChange}
            title="Shared Comparison Form"
            note="Use one applicant profile for both models. The uploaded model may weigh sensitive fields, while the RayCtify reference model does not."
          />

          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <label className="text-xs uppercase tracking-[0.22em] text-parchment-muted">Preset Scenarios</label>
                <select
                  value={selectedPreset}
                  onChange={(event) => handlePresetChange(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-line-subtle bg-ink/70 px-4 py-3 text-sm text-parchment outline-none transition focus:border-gold/50"
                >
                  <option value="">Choose a comparison preset</option>
                  {Object.entries(PRESETS).map(([presetId, preset]) => (
                    <option key={presetId} value={presetId}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Comparison strategy</div>
                <p className="mt-3 text-sm leading-6 text-parchment-muted">
                  {activePreset
                    ? activePreset.description
                    : "Choose a strict preset to sync the full applicant profile in one step, then compare both models on the same state."}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
              <div className="min-w-0">
                <SecureDropzone
                  accept=".csv"
                  compact
                  title="Upload a comparison CSV batch"
                  helperText="The CSV is read in your browser, missing fields are filled from the current form, and then both models test the same records."
                  onFileSelected={handleBatchUpload}
                />
              </div>

              <button
                type="button"
                onClick={handleManualAudit}
                disabled={!hasUploadedModel}
                className="rounded-[1.5rem] border border-gold/50 bg-gold/10 px-8 py-6 text-left text-sm font-semibold text-gold transition hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-45 xl:min-w-[280px]"
              >
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Primary Action</div>
                <div className="mt-3 font-display text-2xl text-parchment">Run Comparative Audit</div>
                <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                  Run the same applicant details through both models and save the results in separate logs.
                </p>
              </button>
            </div>
          </div>

          {(status || error) && (
            <div
              className={`rounded-3xl border px-4 py-4 text-sm leading-6 ${
                error ? "border-rust/40 bg-rust/10 text-rust" : "border-line-subtle bg-ink/80 text-parchment-muted"
              }`}
            >
              {error || status}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Average Bias Delta</div>
              <div className="mt-3 font-display text-4xl text-gold">{averageBiasDelta}%</div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                The average difference between your model and the fair reference model in the current comparison set.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Compared Cases</div>
              <div className="mt-3 font-display text-4xl text-parchment">{comparedCases}</div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                Manual and CSV comparison runs counted in the current session.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Delta Narrative</div>
              <p className="mt-3 text-sm leading-7 text-parchment-muted">
                {comparison?.delta_summary ||
                  "Run a comparison to see a plain-language summary of where the models start to differ."}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {revealed && comparison ? (
              <motion.div
                layout
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="grid gap-6 2xl:grid-cols-2"
              >
                <div className="min-w-0">
                  <DecisionPanel
                    title="Uploaded Model Output"
                    subtitle="This shows how your uploaded model judged the applicant."
                    result={comparison.user_result}
                    highlightSensitive
                  />
                </div>
                <div className="min-w-0">
                  <DecisionPanel
                    title="RayCtify Standard Output"
                    subtitle="This shows how the fair reference model judged the same applicant."
                    result={comparison.reference_result}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Comparative Audit Logs</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Model-specific decision histories</h3>
              </div>
              <div className="rounded-full border border-line-subtle px-3 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                Parameter snapshots included
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
              Each comparison creates one log for your model and one for the RayCtify benchmark, so both histories stay easy to review.
            </p>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <div className="min-w-0">
              <SessionLogTable title="Uploaded Model Comparative Log" rows={arenaUserHistory} />
            </div>
            <div className="min-w-0">
              <SessionLogTable title="RayCtify Standard Comparative Log" rows={arenaReferenceHistory} />
            </div>
          </div>

          <div className="min-w-0">
            <BatchResultsTable title="Comparative Batch Summary" rows={batchResults} arena />
          </div>

          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Carryover Session History</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Previously tested individual runs</h3>
              </div>
              <div className="rounded-full border border-line-subtle px-3 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                Shared across sections
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
              The Arena also shows the individual tests you already ran in the Auditor and Reference sections, so the full story stays together.
            </p>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <div className="min-w-0">
              <SessionLogTable title="Auditor Session History" rows={auditorHistory} />
            </div>
            <div className="min-w-0">
              <SessionLogTable title="Reference Session History" rows={referenceHistory} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
