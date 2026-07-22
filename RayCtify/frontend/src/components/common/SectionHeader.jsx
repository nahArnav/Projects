import { InfoTooltip } from "./InfoTooltip";

export function SectionHeader({
  eyebrow,
  title,
  description,
  howItWorks,
  onExport,
  exportDisabled,
  exportLabel = "Export PDF Report"
}) {
  return (
    <div className="rounded-[1.75rem] border border-line-subtle bg-ink/80 px-5 py-5 shadow-panel sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="eyebrow text-xs font-medium text-gold-soft">{eyebrow}</div>
          <h2 className="mt-3 font-display text-3xl text-parchment sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-parchment-muted sm:text-base">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <InfoTooltip
            content={
              <div className="space-y-2">
                {howItWorks.map((step) => (
                  <div key={step}>{step}</div>
                ))}
              </div>
            }
          />

          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="rounded-full border border-gold/50 bg-gold/10 px-5 py-3 text-sm font-semibold text-gold transition hover:bg-gold/15 disabled:cursor-not-allowed disabled:border-line-subtle disabled:text-parchment-muted"
          >
            {exportLabel}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {howItWorks.map((step, index) => (
          <div key={step} className="rounded-2xl border border-line-subtle bg-black/20 px-4 py-4">
            <div className="font-display text-2xl text-gold">0{index + 1}</div>
            <p className="mt-2 text-sm leading-6 text-parchment-muted">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

