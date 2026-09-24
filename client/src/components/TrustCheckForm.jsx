import { useState } from "react";
import { runTrustCheck } from "../api";
import ReportCard from "./ReportCard";

const EMPTY_FORM = {
  domainValue: "",
  emailText: "",
  emailClaimedDomain: "",
  invoiceText: "",
  invoiceSupplierName: "",
  paymentSupplierName: "",
  paymentAccountNumber: "",
  paymentPaybill: "",
  paymentBank: "",
  paymentPhone: "",
};

export default function TrustCheckForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function hasAnyInput() {
    return (
      form.domainValue.trim() ||
      form.emailText.trim() ||
      form.invoiceText.trim() ||
      form.paymentSupplierName.trim()
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!hasAnyInput()) {
      setError("Fill in at least one section below before running a TrustCheck.");
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const payload = {};
      if (form.domainValue.trim()) {
        payload.domain = { value: form.domainValue.trim() };
      }
      if (form.emailText.trim()) {
        payload.email = {
          text: form.emailText,
          claimedOrgDomain: form.emailClaimedDomain.trim() || undefined,
        };
      }
      if (form.invoiceText.trim()) {
        payload.invoice = {
          text: form.invoiceText,
          supplierName: form.invoiceSupplierName.trim() || undefined,
        };
      }
      if (form.paymentSupplierName.trim()) {
        payload.payment = {
          supplierName: form.paymentSupplierName.trim(),
          accountNumber: form.paymentAccountNumber.trim() || undefined,
          mpesaPaybill: form.paymentPaybill.trim() || undefined,
          bank: form.paymentBank.trim() || undefined,
          phone: form.paymentPhone.trim() || undefined,
        };
      }
      const result = await runTrustCheck(payload);
      setReport(result.report);
    } catch (err) {
      setError(err.message || "Something went wrong running the check.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setReport(null);
    setError(null);
  }

  return (
    <div className="trustcheck-layout">
      <form className="trustcheck-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <h3>🌐 Domain / website</h3>
          <p className="hint">Check a domain for typosquatting, lookalike brand names, and DNS red flags.</p>
          <input
            type="text"
            placeholder="e.g. kcb-secure-alerts.xyz"
            value={form.domainValue}
            onChange={update("domainValue")}
          />
        </section>

        <section className="form-section">
          <h3>✉️ Email / WhatsApp message</h3>
          <p className="hint">Paste the full message, including the sender line if you have it.</p>
          <textarea
            rows={5}
            placeholder="Paste the email or message text here..."
            value={form.emailText}
            onChange={update("emailText")}
          />
          <input
            type="text"
            placeholder="Claimed sender organization domain (optional), e.g. kcbgroup.com"
            value={form.emailClaimedDomain}
            onChange={update("emailClaimedDomain")}
          />
        </section>

        <section className="form-section">
          <h3>📄 Invoice / document</h3>
          <p className="hint">Paste the invoice text. We'll try to match it to a known supplier automatically.</p>
          <textarea
            rows={5}
            placeholder="Paste invoice or document text here..."
            value={form.invoiceText}
            onChange={update("invoiceText")}
          />
          <input
            type="text"
            placeholder="Supplier name (optional, helps matching)"
            value={form.invoiceSupplierName}
            onChange={update("invoiceSupplierName")}
          />
        </section>

        <section className="form-section">
          <h3>💳 Payment request</h3>
          <p className="hint">Compare a requested payment destination against your known-supplier records.</p>
          <input
            type="text"
            placeholder="Supplier / recipient name"
            value={form.paymentSupplierName}
            onChange={update("paymentSupplierName")}
          />
          <div className="grid-2">
            <input
              type="text"
              placeholder="Requested account number"
              value={form.paymentAccountNumber}
              onChange={update("paymentAccountNumber")}
            />
            <input
              type="text"
              placeholder="Requested M-Pesa paybill"
              value={form.paymentPaybill}
              onChange={update("paymentPaybill")}
            />
            <input
              type="text"
              placeholder="Requested bank"
              value={form.paymentBank}
              onChange={update("paymentBank")}
            />
            <input
              type="text"
              placeholder="Requested phone number"
              value={form.paymentPhone}
              onChange={update("paymentPhone")}
            />
          </div>
        </section>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Running TrustCheck..." : "Run TrustCheck"}
          </button>
          <button type="button" className="secondary" onClick={handleReset} disabled={loading}>
            Clear
          </button>
        </div>
      </form>

      <div className="trustcheck-results">
        {report ? (
          <ReportCard report={report} />
        ) : (
          <div className="report-placeholder">
            <p>Fill in one or more sections and run a TrustCheck to see the report here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
