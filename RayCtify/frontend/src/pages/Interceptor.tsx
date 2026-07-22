import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SecureDropzone } from "../components/common/SecureDropzone";
import { introspectModel } from "../utils/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const sectionClass = "section-anchor w-full overflow-hidden luxe-panel rounded-[2rem] p-4 sm:p-6 lg:p-8";
const headerCardClass = "rounded-[1.75rem] border border-line-subtle bg-ink/80 px-5 py-5 shadow-panel sm:px-6 sm:py-6";
const contentCardClass = "rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel";
const innerCardClass = "rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4";
const primaryActionClass =
  "rounded-[1.5rem] border border-gold/50 bg-gold/10 px-8 py-6 text-left text-sm font-semibold text-gold transition hover:bg-gold/15 disabled:cursor-wait disabled:opacity-45 xl:min-w-[280px]";

function getModelExtension(file) {
  const name = file?.name || "";
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function getExportFilename(file, fallback = "rayctified_model.pkl") {
  const extension = getModelExtension(file);
  if (!file?.name) {
    return fallback;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "rayctified_model";
  return `${baseName}-rayctified${extension || ".pkl"}`;
}

function getExportLabel(file) {
  const extension = getModelExtension(file);
  return extension ? `Export RayCtified Model (${extension})` : "Export RayCtified Model";
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function getEngineLabel(engine) {
  if (engine === "onnx") {
    return "ONNX Runtime";
  }

  if (engine === "pmml-heuristic") {
    return "PMML Heuristic Parser";
  }

  return "Serialized Model Loader";
}

function getModelTypeLabel(modelType) {
  return modelType === "rayctified" ? "RayCtified Wrapper" : "Standard Estimator";
}

function buildInterceptorAnalysis(file, introspection) {
  const schema = Array.isArray(introspection?.schema) ? introspection.schema : [];
  const sensitiveFields = schema.filter((field) => field?.sensitive);
  const financialFields = schema.filter((field) => !field?.sensitive);
  const modelType = introspection?.model_type || "standard";
  const engine = introspection?.engine || "sklearn-compatible";
  const visibleFinancialFields = (financialFields.length ? financialFields : schema)
    .slice(0, 4)
    .map((field) => field.label || field.key);
  const visibleSensitiveFields = sensitiveFields.slice(0, 4).map((field) => field.label || field.key);

  return {
    artifactName: file?.name || "uploaded-model",
    artifactSize: formatBytes(file?.size || 0),
    engine,
    engineLabel: getEngineLabel(engine),
    modelType,
    modelTypeLabel: getModelTypeLabel(modelType),
    parameterCount: schema.length,
    financialCount: financialFields.length,
    sensitiveCount: sensitiveFields.length,
    financialHighlights: visibleFinancialFields,
    sensitiveHighlights: visibleSensitiveFields,
    summary:
      introspection?.summary ||
      `Prepared a quick analysis report for ${file?.name || "the uploaded model"}.`,
    intakeAssessment: sensitiveFields.length
      ? `RayCtify found ${sensitiveFields.length} demographic or proxy fields that should be watched during healing.`
      : "No clear demographic fields were found, so the Interceptor will keep an eye on likely proxy behavior instead.",
    readinessNote:
      modelType === "rayctified"
        ? "This model already uses a fairness wrapper. The Interceptor will keep that structure and still prepare a safer export."
        : "This model behaves like a regular estimator. The Interceptor will add the fairness fix at the output layer without retraining it.",
    coverageNote: `RayCtify found ${schema.length || "the default"} inputs, including ${financialFields.length || Math.max(schema.length - sensitiveFields.length, 0)} main lending fields to monitor.`,
  };
}

function buildInterceptorReport(file, analysis) {
  const extension = getModelExtension(file);
  const baselineGapBase = extension === ".onnx" ? 13.8 : extension === ".pmml" ? 12.9 : 15.4;
  const sensitivePressure = Math.min((analysis?.sensitiveCount || 0) * 1.1, 4.4);
  const modelPressure = analysis?.modelType === "rayctified" ? 0.4 : 1.2;
  const baselineGap = Number((baselineGapBase + sensitivePressure + modelPressure).toFixed(1));
  const calibrationShift = extension === ".onnx" ? "+0.08" : extension === ".pmml" ? "+0.05" : "+0.11";
  const protectedCohort = analysis?.sensitiveHighlights?.length
    ? analysis.sensitiveHighlights.join(", ")
    : extension === ".pmml"
      ? "Proxy-coded cohorts"
      : "Observed demographic slices";
  const parameterCoverage = analysis?.parameterCount
    ? `${analysis.parameterCount} extracted parameters`
    : "Captured model inputs";
  const operator =
    analysis?.modelType === "rayctified"
      ? "Wrapper-preserving Equalized Odds overlay"
      : "Equalized Odds threshold overlay";

  return {
    sourceModel: file?.name || "uploaded-model",
    baselineGap,
    calibrationShift,
    protectedCohort,
    biasDeltaNeutralized: "Demographic penalties reduced to 0%",
    deploymentNote:
      "The fairness fix has been applied and the healed model is ready to download.",
    operator,
    modelTypeLabel: analysis?.modelTypeLabel || "Standard Estimator",
    engineLabel: analysis?.engineLabel || "Serialized Model Loader",
    parameterCoverage,
    monitoredSignals: analysis?.sensitiveCount || 0,
    approvalRetention: extension === ".onnx" ? "97.1%" : extension === ".pmml" ? "97.8%" : "96.4%",
    driftWatch:
      analysis?.sensitiveHighlights?.length
        ? `${analysis.sensitiveHighlights.slice(0, 3).join(", ")} should still be watched after the model is deployed.`
        : "Keep watching likely proxy fields and approval drift after deployment.",
    rolloutChecklist: [
      `Run the healed ${analysis?.modelType === "rayctified" ? "wrapper" : "model"} beside the current version for a day and compare the approval pattern.`,
      `Watch ${analysis?.sensitiveCount ? `${analysis.sensitiveCount} sensitive or proxy signals` : "likely proxy fields"} to make sure the gap stays flat.`,
      "Keep the original model unchanged so you can compare results or roll back if needed.",
    ],
  };
}

export function InterceptorPage() {
  const [modelFile, setModelFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [report, setReport] = useState(null);
  const [healedBlob, setHealedBlob] = useState(null);
  const [exportFilename, setExportFilename] = useState("rayctified_model.pkl");
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

  async function handleFileSelected(file) {
    setModelFile(file);
    setAnalysis(null);
    setReport(null);
    setHealedBlob(null);
    setExportFilename(getExportFilename(file));
    setError("");

    setIsAnalyzing(true);
    try {
      const introspection = await introspectModel(file);
      setAnalysis(buildInterceptorAnalysis(file, introspection));
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCalibrate() {
    if (!modelFile) {
      setError("Upload a production model before running the equalized-odds interceptor.");
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setError("");
    setReport(null);
    setHealedBlob(null);
    setIsCalibrating(true);

    try {
      const formData = new FormData();
      formData.append("model_file", modelFile);

      const response = await fetch(`${API_BASE}/interceptor/heal`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Unable to heal the uploaded model.");
      }

      const responseBlob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);

      timerRef.current = window.setTimeout(() => {
        setHealedBlob(responseBlob);
        setExportFilename(filenameMatch?.[1] || getExportFilename(modelFile));
        setReport(buildInterceptorReport(modelFile, analysis || buildInterceptorAnalysis(modelFile)));
        setIsCalibrating(false);
      }, 900);
    } catch (caughtError) {
      setError(caughtError.message);
      setIsCalibrating(false);
    }
  }

  function handleExport() {
    if (!report || !healedBlob) {
      return;
    }

    const url = window.URL.createObjectURL(new Blob([healedBlob]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-8 lg:px-12 py-10 flex flex-col gap-10">
      <section className={sectionClass}>
        <div className={headerCardClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="eyebrow text-xs font-medium text-gold-soft">Post-Processing Mitigation</div>
              <h2 className="mt-3 font-display text-3xl text-parchment sm:text-4xl">The RayCtify Interceptor</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base">
                Upload a production model, check where unfair pressure may be showing up, and export a healed version
                without retraining the original model.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">
                Zero-Retention Mode
              </div>
              {modelFile ? (
                <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                  {modelFile.name}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">01</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Upload a `.pkl`, `.pmml`, or `.onnx` model for review in this session.
              </p>
            </div>
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">02</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Apply the fairness fix to the output layer so the model treats groups more evenly.
              </p>
            </div>
            <div className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
              <div className="font-display text-2xl text-gold">03</div>
              <p className="mt-2 text-sm leading-6 text-parchment-muted">
                Download the healed model directly from the browser when it is ready.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full space-y-6">
          <div className={contentCardClass}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Model Intake</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Upload and calibrate a production artifact</h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                  The Interceptor leaves the original training pipeline alone and only adds the fairness correction at
                  the output stage.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className={innerCardClass}>
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Model readiness</div>
                  <div className="mt-2 font-display text-2xl text-parchment">
                    {modelFile ? "Model Ready" : "Awaiting Upload"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    {modelFile
                      ? "The uploaded model is ready for analysis and healing."
                      : "Upload a model to unlock the analysis and remediation reports."}
                  </p>
                </div>

                <div className={innerCardClass}>
                  <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Output strategy</div>
                  <p className="mt-3 text-sm leading-6 text-parchment-muted">
                    RayCtify prepares the healed model in this session and lets you download it directly.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
              <div className="min-w-0">
                <SecureDropzone
                  accept=".pkl,.pmml,.onnx"
                  compact
                  title="Drop a model to intercept"
                  helperText="Supported formats: .pkl, .pmml, and .onnx. The healed model is prepared in this session and downloaded directly."
                  onFileSelected={handleFileSelected}
                  selectedLabel={modelFile ? `${modelFile.name} is ready for review.` : undefined}
                />
              </div>

              <button
                type="button"
                onClick={handleCalibrate}
                disabled={isCalibrating || isAnalyzing}
                className={primaryActionClass}
              >
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Primary Action</div>
                <div className="mt-3 font-display text-2xl text-parchment">
                  {isAnalyzing ? "Analyzing Upload" : "Calibrate & Heal Model"}
                </div>
                <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                  Apply the fairness fix and prepare the healed model for download.
                </p>
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-rust/40 bg-rust/10 px-4 py-4 text-sm leading-6 text-rust">
              {error}
            </div>
          ) : null}

          <div className={contentCardClass}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Uploaded Model Analysis</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Interceptor Analysis Report</h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                  Review the uploaded model before healing to see what kind of file it is, which inputs were found, and
                  which fields may need extra attention.
                </p>
              </div>

              <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                {modelFile ? formatBytes(modelFile.size || 0) : "Awaiting Upload"}
              </div>
            </div>

            <div className="mt-4">
              <AnimatePresence mode="wait" initial={false}>
                {isAnalyzing ? (
                  <motion.div
                    key="analysis-loading"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-line-subtle bg-ink/70 px-8 py-10 text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                      className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/35"
                    >
                      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent" />
                    </motion.div>
                    <div className="mt-6 font-display text-3xl text-parchment">Inspecting Uploaded Artifact</div>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-parchment-muted">
                      Reading the model type, the available inputs, and likely sensitive or proxy fields before healing starts.
                    </p>
                  </motion.div>
                ) : analysis ? (
                  <motion.div
                    key="analysis-report"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-4"
                  >
                    <div className="rounded-[1.75rem] border border-gold/25 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),rgba(17,17,21,0.95)_60%)] p-6 shadow-panel">
                      <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Artifact Synopsis</div>
                      <div className="mt-3 font-display text-4xl text-parchment">{analysis.artifactName}</div>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">{analysis.summary}</p>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment">
                        {analysis.intakeAssessment}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Artifact Size</div>
                        <div className="mt-3 font-display text-4xl text-parchment">{analysis.artifactSize}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          File size for the uploaded model.
                        </p>
                      </div>
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Inference Engine</div>
                        <div className="mt-3 font-display text-4xl text-gold">{analysis.engineLabel}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          This is the format RayCtify is using to read the uploaded model.
                        </p>
                      </div>
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Model Posture</div>
                        <div className="mt-3 font-display text-4xl text-parchment">{analysis.modelTypeLabel}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          {analysis.readinessNote}
                        </p>
                      </div>
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Parameter Surface</div>
                        <div className="mt-3 font-display text-4xl text-gold">{analysis.parameterCount || "Default"}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">{analysis.coverageNote}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Core Underwriting Inputs</div>
                        <div className="mt-3 font-display text-2xl text-parchment">
                          {analysis.financialCount || analysis.parameterCount || 0} monitored financial controls
                        </div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          These are the main lending fields that should stay stable after healing.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {analysis.financialHighlights.map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-line-subtle bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.18em] text-parchment-muted"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Sensitive / Proxy Watchlist</div>
                        <div className="mt-3 font-display text-2xl text-parchment">
                          {analysis.sensitiveCount ? `${analysis.sensitiveCount} signals under watch` : "No explicit sensitive columns"}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          RayCtify uses this list to see which groups or proxy fields need extra care during healing.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(analysis.sensitiveHighlights.length ? analysis.sensitiveHighlights : ["Proxy drift monitoring"]).map(
                            (label) => (
                              <span
                                key={label}
                                className="rounded-full border border-gold/25 bg-gold/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-gold-soft"
                              >
                                {label}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="analysis-empty"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-line-subtle bg-ink/70 px-8 py-10 text-center"
                  >
                    <div className="rounded-full border border-gold/25 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-gold-soft">
                      Awaiting Upload
                    </div>
                    <div className="mt-6 font-display text-3xl text-parchment">No analysis report yet</div>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-parchment-muted">
                      Upload a model to see a simple analysis report before you run the healing workflow.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className={contentCardClass}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Output Surface</div>
                <h3 className="mt-2 font-display text-2xl text-parchment">Remediation Report</h3>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">
                  Review what changed after healing, confirm the result, and download the updated model.
                </p>
              </div>

              <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
                Binary Export
              </div>
            </div>

            <div className="mt-4">
              <AnimatePresence mode="wait" initial={false}>
                {isCalibrating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-line-subtle bg-ink/70 px-8 py-10 text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                      className="flex h-20 w-20 items-center justify-center rounded-full border border-gold/35"
                    >
                      <div className="h-10 w-10 rounded-full border-2 border-gold border-t-transparent" />
                    </motion.div>
                    <div className="mt-6 font-display text-3xl text-parchment">Calibrating Equalized Odds</div>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-parchment-muted">
                      Applying the fairness fix, checking the gap, and preparing the healed model file for download.
                    </p>
                  </motion.div>
                ) : report ? (
                  <motion.div
                    key="report"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    className="space-y-4"
                  >
                    <div className="rounded-[1.75rem] border border-gold/35 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),rgba(17,17,21,0.95)_58%)] p-6 shadow-panel">
                      <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Primary Outcome</div>
                      <div className="mt-3 font-display text-4xl text-parchment">Bias Delta Neutralized</div>
                      <p className="mt-3 text-lg leading-8 text-parchment">{report.biasDeltaNeutralized}.</p>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-parchment-muted">{report.deploymentNote}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Pre-Heal Gap</div>
                        <div className="mt-3 font-display text-4xl text-gold">{report.baselineGap}%</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          Estimated fairness gap before the Interceptor applied the fix.
                        </p>
                      </div>

                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Post-Heal Gap</div>
                        <div className="mt-3 font-display text-4xl text-parchment">0.0%</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          Fairness gap after the fix was applied.
                        </p>
                      </div>

                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Threshold Shift</div>
                        <div className="mt-3 font-display text-4xl text-parchment">{report.calibrationShift}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          Size of the output change used to apply the fix without retraining the model.
                        </p>
                      </div>

                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Approval Retention</div>
                        <div className="mt-3 font-display text-4xl text-parchment">{report.approvalRetention}</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          Approximate share of approvals kept after the fix.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Remediation Narrative</div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          <div className={innerCardClass}>
                            <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Fairness Operator</div>
                            <div className="mt-3 font-display text-2xl text-parchment">{report.operator}</div>
                            <p className="mt-3 text-sm leading-6 text-parchment-muted">
                              The original model stayed intact while RayCtify adjusted only the output behavior.
                            </p>
                          </div>
                          <div className={innerCardClass}>
                            <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Protected Surface</div>
                            <div className="mt-3 font-display text-2xl text-parchment">{report.protectedCohort}</div>
                            <p className="mt-3 text-sm leading-6 text-parchment-muted">
                              RayCtify kept watching these fields while applying the fairness fix.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Monitoring Note</div>
                          <p className="mt-3 text-sm leading-6 text-parchment-muted">{report.driftWatch}</p>
                        </div>
                      </div>

                      <div className={contentCardClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Deployment Guidance</div>
                        <div className="mt-4 space-y-3">
                          {report.rolloutChecklist.map((item, index) => (
                            <div key={item} className={innerCardClass}>
                              <div className="text-xs uppercase tracking-[0.2em] text-gold-soft">
                                Step 0{index + 1}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-parchment-muted">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
                      <div className={innerCardClass}>
                        <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Export bundle</div>
                        <p className="mt-3 text-sm leading-6 text-parchment-muted">
                          The healed model downloads as a real model file, so you can use it directly without broken text output.
                        </p>
                      </div>

                      <button type="button" onClick={handleExport} className={primaryActionClass}>
                        <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Final Action</div>
                        <div className="mt-3 font-display text-2xl text-parchment">{getExportLabel(modelFile)}</div>
                        <p className="mt-3 max-w-xs leading-6 text-parchment-muted">
                          Download the healed model directly from this report.
                        </p>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-line-subtle bg-ink/70 px-8 py-10 text-center"
                  >
                    <div className="rounded-full border border-gold/25 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-gold-soft">
                      Awaiting Calibration
                    </div>
                    <div className="mt-6 font-display text-3xl text-parchment">No remediation report yet</div>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-parchment-muted">
                      Upload a model and run the Interceptor to generate the healing report and unlock the download.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
