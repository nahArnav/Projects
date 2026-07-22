export function InfoTooltip({ label = "How it works", content }) {
  return (
    <div className="group relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-full border border-line-subtle px-3 text-xs font-medium text-parchment-muted transition hover:border-gold/40 hover:text-parchment focus:border-gold/40 focus:outline-none"
      >
        {label}
      </button>

      <div className="pointer-events-none absolute right-0 top-10 z-20 hidden w-72 rounded-2xl border border-line-subtle bg-ink-elevated/95 p-4 text-sm leading-6 text-parchment-muted shadow-luxe backdrop-blur-md group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
}

