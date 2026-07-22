import { useEffect, useState } from "react";
import { DataTable } from "./DataTable";

function formatParameterLabel(key) {
  return String(key || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SessionLogTable({ title, rows }) {
  const [selectedLogId, setSelectedLogId] = useState(null);
  const normalizedRows = rows || [];
  const selectedLog = normalizedRows.find((row) => row.id === selectedLogId) || null;

  useEffect(() => {
    if (!normalizedRows.some((row) => row.id === selectedLogId)) {
      setSelectedLogId(null);
    }
  }, [normalizedRows, selectedLogId]);

  const columns = [
    {
      key: "caseId",
      header: "Test Case",
      render: (row) => <span className="font-medium text-parchment">{row.caseId || row.case_id || "manual"}</span>
    },
    {
      key: "timestamp",
      header: "Timestamp",
      render: (row) => row.timestamp
    },
    {
      key: "mode",
      header: "Mode",
      render: (row) => row.mode
    },
    {
      key: "decision",
      header: "Decision",
      render: (row) => <span className="text-parchment">{row.decision}</span>
    },
    {
      key: "summary",
      header: "Summary",
      render: (row) => row.summary
    },
    {
      key: "inputs",
      header: "Inputs",
      render: (row) =>
        row.parameters ? (
          <button
            type="button"
            onClick={() => setSelectedLogId((current) => (current === row.id ? null : row.id))}
            className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold transition hover:bg-gold/15"
          >
            {selectedLogId === row.id ? "Hide" : "View"}
          </button>
        ) : (
          <span className="text-xs uppercase tracking-[0.18em] text-parchment-muted">Unavailable</span>
        )
    },
    {
      key: "retention",
      header: "Retention",
      render: () => "Session memory only"
    }
  ];

  const filters = [
    {
      id: "mode",
      label: "Mode",
      options: [
        { label: "All modes", value: "all" },
        { label: "Manual", value: "Manual" },
        { label: "CSV Batch", value: "CSV Batch" }
      ],
      getValue: (row) => row.mode
    }
  ];

  return (
    <div className="space-y-4">
      <div className="max-h-[400px] overflow-y-auto overscroll-y-contain pr-1">
        <DataTable
          title={title}
          rows={normalizedRows}
          columns={columns}
          rowKey={(row) => row.id || `${row.caseId || row.case_id}-${row.timestamp}-${row.summary}`}
          searchPlaceholder="Search test case, summary, or audit mode"
          searchAccessor={(row) =>
            [row.caseId, row.case_id, row.timestamp, row.mode, row.decision, row.summary].filter(Boolean).join(" ")
          }
          filters={filters}
          emptyMessage="Audits will appear here. Data is discarded when the session ends."
        />
      </div>

      {selectedLog?.parameters ? (
        <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">Parameter Snapshot</div>
              <h3 className="mt-2 font-display text-2xl text-parchment">
                {selectedLog.caseId || selectedLog.case_id || "Selected Test Case"}
              </h3>
            </div>
            <div className="rounded-full border border-line-subtle px-3 py-2 text-xs uppercase tracking-[0.22em] text-parchment-muted">
              {selectedLog.mode}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(selectedLog.parameters).map(([key, value]) => (
              <div key={key} className="rounded-3xl border border-line-subtle bg-ink/70 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-parchment-muted">{formatParameterLabel(key)}</div>
                <div className="mt-2 text-sm font-semibold text-parchment">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
