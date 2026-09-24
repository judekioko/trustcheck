const STATUS_ORDER = { unknown: 0, green: 1, amber: 2, red: 3 };
const STATUS_EMOJI = { green: "🟢", amber: "⚠️", red: "🔴", unknown: "⬜" };

function pickWorse(a, b) {
  if (!a) return b;
  if (!b) return a;
  return STATUS_ORDER[b.status] > STATUS_ORDER[a.status] ? b : a;
}

export function buildTrustReport({ emailResult, invoiceResult, domainResult, paymentResult }) {
  // Identity: who is on the other end of this — derived from the email sender check
  // and/or whether the counterparty matches a known supplier record.
  let identity = null;
  if (emailResult) {
    identity = { status: emailResult.status, reasons: emailResult.reasons };
  }
  if (paymentResult) {
    const supplierIdentity = {
      status: paymentResult.matchedSupplier ? "green" : "amber",
      reasons: paymentResult.matchedSupplier
        ? [`Recipient matches known supplier "${paymentResult.matchedSupplier.name}"`]
        : ["Recipient is not a recognized, previously-verified supplier"],
    };
    identity = pickWorse(identity, supplierIdentity);
  }
  if (invoiceResult?.matchedSupplier === null && invoiceResult.status !== "unknown") {
    identity = pickWorse(identity, {
      status: "amber",
      reasons: ["Document sender could not be matched to a known supplier"],
    });
  }

  const document = invoiceResult && invoiceResult.status !== "unknown" ? invoiceResult : null;
  const domain = domainResult && domainResult.status !== "unknown" ? domainResult : null;
  const payment = paymentResult && paymentResult.status !== "unknown" ? paymentResult : null;

  const indicators = {
    identity: identity ? { status: identity.status, emoji: STATUS_EMOJI[identity.status] } : { status: "unknown", emoji: STATUS_EMOJI.unknown },
    document: document ? { status: document.status, emoji: STATUS_EMOJI[document.status] } : { status: "unknown", emoji: STATUS_EMOJI.unknown },
    domain: domain ? { status: domain.status, emoji: STATUS_EMOJI[domain.status] } : { status: "unknown", emoji: STATUS_EMOJI.unknown },
    payment: payment ? { status: payment.status, emoji: STATUS_EMOJI[payment.status] } : { status: "unknown", emoji: STATUS_EMOJI.unknown },
  };

  const allScores = [emailResult?.score, invoiceResult?.score, domainResult?.score, paymentResult?.score].filter(
    (s) => typeof s === "number"
  );
  const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const combinedScore = Math.round(maxScore * 0.7 + avgScore * 0.3);

  let overallRisk = "LOW";
  if (combinedScore >= 50) overallRisk = "HIGH";
  else if (combinedScore >= 20) overallRisk = "MEDIUM";

  const reasons = [];
  for (const result of [identity, document, domain, payment]) {
    if (result?.reasons) reasons.push(...result.reasons);
  }
  const uniqueReasons = [...new Set(reasons)];

  const flaggedReasons = uniqueReasons.filter(
    (r) => !/^(no |matched|matches|resolves correctly|sender domain matches)/i.test(r)
  );
  const orderedReasons = [...flaggedReasons, ...uniqueReasons.filter((r) => !flaggedReasons.includes(r))];

  return {
    indicators,
    overallRisk,
    combinedScore,
    reasons: orderedReasons.slice(0, 8),
    ranAt: new Date().toISOString(),
  };
}
