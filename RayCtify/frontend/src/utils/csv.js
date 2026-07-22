import Papa from "papaparse";

function coerceValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? trimmed : numeric;
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors?.length) {
          reject(new Error(errors[0].message));
          return;
        }

        const normalized = data.map((row) =>
          Object.entries(row).reduce((accumulator, [key, value]) => {
            accumulator[key.trim()] = coerceValue(value);
            return accumulator;
          }, {})
        );

        resolve(normalized);
      },
      error: (error) => reject(error)
    });
  });
}

export function mergeRecordsWithSchema(records, schema, baselineValues) {
  return records.map((record, index) =>
    schema.reduce(
      (accumulator, field) => {
        const rawValue = record[field.key];
        if (rawValue === undefined || rawValue === "") {
          accumulator[field.key] = baselineValues[field.key];
        } else if (field.type === "number") {
          accumulator[field.key] = Number(rawValue);
        } else {
          accumulator[field.key] = rawValue;
        }

        return accumulator;
      },
      { case_id: record.case_id || `batch-${index + 1}` }
    )
  );
}

