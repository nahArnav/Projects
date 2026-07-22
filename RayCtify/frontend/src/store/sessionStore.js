import { create } from "zustand";
import { cloneSchema, DEFAULT_AUDITOR_SCHEMA } from "../data/schemas";

export const useSessionStore = create((set) => ({
  uploadedModelFile: null,
  uploadedModelName: "",
  uploadedModelSchema: cloneSchema(DEFAULT_AUDITOR_SCHEMA),
  uploadedModelSummary: "No model loaded yet.",
  uploadedModelEngine: "pending",
  uploadedModelType: null,
  auditorHistory: [],
  referenceHistory: [],
  arenaHistory: [],
  arenaUserHistory: [],
  arenaReferenceHistory: [],
  setUploadedModel: ({ file, schema, summary, engine, modelType }) =>
    set({
      uploadedModelFile: file,
      uploadedModelName: file?.name ?? "",
      uploadedModelSchema: cloneSchema(schema?.length ? schema : DEFAULT_AUDITOR_SCHEMA),
      uploadedModelSummary: summary ?? "Schema extracted — session-only testing.",
      uploadedModelEngine: engine ?? "in-memory",
      uploadedModelType: modelType ?? null
    }),
  resetHistory: (key) =>
    set({
      [key]: []
    }),
  appendHistory: (key, entry) =>
    set((state) => ({
      [key]: [entry, ...(state[key] || [])]
    })),
  appendHistoryEntries: (key, entries) =>
    set((state) => ({
      [key]: [...(entries || []), ...(state[key] || [])]
    }))
}));
