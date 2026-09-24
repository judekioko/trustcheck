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

export function validateRegistration({ businessName, email, password }) {
  const errors = [];
  if (!businessName || !businessName.trim()) errors.push("Business name is required");
  if (!email || !EMAIL_RE.test(email.trim())) errors.push("A valid email is required");
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters");
  return errors;
}

export async function createUser({ businessName, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const insert = db.prepare(
    "INSERT INTO users (business_name, email, password_hash) VALUES (?, ?, ?)"
  );
  const info = insert.run(businessName.trim(), email.trim().toLowerCase(), passwordHash);
  return getUserById(Number(info.lastInsertRowid));
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function toPublicUser(user) {
  return { id: user.id, businessName: user.business_name, email: user.email };
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
    if (!user) return res.status(401).json({ error: "User no longer exists" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
