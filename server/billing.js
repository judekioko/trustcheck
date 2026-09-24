import { db } from "./db.js";
import { getPlan, PLANS } from "./plans.js";
import { countChecksThisMonth } from "./history.js";
import * as mpesa from "./mpesa.js";

export function getUsage(org) {
  const plan = getPlan(org.plan);
  const used = countChecksThisMonth(org.id);
  return {
    plan: plan.key,
    planName: plan.name,
    monthlyCheckLimit: Number.isFinite(plan.monthlyCheckLimit) ? plan.monthlyCheckLimit : null,
    checksUsedThisMonth: used,
    remaining: Number.isFinite(plan.monthlyCheckLimit)
      ? Math.max(0, plan.monthlyCheckLimit - used)
      : null,
    subscriptionStatus: org.subscription_status,
    currentPeriodEnd: org.current_period_end,
  };
}

export function hasQuotaRemaining(org) {
  const plan = getPlan(org.plan);
  if (!Number.isFinite(plan.monthlyCheckLimit)) return true;
  return countChecksThisMonth(org.id) < plan.monthlyCheckLimit;
}

export async function startProSubscription({ org, user, phone }) {
  const plan = getPlan("pro");
  const { merchantRequestId, checkoutRequestId } = await mpesa.initiateStkPush({
    phone,
    amount: plan.priceKES,
    accountReference: `TC${org.id}`,
    transactionDesc: "TrustCheck Pro",
  });

  db.prepare(
    `INSERT INTO payments (org_id, initiated_by, plan, amount, phone, checkout_request_id, merchant_request_id, status)
     VALUES (?, ?, 'pro', ?, ?, ?, ?, 'pending')`
  ).run(org.id, user.id, plan.priceKES, phone, checkoutRequestId, merchantRequestId);

  return { checkoutRequestId };
}

export function getPaymentByCheckoutId(checkoutRequestId) {
  return db
    .prepare("SELECT * FROM payments WHERE checkout_request_id = ?")
    .get(checkoutRequestId);
}

export function getPaymentStatusForOrg(org, checkoutRequestId) {
  const payment = getPaymentByCheckoutId(checkoutRequestId);
  if (!payment || payment.org_id !== org.id) return null;
  return {
    status: payment.status,
    mpesaReceipt: payment.mpesa_receipt,
    resultDesc: payment.result_desc,
  };
}

export function applyStkCallback(parsed) {
  const payment = getPaymentByCheckoutId(parsed.checkoutRequestId);
  if (!payment) return null;

  const status = parsed.success ? "success" : "failed";
  db.prepare(
    `UPDATE payments SET status = ?, mpesa_receipt = ?, result_desc = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, parsed.mpesaReceipt, parsed.resultDesc, payment.id);

  if (parsed.success) {
    const plan = getPlan(payment.plan);
    const periodEnd = new Date(Date.now() + (plan.billingPeriodDays || 30) * 86400000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    db.prepare(
      `UPDATE organizations SET plan = ?, subscription_status = 'active', current_period_end = ? WHERE id = ?`
    ).run(payment.plan, periodEnd, payment.org_id);
  }

  return { ...payment, status };
}

export function listPlans() {
  return Object.values(PLANS).map((p) => ({
    key: p.key,
    name: p.name,
    priceKES: p.priceKES,
    monthlyCheckLimit: Number.isFinite(p.monthlyCheckLimit) ? p.monthlyCheckLimit : null,
    maxTeamMembers: p.maxTeamMembers,
  }));
}

export { mpesa };
