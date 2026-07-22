import { motion } from "framer-motion";

const metrics = [
  {
    value: "Zero",
    label: "Retention",
    detail: "Models, CSVs, and results stay in live session memory only."
  },
  {
    value: "Browser",
    label: "CSV + PDF",
    detail: "Batch parsing and reports are generated client-side."
  },
  {
    value: "Dual",
    label: "Model Lens",
    detail: "Test a model against RayCtify's fairness-calibrated baseline."
  }
];

const fade = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export function Hero() {
  return (
    <header className="relative overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fade}
          className="luxe-panel rounded-[2rem] px-6 py-8 sm:px-8 lg:px-12 lg:py-12"
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="eyebrow text-xs font-medium text-gold-soft">RayCtify</div>
              <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-parchment sm:text-5xl lg:text-6xl">
                Automated adversarial auditing for lending models.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base">
                Upload a scoring model, probe it with manual and batch scenarios, then compare results against a
                fairness-constrained reference. Everything runs in memory — no data persisted.
              </p>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-3 lg:max-w-xl lg:grid-cols-1">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 * index }}
                  className="rounded-3xl border border-line-subtle bg-black/20 px-4 py-4 shadow-panel backdrop-blur-sm"
                >
                  <div className="font-display text-2xl text-gold">{metric.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.28em] text-parchment-muted">{metric.label}</div>
                  <div className="mt-3 text-sm leading-6 text-parchment-muted">{metric.detail}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="thin-divider mt-8" />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-line-subtle bg-ink/80 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.26em] text-gold-soft">Model Auditor</div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                Upload a model, run manual and batch tests, and flag biased decisions.
              </p>
            </div>
            <div className="rounded-3xl border border-line-subtle bg-ink/80 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.26em] text-gold-soft">Reference Model</div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                Benchmark the same profile against a fairness-calibrated baseline.
              </p>
            </div>
            <div className="rounded-3xl border border-line-subtle bg-ink/80 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.26em] text-gold-soft">Arena</div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                Side-by-side comparison to reveal bias delta and sensitive-feature penalties.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </header>
  );
}

