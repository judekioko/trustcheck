import { useEffect, useState, useRef } from "react";
import { getUsage, getPlans, getMpesaStatus, subscribeToPro, getPaymentStatus } from "../api";
import { useAuth } from "../AuthContext";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

export default function BillingPanel() {
  const { user, refresh } = useAuth();
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [phone, setPhone] = useState("");
  const [payState, setPayState] = useState("idle"); // idle | pending | success | failed
  const [error, setError] = useState(null);
  const pollTimer = useRef(null);
  const pollDeadline = useRef(0);

  async function loadAll() {
    const [u, p, m] = await Promise.all([getUsage(), getPlans(), getMpesaStatus()]);
    setUsage(u);
    setPlans(p);
    setMpesaStatus(m);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
    return () => clearTimeout(pollTimer.current);
  }, []);

  function pollPayment(checkoutRequestId) {
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    const tick = async () => {
      try {
        const status = await getPaymentStatus(checkoutRequestId);
        if (status.status === "success") {
          setPayState("success");
          await loadAll();
          await refresh();
          return;
        }
        if (status.status === "failed") {
          setPayState("failed");
          setError(status.resultDesc || "Payment was not completed");
          return;
        }
      } catch {
        // keep polling until the timeout
      }
      if (Date.now() < pollDeadline.current) {
        pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      } else {
        setPayState("failed");
        setError("Timed out waiting for the M-Pesa confirmation. Check your phone, or try again.");
      }
    };
    pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
  }

  async function handleSubscribe(e) {
    e.preventDefault();
    setError(null);
    setPayState("pending");
    try {
      const { checkoutRequestId } = await subscribeToPro(phone);
      pollPayment(checkoutRequestId);
    } catch (err) {
      setPayState("failed");
      setError(err.message);
    }
  }

  if (!usage) return <p className="hint">Loading billing...</p>;

  const pro = plans.find((p) => p.key === "pro");
  const isPro = usage.plan === "pro" && usage.subscriptionStatus === "active";

  return (
    <div className="trustcheck-layout">
      <div className="trustcheck-form">
        <h3>Your plan</h3>
        <div className="plan-card">
          <div className="plan-card-header">
            <strong>{usage.planName}</strong>
            {isPro && <span className="risk-badge risk-low">Active</span>}
          </div>
          <p className="hint">
            {usage.monthlyCheckLimit
              ? `${usage.checksUsedThisMonth} / ${usage.monthlyCheckLimit} TrustChecks used this month`
              : `${usage.checksUsedThisMonth} TrustChecks run this month (unlimited)`}
          </p>
          {usage.monthlyCheckLimit && (
            <div className="usage-bar">
              <div
                className="usage-bar-fill"
                style={{ width: `${Math.min(100, (usage.checksUsedThisMonth / usage.monthlyCheckLimit) * 100)}%` }}
              />
            </div>
          )}
          {isPro && usage.currentPeriodEnd && (
            <p className="hint">Renews around {new Date(usage.currentPeriodEnd.replace(" ", "T")).toLocaleDateString()}</p>
          )}
        </div>

        {!isPro && pro && (
          <>
            <h3>Upgrade to {pro.name}</h3>
            <p className="hint">
              KES {pro.priceKES}/month · unlimited TrustChecks · up to {pro.maxTeamMembers} team members.
            </p>

            {user.role !== "owner" ? (
              <p className="hint">Only the account owner can manage billing. Ask them to upgrade.</p>
            ) : (
              <>
                {mpesaStatus && !mpesaStatus.configured && (
                  <p className="form-error">
                    M-Pesa isn't configured on this server yet (missing: {mpesaStatus.missing.join(", ")}).
                    See server/.env.example for sandbox setup steps.
                  </p>
                )}
                <form onSubmit={handleSubscribe} className="form-section" style={{ border: "none", padding: 0 }}>
                  <input
                    type="text"
                    placeholder="M-Pesa phone number, e.g. 2547XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  {mpesaStatus?.env === "sandbox" && (
                    <p className="hint">
                      Sandbox mode only delivers STK prompts to Safaricom's test number 254708374149.
                    </p>
                  )}
                  {error && <p className="form-error">{error}</p>}
                  {payState === "pending" && <p className="hint">Check your phone and enter your M-Pesa PIN...</p>}
                  {payState === "success" && <p className="hint" style={{ color: "var(--green)" }}>Payment received — you're now on Pro!</p>}
                  <div className="form-actions">
                    <button type="submit" disabled={payState === "pending" || (mpesaStatus && !mpesaStatus.configured)}>
                      {payState === "pending" ? "Waiting for payment..." : `Pay KES ${pro.priceKES} with M-Pesa`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>

      <div className="trustcheck-results">
        <div className="report-placeholder" style={{ textAlign: "left" }}>
          <h3 style={{ marginTop: 0 }}>How billing works</h3>
          <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Free plan: 10 TrustChecks/month, 1 team member.</li>
            <li>Pro plan: unlimited checks, up to 10 team members, KES {pro?.priceKES ?? 1500}/month via M-Pesa.</li>
            <li>Payment uses Safaricom's STK Push — you'll get a prompt on your phone to enter your M-Pesa PIN.</li>
            <li>Subscriptions run for 30 days from successful payment; renew any time from this page.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
