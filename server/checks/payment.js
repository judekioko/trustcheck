import { findSupplierByNameOrDomain } from "../suppliers.js";

function normalizeAccount(value) {
  return (value || "").toString().replace(/\s|-/g, "");
}

export async function checkPayment({ supplierName, accountNumber, mpesaPaybill, bank, phone }) {
  const reasons = [];
  let riskPoints = 0;

  if (!supplierName || !supplierName.trim()) {
    return { status: "unknown", score: 0, reasons: ["No supplier/recipient name provided"], matchedSupplier: null };
  }

  const supplier = await findSupplierByNameOrDomain(supplierName);

  if (!supplier) {
    riskPoints += 30;
    reasons.push(
      `"${supplierName}" is not in your known-supplier records — this may be the first payment to a new destination`
    );
    const score = Math.min(100, riskPoints);
    return { status: score >= 20 ? "amber" : "green", score, reasons, matchedSupplier: null };
  }

  reasons.push(`Matched known supplier record: "${supplier.name}"`);

  const requestedAccount = normalizeAccount(accountNumber);
  const knownAccount = normalizeAccount(supplier.accountNumber);
  if (requestedAccount && knownAccount) {
    if (requestedAccount !== knownAccount) {
      riskPoints += 60;
      reasons.push(
        `Requested account number (${requestedAccount}) does NOT match ${supplier.name}'s known account (${knownAccount}) — high risk of payment redirection fraud`
      );
    } else {
      reasons.push("Requested account number matches the record on file");
    }
  }

  const requestedPaybill = normalizeAccount(mpesaPaybill);
  const knownPaybill = normalizeAccount(supplier.mpesaPaybill);
  if (requestedPaybill && knownPaybill && requestedPaybill !== knownPaybill) {
    riskPoints += 50;
    reasons.push(
      `Requested M-Pesa paybill (${requestedPaybill}) does not match the known paybill (${knownPaybill}) for ${supplier.name}`
    );
  }

  if (bank && supplier.bank && bank.trim().toLowerCase() !== supplier.bank.trim().toLowerCase()) {
    riskPoints += 40;
    reasons.push(`Requested bank ("${bank}") differs from the bank on file ("${supplier.bank}")`);
  }

  if (phone && supplier.phone) {
    const digitsA = phone.replace(/\D/g, "").slice(-9);
    const digitsB = supplier.phone.replace(/\D/g, "").slice(-9);
    if (digitsA !== digitsB) {
      riskPoints += 20;
      reasons.push(`Contact phone number differs from the one on file for ${supplier.name}`);
    }
  }

  const score = Math.min(100, riskPoints);
  let status = "green";
  if (score >= 50) status = "red";
  else if (score >= 20) status = "amber";

  return { status, score, reasons, matchedSupplier: { id: supplier.id, name: supplier.name } };
}
