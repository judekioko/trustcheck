import express from "express";
import cors from "cors";

import { checkDomain } from "./checks/domain.js";
import { checkEmail } from "./checks/email.js";
import { checkInvoice } from "./checks/invoice.js";
import { checkPayment } from "./checks/payment.js";
import { buildTrustReport } from "./checks/aggregate.js";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "./suppliers.js";
import { recordCheck, listChecks, getCheck } from "./history.js";
import {
  validateRegistration,
  createUser,
  getUserByEmail,
  verifyPassword,
  signToken,
  toPublicUser,
  requireAuth,
} from "./auth.js";

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "trustcheck-server" });
});

// --- Auth ---

app.post("/api/auth/register", async (req, res) => {
  const { businessName, email, password } = req.body || {};
  const errors = validateRegistration({ businessName, email, password });
  if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

  if (getUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const user = await createUser({ businessName, email, password });
  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

// --- Everything below requires a logged-in business account ---
app.use("/api/suppliers", requireAuth);
app.use("/api/check", requireAuth);
app.use("/api/trustcheck", requireAuth);
app.use("/api/checks", requireAuth);

app.get("/api/suppliers", (req, res) => {
  res.json(listSuppliers(req.user.id));
});

app.post("/api/suppliers", (req, res) => {
  res.status(201).json(createSupplier(req.user.id, req.body || {}));
});

app.put("/api/suppliers/:id", (req, res) => {
  const updated = updateSupplier(req.user.id, Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: "Supplier not found" });
  res.json(updated);
});

app.delete("/api/suppliers/:id", (req, res) => {
  const deleted = deleteSupplier(req.user.id, Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Supplier not found" });
  res.status(204).end();
});

app.post("/api/check/domain", async (req, res) => {
  const { domain } = req.body || {};
  if (!domain) return res.status(400).json({ error: "domain is required" });
  res.json(await checkDomain(domain));
});

app.post("/api/check/email", (req, res) => {
  const { text, claimedOrgDomain } = req.body || {};
  res.json(checkEmail(text, claimedOrgDomain));
});

app.post("/api/check/invoice", (req, res) => {
  const { text, supplierName } = req.body || {};
  res.json(checkInvoice(req.user.id, text, supplierName));
});

app.post("/api/check/payment", (req, res) => {
  res.json(checkPayment(req.user.id, req.body || {}));
});

// Combined TrustCheck: run whichever inputs were supplied, aggregate, and save to history.
app.post("/api/trustcheck", async (req, res) => {
  const { email, invoice, domain, payment } = req.body || {};

  const [emailResult, invoiceResult, domainResult, paymentResult] = await Promise.all([
    email?.text ? Promise.resolve(checkEmail(email.text, email.claimedOrgDomain)) : Promise.resolve(null),
    invoice?.text ? Promise.resolve(checkInvoice(req.user.id, invoice.text, invoice.supplierName)) : Promise.resolve(null),
    domain?.value ? checkDomain(domain.value) : Promise.resolve(null),
    payment?.supplierName ? Promise.resolve(checkPayment(req.user.id, payment)) : Promise.resolve(null),
  ]);

  const report = buildTrustReport({ emailResult, invoiceResult, domainResult, paymentResult });
  const checkId = recordCheck(req.user.id, { email, invoice, domain, payment }, report);

  res.json({
    checkId,
    report,
    details: { email: emailResult, invoice: invoiceResult, domain: domainResult, payment: paymentResult },
  });
});

app.get("/api/checks", (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  res.json(listChecks(req.user.id, limit));
});

app.get("/api/checks/:id", (req, res) => {
  const check = getCheck(req.user.id, Number(req.params.id));
  if (!check) return res.status(404).json({ error: "Check not found" });
  res.json(check);
});

app.listen(PORT, () => {
  console.log(`TrustCheck server listening on http://localhost:${PORT}`);
});
