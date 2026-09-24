const RISK_STYLES = {
  LOW: { label: "LOW", className: "risk-low" },
  MEDIUM: { label: "MEDIUM", className: "risk-medium" },
  HIGH: { label: "HIGH", className: "risk-high" },
};

const INDICATOR_LABELS = {
  identity: "Identity",
  document: "Document",
  domain: "Domain",
  payment: "Payment request",
};

export default function ReportCard({ report }) {
  if (!report) return null;

  const risk = RISK_STYLES[report.overallRisk] || RISK_STYLES.LOW;

  return (
    <div className="report-card">
      <div className="report-card-header">
        <h2>TRUST CHECK</h2>
        <span className={`risk-badge ${risk.className}`}>Risk: {risk.label}</span>
      </div>

      <div className="indicator-list">
        {Object.entries(INDICATOR_LABELS).map(([key, label]) => {
          const indicator = report.indicators[key];
          return (
            <div className="indicator-row" key={key}>
              <span className="indicator-label">{label}</span>
              <span className={`indicator-badge status-${indicator.status}`}>
                {indicator.emoji} {indicator.status !== "unknown" ? indicator.status : "n/a"}
              </span>
            </div>
          );
        })}
      </div>

      {report.reasons.length > 0 && (
        <div className="reasons">
          <h3>Reasons</h3>
          <ul>
            {report.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="report-meta">Checked at {new Date(report.ranAt).toLocaleString()}</p>
    </div>
  );
}
