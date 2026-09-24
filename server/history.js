import { db } from "./db.js";

function summarizeInput({ email, invoice, domain, payment }) {
  const parts = [];
  if (domain?.value) parts.push(`Domain: ${domain.value}`);
  if (email?.text) parts.push(`Email/message (${email.text.length} chars)`);
  if (invoice?.text) parts.push(`Invoice (${invoice.text.length} chars)`);
  if (payment?.supplierName) parts.push(`Payment to: ${payment.supplierName}`);
  return parts.join(" · ") || "Empty check";
}

export function recordCheck(userId, input, report) {
  const insert = db.prepare(`
    INSERT INTO checks (user_id, overall_risk, combined_score, input_summary, report_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = insert.run(
    userId,
    report.overallRisk,
    report.combinedScore,
    summarizeInput(input),
    JSON.stringify(report)
  );
  return Number(info.lastInsertRowid);
}

export function listChecks(userId, limit = 50) {
  const rows = db
    .prepare(
      "SELECT id, overall_risk, combined_score, input_summary, created_at FROM checks WHERE user_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(userId, limit);
  return rows.map((r) => ({
    id: r.id,
    overallRisk: r.overall_risk,
    combinedScore: r.combined_score,
    inputSummary: r.input_summary,
    createdAt: r.created_at,
  }));
}

export function getCheck(userId, id) {
  const row = db
    .prepare("SELECT * FROM checks WHERE user_id = ? AND id = ?")
    .get(userId, id);
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
