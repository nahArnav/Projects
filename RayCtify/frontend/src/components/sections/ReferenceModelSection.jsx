import { useEffect, useRef, useState } from "react";
import { BatchResultsTable } from "../common/BatchResultsTable";
import { DecisionPanel } from "../common/DecisionPanel";
import { DynamicParameterForm } from "../common/DynamicParameterForm";
import { SectionHeader } from "../common/SectionHeader";
import { SecureDropzone } from "../common/SecureDropzone";
import { SessionLogTable } from "../common/SessionLogTable";
import { REFERENCE_MODEL_SCHEMA, createInitialValues, normalizeSchema } from "../../data/schemas";
import { STANDARD_EDGE_CASES, getPresetValueForField } from "../../data/testVectors";
import { useSessionStore } from "../../store/sessionStore";
import { evaluateReferenceModel, getReferenceSchema } from "../../utils/api";
import { parseCsvFile, mergeRecordsWithSchema } from "../../utils/csv";
import { exportElementToPdf } from "../../utils/pdf";

const howItWorks = [
  "Use RayCtify's fair reference model to see how a cleaner lending model behaves.",
  "Try one applicant at a time with the sliders, or upload a CSV to test a batch.",
  "Use the results here as a benchmark when you compare them with your own model."
];

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildSessionLogEntry({ id, caseId, mode, decision, summary, parameters }) {
  return {
    id,
    caseId,
    mode,
    decision,
    summary,
    parameters,
    timestamp: timestamp()
  };
}

export function ReferenceModelSection() {
  const reportRef = useRef(null);
  const { referenceHistory, appendHistoryEntries } = useSessionStore();
  const [schema, setSchema] = useState(normalizeSchema(REFERENCE_MODEL_SCHEMA));
  const [values, setValues] = useState(createInitialValues(normalizeSchema(REFERENCE_MODEL_SCHEMA)));
  const [selectedVector, setSelectedVector] = useState("");
  const [manualResult, setManualResult] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchema() {
      try {
        const response = await getReferenceSchema();
        if (active && response.schema?.length) {
          const normalizedSchema = normalizeSchema(response.schema);
          setSchema(normalizedSchema);
          setValues(createInitialValues(normalizedSchema));
        }
      } catch {
        if (active) {
          setSchema(normalizeSchema(REFERENCE_MODEL_SCHEMA));
        }
      }
    }

    loadSchema();
    return () => {
      active = false;
    };
  }, []);

  function handleValueChange(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyVector(vectorId) {
    setSelectedVector(vectorId);
    const vector = STANDARD_EDGE_CASES.find((item) => item.id === vectorId);
    if (!vector) {
      return;
    }

    const seeded = createInitialValues(schema);
    schema.forEach((field) => {
      const presetValue = getPresetValueForField(field.key, vector.values);
      if (presetValue !== undefined) {
        seeded[field.key] = presetValue;
      }
    });
    setValues(seeded);
  }

  async function runManualAudit() {
    setError("");
    setStatus("Running the reference model...");

    try {
      const response = await evaluateReferenceModel([{ case_id: "reference-manual", ...values }]);
      const result = response.records?.[0];
      setManualResult(result);
      setBatchResults([]);
      setStatus("Reference result ready. You can compare it with your uploaded model.");
      appendHistoryEntries("referenceHistory", [
        buildSessionLogEntry({
          id: `reference-manual-${Date.now()}`,
          caseId: result?.case_id || "reference-manual",
          mode: "Manual",
          decision: result?.decision || "N/A",
          summary: result?.summary || "Reference evaluation complete.",
          parameters: { ...values }
        })
      ]);
    } catch (caughtError) {
      setError(caughtError.message);
      setStatus("");
    }
  }

  async function handleBatchUpload(file) {
    setError("");
    setStatus("Reading the CSV and testing it against the reference model...");

    try {
      const parsedRecords = await parseCsvFile(file);
      const records = mergeRecordsWithSchema(parsedRecords, schema, values);
      const response = await evaluateReferenceModel(records);
      const logTimestamp = Date.now();
      setBatchResults(response.records || []);
      setManualResult(response.records?.[0] || null);
      setStatus(`Reference batch completed for ${response.records?.length || 0} records.`);
      const batchLogEntries = (response.records || []).map((result, index) =>
        buildSessionLogEntry({
          id: `reference-batch-${logTimestamp}-${index}`,
          caseId: result?.case_id || records[index]?.case_id || `case-${index + 1}`,
          mode: "CSV Batch",
          decision: result?.decision || "N/A",
          summary: result?.summary || "CSV batch checked against the reference model.",
          parameters: Object.fromEntries(
            Object.entries(records[index] || {}).filter(([key]) => key !== "case_id")
          )
        })
      );
      appendHistoryEntries("referenceHistory", batchLogEntries);
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
      await exportElementToPdf(reportRef.current, `RayCtify_Reference_Model_Report_${seq}.pdf`);
    } catch (caughtError) {
      setError(caughtError.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 py-3 sm:px-3 sm:py-4 lg:px-4 lg:py-5">
      <section ref={reportRef} className="section-anchor luxe-panel rounded-[2rem] p-4 sm:p-6 lg:p-8">
        <SectionHeader
          eyebrow="Feature Section 2"
          title="The RayCtify Reference Model"
          description="This built-in model uses financial fields only. It gives you a cleaner benchmark to compare against your own model."
          howItWorks={howItWorks}
          onExport={handleExport}
        />

        <div className="mt-6 w-full space-y-6">
          <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Reference Standard</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Financial-Only Underwriting Inputs</h3>
              </div>
              <div className="rounded-full border border-line-subtle px-3 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                No demographic bias points
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-parchment-muted">
              This view removes demographic and proxy inputs so you can see how a fairer model behaves before moving
              into the Arena.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-parchment-muted">Standardized Edge Cases</label>
                <select
                  value={selectedVector}
                  onChange={(event) => applyVector(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-line-subtle bg-ink/70 px-4 py-3 text-sm text-parchment outline-none transition focus:border-gold/50"
                >
                  <option value="">Choose a fair-model probe</option>
                  {STANDARD_EDGE_CASES.map((vector) => (
                    <option key={vector.id} value={vector.id}>
                      {vector.label}
                    </option>
                  ))}
                </select>
              </div>

                <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Independent verification</div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    If your uploaded model behaves very differently here, the gap may come from thresholds, proxy use,
                    or bias.
                  </p>
                </div>
            </div>
          </div>

          <DynamicParameterForm
            schema={schema}
            values={values}
            onChange={handleValueChange}
            title="Parameter Testing Interface"
            note="Use these sliders to test one borrower profile at a time. Demographic and proxy fields are left out on purpose."
          />

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <SecureDropzone
              accept=".csv"
              compact
              title="Upload a CSV batch for reference benchmarking"
              helperText="The CSV is read in your browser, then the cleaned rows are checked against the reference model."
              onFileSelected={handleBatchUpload}
            />

            <button
              type="button"
              onClick={runManualAudit}
              className="rounded-[1.5rem] border border-gold/50 bg-gold/10 px-8 py-6 text-left text-sm font-semibold text-gold transition hover:bg-gold/15 md:min-w-[260px]"
            >
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Primary Action</div>
              <div className="mt-3 font-display text-2xl text-parchment">Run Audit</div>
              <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                Run the current applicant details and add the result to the session log.
              </p>
            </button>
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

          <SessionLogTable title="Reference Session Log" rows={referenceHistory} />

          {manualResult ? (
            <DecisionPanel
              title="Reference Output"
              subtitle="A clean benchmark based on financial details only."
              result={manualResult}
            />
          ) : null}

          {batchResults.length ? <BatchResultsTable title="Reference Batch Summary" rows={batchResults} /> : null}
        </div>
      </section>
    </div>
  );
}
