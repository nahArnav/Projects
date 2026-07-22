const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function handleResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "The secure audit service could not complete the request.");
  }

  return payload;
}

function buildMultipartPayload(file, records) {
  const formData = new FormData();
  formData.append("model_file", file);
  formData.append("payload_json", JSON.stringify({ records }));
  return formData;
}

export async function introspectModel(file) {
  const formData = new FormData();
  formData.append("model_file", file);

  const response = await fetch(`${API_BASE}/auditor/introspect`, {
    method: "POST",
    body: formData
  });

  return handleResponse(response);
}

export async function evaluateUserModel(file, records) {
  const response = await fetch(`${API_BASE}/auditor/evaluate`, {
    method: "POST",
    body: buildMultipartPayload(file, records)
  });

  return handleResponse(response);
}

export async function getReferenceSchema() {
  const response = await fetch(`${API_BASE}/reference/schema`);
  return handleResponse(response);
}

export async function evaluateReferenceModel(records) {
  const response = await fetch(`${API_BASE}/reference/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records })
  });

  return handleResponse(response);
}

export async function runArenaComparison(file, records) {
  const response = await fetch(`${API_BASE}/arena/compare`, {
    method: "POST",
    body: buildMultipartPayload(file, records)
  });

  return handleResponse(response);
}
