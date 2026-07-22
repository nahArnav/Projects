import { motion } from "framer-motion";
import { formatMetric } from "../../utils/formatters";

const listVariant = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 }
  }
};

const itemVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

function getOptionValue(option) {
  return typeof option === "object" ? option.value : option;
}

function getOptionLabel(option) {
  return typeof option === "object" ? option.label : option;
}

function isEncodedSensitiveField(field) {
  return field.type === "select" && field.sensitive && (field.encodedCategory || field.valueType === "number");
}

function getSelectedOptionLabel(field, value) {
  const selectedOption = field.options?.find((option) => String(getOptionValue(option)) === String(value));
  return selectedOption ? getOptionLabel(selectedOption) : `Category ${value ?? field.defaultValue ?? 0}`;
}

export function DynamicParameterForm({ schema, values, onChange, title, note }) {
  return (
    <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.26em] text-gold-soft">Manual Test Surface</div>
          <h3 className="mt-2 font-display text-2xl text-parchment">{title}</h3>
        </div>
        <p className="max-w-xl text-sm leading-6 text-parchment-muted">{note}</p>
      </div>

      <motion.div
        variants={listVariant}
        initial="hidden"
        animate="visible"
        className="mt-6 grid gap-4 lg:grid-cols-2"
      >
        {schema.map((field) => (
          <motion.div
            key={field.key}
            variants={itemVariant}
            className="rounded-3xl border border-line-subtle bg-ink/80 px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-parchment">{field.label}</div>
                <p className="mt-2 text-xs leading-5 text-parchment-muted">{field.description}</p>
              </div>

              {field.sensitive ? (
                <div className="rounded-full border border-rust/40 bg-rust/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-rust">
                  {isEncodedSensitiveField(field) ? "Encoded" : "Sensitive"}
                </div>
              ) : (
                <div className="rounded-full border border-line-subtle px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-parchment-muted">
                  Financial
                </div>
              )}
            </div>

            {field.type === "select" ? (
              <>
                <select
                  value={String(values[field.key] ?? field.defaultValue ?? "")}
                  onChange={(event) =>
                    onChange(
                      field.key,
                      field.valueType === "number" ? Number(event.target.value) : event.target.value
                    )
                  }
                  className="mt-4 w-full rounded-2xl border border-line-subtle bg-black/30 px-4 py-3 text-sm text-parchment outline-none transition focus:border-gold/50"
                >
                  {field.options?.map((option) => (
                    <option key={String(getOptionValue(option))} value={String(getOptionValue(option))}>
                      {getOptionLabel(option)}
                    </option>
                  ))}
                </select>
                {isEncodedSensitiveField(field) ? (
                  <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-gold-soft">Testing Note</div>
                    <p className="mt-2 text-xs leading-5 text-parchment-muted">
                      Selected {getSelectedOptionLabel(field, values[field.key] ?? field.defaultValue)}. This model only
                      exposes an encoded category here, so RayCtify keeps the labels neutral instead of guessing
                      real-world demographic names.
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-parchment-muted">Current value</span>
                  <span className="font-display text-xl text-gold">
                    {formatMetric(values[field.key] ?? 0, field.suffix || "")}
                  </span>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.key] ?? field.defaultValue ?? 0}
                  onChange={(event) => onChange(field.key, Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-parchment-muted/20 accent-gold"
                />
                <div className="mt-2 flex justify-between text-xs text-parchment-muted">
                  <span>{formatMetric(field.min ?? 0, field.suffix || "")}</span>
                  <span>{formatMetric(field.max ?? 0, field.suffix || "")}</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
