import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const fade = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: "easeOut", delay: i * 0.08 }
  })
};

const sections = [
  {
    to: "/auditor",
    number: "01",
    label: "The Model Auditor",
    tagline: "Probe & Stress-Test",
    brief:
      "Upload a lending model, adjust applicant parameters, and watch how decisions shift across demographic and financial axes.",
    accent: "border-gold/40 hover:border-gold/60"
  },
  {
    to: "/reference",
    number: "02",
    label: "Reference Model",
    tagline: "Fair Benchmark",
    brief:
      "Run the same applicant through RayCtify's fairness-calibrated baseline — a model that ignores demographic fields entirely.",
    accent: "border-gold/35 hover:border-gold/55"
  },
  {
    to: "/arena",
    number: "03",
    label: "The Arena",
    tagline: "Head-to-Head",
    brief:
      "Compare your uploaded model with the fair reference model side by side using identical inputs to expose bias delta.",
    accent: "border-gold/30 hover:border-gold/50"
  },
  {
    to: "/interceptor",
    number: "04",
    label: "The Interceptor",
    tagline: "Post-Processing Fix",
    brief:
      "Apply equalized-odds healing to a production model's output layer without retraining, then export the healed artifact.",
    accent: "border-gold/25 hover:border-gold/45"
  },
  {
    to: "/vaccine",
    number: "05",
    label: "Vaccine Generator",
    tagline: "Pre-Training Cure",
    brief:
      "Upload a training CSV, calculate the mathematically precise healing dose, inject counterfactual twins, and export a cleaner dataset.",
    accent: "border-gold/20 hover:border-gold/40"
  }
];

const pillars = [
  {
    value: "Zero",
    label: "Data Retention",
    detail: "Models and datasets live in session memory only — nothing is stored."
  },
  {
    value: "Five",
    label: "Connected Workflows",
    detail: "All sections share one session, so context follows you across every tool."
  },
  {
    value: "Client",
    label: "Side Exports",
    detail: "Healed models and vaccine datasets download straight to your device."
  }
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
      {/* ── Hero ── */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fade}
        className="section-anchor w-full luxe-panel rounded-[2rem] p-5 sm:p-8 lg:p-10"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="eyebrow text-xs font-medium text-gold-soft">
              Institutional Adversarial Auditing
            </div>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] text-parchment sm:text-5xl lg:text-[3.5rem]">
              Expose, measure, and <br className="hidden sm:block" />
              <span className="text-gold [text-shadow:0_0_28px_rgba(197,160,89,0.22)]">
                heal lending bias.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base sm:leading-8">
              RayCtify gives institutions five connected workspaces to audit a
              scoring model, benchmark it against a fair reference, fix output
              bias in production, and prepare cleaner training data — all
              in-session, with zero data retention.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/auditor")}
            className="shrink-0 rounded-[1.5rem] border border-gold/50 bg-gold/10 px-8 py-5 text-left transition hover:bg-gold/15 hover:shadow-[0_0_40px_rgba(212,175,55,0.18)] sm:min-w-[260px]"
          >
            <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">
              Get Started
            </div>
            <div className="mt-2 font-display text-2xl text-parchment">
              Open the Auditor
            </div>
            <p className="mt-2 text-sm leading-6 text-parchment-muted">
              Upload a model and begin testing.
            </p>
          </motion.button>
        </div>

        <div className="thin-divider mt-8" />

        {/* ── Pillars ── */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.label}
              custom={i + 1}
              initial="hidden"
              animate="visible"
              variants={fade}
              className="rounded-[1.75rem] border border-line-subtle bg-black/20 px-5 py-5 shadow-panel"
            >
              <div className="font-display text-2xl text-gold">{p.value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.26em] text-parchment-muted">
                {p.label}
              </div>
              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                {p.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Section Navigator ── */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fade}
        custom={2}
        className="section-anchor w-full luxe-panel rounded-[2rem] p-5 sm:p-8 lg:p-10"
      >
        <div className="rounded-[1.75rem] border border-line-subtle bg-ink/80 px-5 py-5 shadow-panel sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="eyebrow text-xs font-medium text-gold-soft">
                Platform Workflow
              </div>
              <h2 className="mt-3 font-display text-3xl text-parchment sm:text-4xl">
                Five connected sections
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base">
                Each section handles one stage of the bias lifecycle. Work
                through them in order or jump directly to the tool you need.
              </p>
            </div>
            <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
              Session-linked
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {sections.map((s, i) => (
            <motion.button
              key={s.to}
              custom={i + 3}
              initial="hidden"
              animate="visible"
              variants={fade}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              onClick={() => navigate(s.to)}
              className={`group flex flex-col rounded-[1.75rem] border bg-[linear-gradient(180deg,rgba(197,160,89,0.06),rgba(10,10,12,0.92))] px-6 py-6 text-left shadow-panel transition-all hover:bg-[linear-gradient(180deg,rgba(197,160,89,0.12),rgba(10,10,12,0.88))] hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${s.accent}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-gold/80 transition group-hover:text-gold">
                  {s.number}
                </span>
                <span className="rounded-full border border-line-subtle px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-parchment-muted transition group-hover:border-gold/30 group-hover:text-gold-soft">
                  {s.tagline}
                </span>
              </div>

              <h3 className="mt-4 font-display text-[1.65rem] leading-tight text-parchment transition group-hover:text-gold [text-shadow:0_0_0_transparent] group-hover:[text-shadow:0_0_18px_rgba(197,160,89,0.16)]">
                {s.label}
              </h3>

              <p className="mt-3 text-sm leading-6 text-parchment-muted">
                {s.brief}
              </p>

              <div className="mt-auto pt-5">
                <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-gold-soft transition group-hover:text-gold">
                  Open section
                  <svg
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* ── How It Works (concise) ── */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fade}
        custom={4}
        className="section-anchor w-full luxe-panel rounded-[2rem] p-5 sm:p-8 lg:p-10"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow text-xs font-medium text-gold-soft">
              Audit Lifecycle
            </div>
            <h2 className="mt-3 font-display text-3xl text-parchment sm:text-4xl">
              From detection to deployment
            </h2>
            <p className="mt-3 text-sm leading-7 text-parchment-muted sm:text-base">
              RayCtify covers both sides of the bias problem — fixing models
              already in production and cleaning training data before the next
              run.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">
              Zero-Retention
            </div>
            <div className="rounded-full border border-line-subtle px-4 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
              Client-Side Exports
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-gold/25 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),rgba(17,17,21,0.95)_60%)] p-6 shadow-panel">
            <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">
              Post-Processing Path
            </div>
            <div className="mt-3 font-display text-2xl text-parchment">
              Audit → Compare → Heal Model
            </div>
            <p className="mt-3 text-sm leading-7 text-parchment-muted">
              Use the Auditor, Reference, Arena, and Interceptor to detect
              unfair output pressure and export a healed model without
              retraining.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-gold/25 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),rgba(17,17,21,0.95)_60%)] p-6 shadow-panel">
            <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">
              Pre-Training Path
            </div>
            <div className="mt-3 font-display text-2xl text-parchment">
              Upload CSV → Calculate Dose → Export Data
            </div>
            <p className="mt-3 text-sm leading-7 text-parchment-muted">
              Use the Vaccine Generator to inject counterfactual twins into
              historical training data and export a balanced dataset.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
