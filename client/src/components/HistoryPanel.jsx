import { useEffect, useState } from "react";
import { listChecks, getCheckDetail } from "../api";
import ReportCard from "./ReportCard";

export default function HistoryPanel() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    listChecks()
      .then(setChecks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function openCheck(id) {
    setError(null);
    try {
      const detail = await getCheckDetail(id);
      setSelected(detail.report);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="trustcheck-layout">
      <div className="trustcheck-form">
        <h3>Past checks</h3>
        {loading && <p>Loading...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && checks.length === 0 && <p className="hint">No checks run yet — run one from the "Run a check" tab.</p>}
        <div className="history-list">
          {checks.map((c) => (
            <button key={c.id} type="button" className="history-row" onClick={() => openCheck(c.id)}>
              <span className={`risk-dot risk-${c.overallRisk.toLowerCase()}`} />
              <span className="history-summary">{c.inputSummary}</span>
              <span className="history-meta">{new Date(c.createdAt).toLocaleString()} · {c.overallRisk}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="trustcheck-results">
        {selected ? (
          <ReportCard report={selected} />
        ) : (
          <div className="report-placeholder">
            <p>Select a past check on the left to view its full report.</p>
          </div>
        )}
      </div>
    </div>
  );
}
