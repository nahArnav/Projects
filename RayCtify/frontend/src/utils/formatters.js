export function formatMetric(value, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000 && suffix !== "%") {
    return `${Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value)}${suffix}`;
  }

  return `${Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value)}${suffix}`;
}

export function formatPercent(value) {
  if (typeof value !== "number") {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

export function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

