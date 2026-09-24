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
  createOrganizationWithOwner,
  getUserByEmail,
  getUserById,
  getOrganization,
  verifyPassword,
  signToken,
  toPublicUser,
  requireAuth,
  requireOwner,
  requireAdmin,
} from "./auth.js";
import {
  listMembers,
  listPendingInvites,
  createInvite,
  acceptInvite,
  removeMember,
  getInviteByToken,
} from "./team.js";
import {
  getUsage,
  hasQuotaRemaining,
  startProSubscription,
  getPaymentStatusForOrg,
  applyStkCallback,
  listPlans,
} from "./billing.js";
import { mpesa } from "./billing.js";
import { getOverview, listOrganizations } from "./admin.js";

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "trustcheck-server" });
});

// --- Auth ---

app.post("/api/auth/register", async (req, res) => {
  const { name, orgName, email, password } = req.body || {};
  const errors = validateRegistration({ name, orgName, email, password });
  if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

  if (getUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const user = await createOrganizationWithOwner({ name, orgName, email, password });
  const org = getOrganization(user.org_id);
  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user, org) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const org = getOrganization(user.org_id);
  const token = signToken(user);
  res.json({ token, user: toPublicUser(user, org) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user, req.org) });
});

app.get("/api/invites/:token", (req, res) => {
  const invite = getInviteByToken(req.params.token);
  if (!invite || invite.accepted_at) {
    return res.status(404).json({ error: "This invite link is invalid or has expired" });
  }
  const org = getOrganization(invite.org_id);
  res.json({ email: invite.email, role: invite.role, orgName: org.name });
});

app.post("/api/invites/:token/accept", async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Your name is required" });
  if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const userId = await acceptInvite({ token: req.params.token, name, password });
    const user = getUserById(userId);
    const org = getOrganization(user.org_id);
    const token = signToken(user);
    res.status(201).json({ token, user: toPublicUser(user, org) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- M-Pesa callback: Safaricom calls this directly, no auth header will be present ---
app.post("/api/billing/mpesa/callback", (req, res) => {
  const parsed = mpesa.parseStkCallback(req.body);
  if (parsed) applyStkCallback(parsed);
  // Safaricom expects a 200 acknowledging receipt regardless of outcome.
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// --- Everything below requires a logged-in account ---
app.use("/api/suppliers", requireAuth);
app.use("/api/check", requireAuth);
app.use("/api/trustcheck", requireAuth);
app.use("/api/checks", requireAuth);
app.use("/api/team", requireAuth);
app.use("/api/billing", requireAuth);
app.use("/api/admin", requireAuth, requireAdmin);

app.get("/api/suppliers", (req, res) => {
  res.json(listSuppliers(req.org.id));
});

app.post("/api/suppliers", (req, res) => {
  res.status(201).json(createSupplier(req.org.id, req.body || {}));
});

app.put("/api/suppliers/:id", (req, res) => {
  const updated = updateSupplier(req.org.id, Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: "Supplier not found" });
  res.json(updated);
});

app.delete("/api/suppliers/:id", (req, res) => {
  const deleted = deleteSupplier(req.org.id, Number(req.params.id));
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
  res.json(checkInvoice(req.org.id, text, supplierName));
});

app.post("/api/check/payment", (req, res) => {
  res.json(checkPayment(req.org.id, req.body || {}));
});

// Combined TrustCheck: enforce plan quota, run whichever inputs were supplied,
// aggregate, and save to org history.
app.post("/api/trustcheck", async (req, res) => {
  if (!hasQuotaRemaining(req.org)) {
    return res.status(402).json({
      error: "You've used all of your monthly TrustChecks on the Free plan. Upgrade to Pro for unlimited checks.",
      code: "QUOTA_EXCEEDED",
    });
  }

  const { email, invoice, domain, payment } = req.body || {};

  const [emailResult, invoiceResult, domainResult, paymentResult] = await Promise.all([
    email?.text ? Promise.resolve(checkEmail(email.text, email.claimedOrgDomain)) : Promise.resolve(null),
    invoice?.text ? Promise.resolve(checkInvoice(req.org.id, invoice.text, invoice.supplierName)) : Promise.resolve(null),
    domain?.value ? checkDomain(domain.value) : Promise.resolve(null),
    payment?.supplierName ? Promise.resolve(checkPayment(req.org.id, payment)) : Promise.resolve(null),
  ]);

  const report = buildTrustReport({ emailResult, invoiceResult, domainResult, paymentResult });
  const checkId = recordCheck(req.org.id, req.user.id, { email, invoice, domain, payment }, report);

  res.json({
    checkId,
    report,
    details: { email: emailResult, invoice: invoiceResult, domain: domainResult, payment: paymentResult },
  });
});

app.get("/api/checks", (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  res.json(listChecks(req.org.id, limit));
});

app.get("/api/checks/:id", (req, res) => {
  const check = getCheck(req.org.id, Number(req.params.id));
  if (!check) return res.status(404).json({ error: "Check not found" });
  res.json(check);
});

// --- Team management ---

app.get("/api/team/members", (req, res) => {
  res.json({ members: listMembers(req.org.id), pendingInvites: listPendingInvites(req.org.id) });
});

app.post("/api/team/invite", requireOwner, (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
  try {
    const invite = createInvite(req.org, req.user, { email, role });
    res.status(201).json({ inviteToken: invite.token, email: invite.email, role: invite.role });
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

app.delete("/api/team/members/:id", requireOwner, (req, res) => {
  try {
    const removed = removeMember(req.org, req.user, Number(req.params.id));
    if (!removed) return res.status(404).json({ error: "Member not found" });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message, code: err.code });
  }
});

// --- Billing ---

app.get("/api/billing/plans", (_req, res) => {
  res.json(listPlans());
});

app.get("/api/billing/usage", (req, res) => {
  res.json(getUsage(req.org));
});

app.get("/api/billing/mpesa-status", (req, res) => {
  res.json(mpesa.configStatus());
});

app.post("/api/billing/subscribe", requireOwner, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !phone.trim()) return res.status(400).json({ error: "M-Pesa phone number is required" });
  try {
    const result = await startProSubscription({ org: req.org, user: req.user, phone: phone.trim() });
    res.status(202).json(result);
  } catch (err) {
    res.status(err.code === "MPESA_NOT_CONFIGURED" ? 503 : 502).json({ error: err.message, code: err.code });
  }
});

app.get("/api/billing/status/:checkoutRequestId", (req, res) => {
  const status = getPaymentStatusForOrg(req.org, req.params.checkoutRequestId);
  if (!status) return res.status(404).json({ error: "Payment not found" });
  res.json(status);
});

// --- Platform admin ---

app.get("/api/admin/overview", (_req, res) => {
  res.json(getOverview());
});

app.get("/api/admin/organizations", (_req, res) => {
  res.json(listOrganizations());
});

app.listen(PORT, () => {
  console.log(`TrustCheck server listening on http://localhost:${PORT}`);
});
