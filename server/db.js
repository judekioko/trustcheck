import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.TRUSTCHECK_DB_PATH || path.join(dataDir, "trustcheck.db");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    subscription_status TEXT NOT NULL DEFAULT 'inactive',
    current_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    is_platform_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    token TEXT NOT NULL UNIQUE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    domain TEXT,
    email TEXT,
    phone TEXT,
    bank TEXT,
    account_number TEXT,
    mpesa_paybill TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    overall_risk TEXT NOT NULL,
    combined_score INTEGER NOT NULL,
    input_summary TEXT,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    phone TEXT NOT NULL,
    checkout_request_id TEXT UNIQUE,
    merchant_request_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    mpesa_receipt TEXT,
    result_desc TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
  CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);
  CREATE INDEX IF NOT EXISTS idx_checks_org ON checks(org_id);
  CREATE INDEX IF NOT EXISTS idx_checks_org_created ON checks(org_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
  CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
`);
