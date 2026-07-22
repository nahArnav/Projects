import { motion } from "framer-motion";
import { formatPercent } from "../../utils/formatters";

export function DecisionPanel({ title, subtitle, result, highlightSensitive = false }) {
  if (!result) {
    return (
      <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 text-sm leading-6 text-parchment-muted">
        Run an audit to see the decision here.
      </div>
    );
  }

  const decisionTone =
    result.decision === "ACCEPTED"
      ? "border-gold/40 bg-gold/10 text-gold"
      : "border-rust/40 bg-rust/10 text-rust";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel"
    >
      <div className="flex flex-col gap-4 border-b border-line-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">{title}</div>
          <div className="mt-2 font-display text-3xl text-parchment">{result.decision}</div>
          <p className="mt-2 text-sm leading-6 text-parchment-muted">{subtitle || result.summary}</p>
        </div>

        <div className={`rounded-3xl border px-4 py-4 ${decisionTone}`}>
          <div className="text-xs uppercase tracking-[0.2em]">Decision Confidence</div>
          <div className="mt-2 font-display text-3xl">{formatPercent(result.confidence ?? 0)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Model Score</div>
          <div className="mt-2 font-display text-3xl text-gold">{formatPercent(result.score ?? 0)}</div>
        </div>
        <div className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-parchment-muted">Sensitive Flags</div>
          <div className="mt-2 text-sm leading-6 text-parchment-muted">
            {result.flagged_sensitive_features?.length
              ? result.flagged_sensitive_features.join(", ")
              : "None detected."}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-[0.22em] text-gold-soft">Feature Importance Breakdown</div>
        <div className="mt-3 space-y-3">
          {result.feature_breakdown?.map((item) => (
            <div
              key={`${item.feature}-${item.rationale}`}
              className={`rounded-3xl border px-4 py-4 ${
                highlightSensitive && item.sensitive
                  ? "border-rust/35 bg-rust/10"
                  : "border-line-subtle bg-ink/70"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-parchment">{item.label}</span>
                    {item.sensitive ? (
                      <span className="rounded-full border border-rust/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-rust">
                        Sensitive
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-parchment-muted">{item.rationale}</p>
                </div>
                <div className="font-display text-2xl text-gold">
                  {item.impact > 0 ? "+" : ""}
                  {formatPercent(item.impact)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

