import { useEffect, useState } from "react";
import { getAdminOverview, getAdminOrganizations } from "../api";

const STAT_LABELS = [
  ["totalOrgs", "Businesses"],
  ["totalUsers", "Users"],
  ["activeSubscriptions", "Active Pro subs"],
  ["checksThisMonth", "Checks this month"],
  ["totalChecks", "Checks all-time"],
  ["highRiskChecks", "High-risk flags"],
  ["revenueKES", "Revenue (KES)"],
];

export default function AdminPanel() {
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getAdminOverview(), getAdminOrganizations()])
      .then(([o, list]) => {
        setOverview(o);
        setOrgs(list);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!overview) return <p className="hint">Loading admin overview...</p>;

  return (
    <div>
      <div className="stat-grid">
        {STAT_LABELS.map(([key, label]) => (
          <div className="stat-card" key={key}>
            <div className="stat-value">{overview[key]}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="trustcheck-form" style={{ marginTop: 24 }}>
        <h3>Organizations</h3>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Name</span>
            <span>Plan</span>
            <span>Status</span>
            <span>Members</span>
            <span>Checks</span>
            <span>Joined</span>
          </div>
          {orgs.map((o) => (
            <div className="admin-table-row" key={o.id}>
              <span>{o.name}</span>
              <span>{o.plan}</span>
              <span>{o.subscriptionStatus}</span>
              <span>{o.memberCount}</span>
              <span>{o.checkCount}</span>
              <span>{new Date(o.createdAt.replace(" ", "T")).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
