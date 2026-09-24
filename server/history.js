import { db } from "./db.js";

function summarizeInput({ email, invoice, domain, payment }) {
  const parts = [];
  if (domain?.value) parts.push(`Domain: ${domain.value}`);
  if (email?.text) parts.push(`Email/message (${email.text.length} chars)`);
  if (invoice?.text) parts.push(`Invoice (${invoice.text.length} chars)`);
  if (payment?.supplierName) parts.push(`Payment to: ${payment.supplierName}`);
  return parts.join(" · ") || "Empty check";
}

export function recordCheck(orgId, userId, input, report) {
  const insert = db.prepare(`
    INSERT INTO checks (org_id, created_by, overall_risk, combined_score, input_summary, report_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(
    orgId,
    userId,
    report.overallRisk,
    report.combinedScore,
    summarizeInput(input),
    JSON.stringify(report)
  );
  return Number(info.lastInsertRowid);
}

export function listChecks(orgId, limit = 50) {
  const rows = db
    .prepare(
      `SELECT checks.id, checks.overall_risk, checks.combined_score, checks.input_summary,
              checks.created_at, users.name AS created_by_name
       FROM checks
       LEFT JOIN users ON users.id = checks.created_by
       WHERE checks.org_id = ?
       ORDER BY checks.id DESC
       LIMIT ?`
    )
    .all(orgId, limit);
  return rows.map((r) => ({
    id: r.id,
    overallRisk: r.overall_risk,
    combinedScore: r.combined_score,
    inputSummary: r.input_summary,
    createdAt: r.created_at,
    createdByName: r.created_by_name || null,
  }));
}

export function getCheck(orgId, id) {
  const row = db
    .prepare("SELECT * FROM checks WHERE org_id = ? AND id = ?")
    .get(orgId, id);
  if (!row) return null;
  return {
    id: row.id,
    overallRisk: row.overall_risk,
    combinedScore: row.combined_score,
    inputSummary: row.input_summary,
    createdAt: row.created_at,
    report: JSON.parse(row.report_json),
  };
}

export function countChecksThisMonth(orgId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM checks
       WHERE org_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    )
    .get(orgId);
  return row.n;
}
