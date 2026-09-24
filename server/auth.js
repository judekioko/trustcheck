import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = path.join(__dirname, "data", ".jwt-secret");

function loadOrCreateSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, "utf-8").trim();
  const secret = crypto.randomBytes(48).toString("hex");
  writeFileSync(SECRET_FILE, secret, "utf-8");
  return secret;
}

const JWT_SECRET = loadOrCreateSecret();
const TOKEN_TTL = "7d";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration({ name, orgName, email, password }) {
  const errors = [];
  if (!name || !name.trim()) errors.push("Your name is required");
  if (!orgName || !orgName.trim()) errors.push("Business/organization name is required");
  if (!email || !EMAIL_RE.test(email.trim())) errors.push("A valid email is required");
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters");
  return errors;
}

function isFirstUserEver() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  return row.n === 0;
}

export async function createOrganizationWithOwner({ name, orgName, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const grantAdmin = isFirstUserEver() ? 1 : 0;

  db.exec("BEGIN");
  try {
    const orgInsert = db
      .prepare("INSERT INTO organizations (name) VALUES (?)")
      .run(orgName.trim());
    const orgId = Number(orgInsert.lastInsertRowid);

    const userInsert = db
      .prepare(
        "INSERT INTO users (org_id, name, email, password_hash, role, is_platform_admin) VALUES (?, ?, ?, ?, 'owner', ?)"
      )
      .run(orgId, name.trim(), email.trim().toLowerCase(), passwordHash, grantAdmin);

    db.exec("COMMIT");
    return getUserById(Number(userInsert.lastInsertRowid));
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function getOrganization(orgId) {
  return db.prepare("SELECT * FROM organizations WHERE id = ?").get(orgId);
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, orgId: user.org_id, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function toPublicUser(user, org) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPlatformAdmin: !!user.is_platform_admin,
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      subscriptionStatus: org.subscription_status,
      currentPeriodEnd: org.current_period_end,
    },
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    const org = user ? getOrganization(user.org_id) : null;
    if (!user || !org) return res.status(401).json({ error: "Account no longer exists" });
    req.user = user;
    req.org = org;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireOwner(req, res, next) {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Only the account owner can do this" });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user.is_platform_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
