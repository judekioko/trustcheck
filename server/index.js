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

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "trustcheck-server" });
});

app.get("/api/suppliers", async (_req, res) => {
  res.json(await listSuppliers());
});

app.post("/api/suppliers", async (req, res) => {
  const supplier = await createSupplier(req.body || {});
  res.status(201).json(supplier);
});

app.put("/api/suppliers/:id", async (req, res) => {
  const updated = await updateSupplier(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: "Supplier not found" });
  res.json(updated);
});

app.delete("/api/suppliers/:id", async (req, res) => {
  const deleted = await deleteSupplier(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Supplier not found" });
  res.status(204).end();
});

app.post("/api/check/domain", async (req, res) => {
  const { domain } = req.body || {};
  if (!domain) return res.status(400).json({ error: "domain is required" });
  res.json(await checkDomain(domain));
});

app.post("/api/check/email", async (req, res) => {
  const { text, claimedOrgDomain } = req.body || {};
  res.json(checkEmail(text, claimedOrgDomain));
});

app.post("/api/check/invoice", async (req, res) => {
  const { text, supplierName } = req.body || {};
  res.json(await checkInvoice(text, supplierName));
});

app.post("/api/check/payment", async (req, res) => {
  res.json(await checkPayment(req.body || {}));
});

// Combined TrustCheck: run whichever inputs were supplied and aggregate.
app.post("/api/trustcheck", async (req, res) => {
  const { email, invoice, domain, payment } = req.body || {};

  const [emailResult, invoiceResult, domainResult, paymentResult] = await Promise.all([
    email?.text ? Promise.resolve(checkEmail(email.text, email.claimedOrgDomain)) : Promise.resolve(null),
    invoice?.text ? checkInvoice(invoice.text, invoice.supplierName) : Promise.resolve(null),
    domain?.value ? checkDomain(domain.value) : Promise.resolve(null),
    payment?.supplierName ? checkPayment(payment) : Promise.resolve(null),
  ]);

  const report = buildTrustReport({ emailResult, invoiceResult, domainResult, paymentResult });

  res.json({
    report,
    details: { email: emailResult, invoice: invoiceResult, domain: domainResult, payment: paymentResult },
  });
});

app.listen(PORT, () => {
  console.log(`TrustCheck server listening on http://localhost:${PORT}`);
});
