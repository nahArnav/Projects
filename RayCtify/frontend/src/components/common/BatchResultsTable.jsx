import { DataTable } from "./DataTable";
import { formatPercent } from "../../utils/formatters";

export function BatchResultsTable({ title, rows, arena = false }) {
  const normalizedRows = rows || [];

  const getDecision = (row) => (arena ? row.user_result?.decision : row.decision) || "N/A";
  const getScore = (row) => (arena ? row.user_result?.score : row.score) || 0;
  const getBiasRisk = (row) => {
    if (arena) {
      return (row.bias_delta || 0) >= 10 ? "High Bias Risk" : "Low Bias Risk";
    }

    return (row.flagged_sensitive_features?.length || 0) > 0 ? "High Bias Risk" : "Low Bias Risk";
  };

  const columns = arena
    ? [
        {
          key: "case",
          header: "Applicant ID",
          render: (row) => <span className="font-medium text-parchment">{row.case_id || row.caseId || "manual"}</span>
        },
        {
          key: "userDecision",
          header: "Uploaded Model",
          render: (row) => <span className="text-parchment">{row.user_result?.decision || "N/A"}</span>
        },
        {
          key: "referenceDecision",
          header: "RayCtify Standard",
          render: (row) => <span className="text-parchment">{row.reference_result?.decision || "N/A"}</span>
        },
        {
          key: "biasDelta",
          header: "Bias Delta",
          render: (row) => <span className="font-medium text-gold">{Math.round(row.bias_delta ?? 0)}%</span>
        },
        {
          key: "risk",
          header: "Bias Risk",
          render: (row) => getBiasRisk(row)
        },
        {
          key: "notes",
          header: "Notes",
          render: (row) => row.delta_summary
        }
      ]
    : [
        {
          key: "case",
          header: "Applicant ID",
          render: (row) => <span className="font-medium text-parchment">{row.case_id || row.caseId || "manual"}</span>
        },
        {
          key: "decision",
          header: "Decision",
          render: (row) => <span className="text-parchment">{row.decision}</span>
        },
        {
          key: "score",
          header: "Score",
          render: (row) => formatPercent(row.score)
        },
        {
          key: "risk",
          header: "Bias Risk",
          render: (row) => getBiasRisk(row)
        },
        {
          key: "flags",
          header: "Sensitive Flags",
          render: (row) => `${row.flagged_sensitive_features?.length || 0} flags`
        },
        {
          key: "notes",
          header: "Notes",
          render: (row) => row.summary
        }
      ];

  const filters = [
    {
      id: "status",
      label: "Status",
      options: [
        { label: "All statuses", value: "all" },
        { label: "Accepted", value: "ACCEPTED" },
        { label: "Rejected", value: "REJECTED" }
      ],
      getValue: (row) => getDecision(row)
    },
    {
      id: "biasRisk",
      label: "Bias Risk",
      options: [
        { label: "All bias levels", value: "all" },
        { label: "High Bias Risk", value: "High Bias Risk" },
        { label: "Low Bias Risk", value: "Low Bias Risk" }
      ],
      getValue: (row) => getBiasRisk(row)
    }
  ];

  return (
    <DataTable
      title={title}
      rows={normalizedRows}
      columns={columns}
      rowKey={(row) => row.case_id || row.caseId || row.summary}
      searchPlaceholder="Search applicant or case ID"
      searchAccessor={(row) =>
        [row.case_id, row.caseId, row.summary, row.delta_summary, row.user_result?.decision, row.reference_result?.decision]
          .filter(Boolean)
          .join(" ")
      }
      filters={filters}
      emptyMessage="CSV batch results will appear here after secure, client-side parsing and in-memory evaluation."
    />
  );
}
