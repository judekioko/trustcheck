import { db } from "./db.js";

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    domain: row.domain || "",
    email: row.email || "",
    phone: row.phone || "",
    bank: row.bank || "",
    accountNumber: row.account_number || "",
    mpesaPaybill: row.mpesa_paybill || "",
    notes: row.notes || "",
  };
}

export function listSuppliers(orgId) {
  const rows = db
    .prepare("SELECT * FROM suppliers WHERE org_id = ? ORDER BY name ASC")
    .all(orgId);
  return rows.map(normalize);
}

export function getSupplier(orgId, id) {
  const row = db
    .prepare("SELECT * FROM suppliers WHERE org_id = ? AND id = ?")
    .get(orgId, id);
  return normalize(row);
}

export function findSupplierByNameOrDomain(orgId, query) {
  if (!query) return null;
  const rows = db.prepare("SELECT * FROM suppliers WHERE org_id = ?").all(orgId);
  const q = query.trim().toLowerCase();
  const match = rows.find(
    (s) =>
      s.name.toLowerCase() === q ||
      (s.domain && s.domain.toLowerCase() === q) ||
      s.name.toLowerCase().includes(q) ||
      q.includes(s.name.toLowerCase())
  );
  return normalize(match);
}

export function createSupplier(orgId, data) {
  const insert = db.prepare(`
    INSERT INTO suppliers (org_id, name, domain, email, phone, bank, account_number, mpesa_paybill, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(
    orgId,
    (data.name || "Unnamed supplier").trim(),
    (data.domain || "").trim().toLowerCase(),
    (data.email || "").trim().toLowerCase(),
    (data.phone || "").trim(),
    (data.bank || "").trim(),
    (data.accountNumber || "").trim(),
    (data.mpesaPaybill || "").trim(),
    (data.notes || "").trim()
  );
  return getSupplier(orgId, Number(info.lastInsertRowid));
}

export function updateSupplier(orgId, id, data) {
  const existing = getSupplier(orgId, id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  db.prepare(`
    UPDATE suppliers
    SET name = ?, domain = ?, email = ?, phone = ?, bank = ?, account_number = ?, mpesa_paybill = ?, notes = ?
    WHERE org_id = ? AND id = ?
  `).run(
    merged.name.trim(),
    (merged.domain || "").trim().toLowerCase(),
    (merged.email || "").trim().toLowerCase(),
    (merged.phone || "").trim(),
    (merged.bank || "").trim(),
    (merged.accountNumber || "").trim(),
    (merged.mpesaPaybill || "").trim(),
    (merged.notes || "").trim(),
    orgId,
    id
  );
  return getSupplier(orgId, id);
}

export function deleteSupplier(orgId, id) {
  const info = db.prepare("DELETE FROM suppliers WHERE org_id = ? AND id = ?").run(orgId, id);
  return info.changes > 0;
}
