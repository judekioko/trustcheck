import { findSupplierByNameOrDomain } from "../suppliers.js";

const URGENCY_PHRASES = [
  "urgent", "immediately", "pay today", "due today", "final reminder",
  "overdue", "last chance", "avoid penalty", "before end of day",
];

function extractAccountNumbers(text) {
  const results = new Set();
  const patterns = [
    /(?:a\/?c|acc(?:ount)?\.?\s*(?:no\.?|number)?)\s*[:#-]?\s*(\d[\d\s-]{6,20}\d)/gi,
    /(?:paybill|till\s*number|till\s*no\.?)\s*[:#-]?\s*(\d{4,7})/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      results.add(match[1].replace(/\s|-/g, ""));
    }
  }
  return [...results];
}

function extractSupplierNameGuess(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 5).join(" ");
}

function extractPhone(text) {
  const match = text.match(/(?:\+254|0)7\d{8}/);
  return match ? match[0] : null;
}

export async function checkInvoice(rawText, supplierNameHint) {
  const reasons = [];
  let riskPoints = 0;

  if (!rawText || !rawText.trim()) {
    return { status: "unknown", score: 0, reasons: ["No invoice/document text provided"], matchedSupplier: null };
  }

  const text = rawText.trim();
  const nameGuess = supplierNameHint?.trim() || extractSupplierNameGuess(text);
  const supplier = await findSupplierByNameOrDomain(nameGuess);

  const foundAccounts = extractAccountNumbers(text);
  const foundPhone = extractPhone(text);

  if (supplier) {
    reasons.push(`Matched against known supplier record: "${supplier.name}"`);

    const knownIdentifiers = [supplier.accountNumber, supplier.mpesaPaybill].filter(Boolean);
    if (foundAccounts.length > 0 && knownIdentifiers.length > 0) {
      const matchesKnown = foundAccounts.some((acc) => knownIdentifiers.includes(acc));
      if (!matchesKnown) {
        riskPoints += 55;
        reasons.push(
          `Payment details in the document (${foundAccounts.join(", ")}) do not match ${supplier.name}'s known account/paybill on file`
        );
      } else {
        reasons.push("Payment details match the supplier's known account on file");
      }
    }

    if (foundPhone && supplier.phone && !supplier.phone.includes(foundPhone.replace(/^0/, ""))) {
      riskPoints += 15;
      reasons.push(`Contact phone number (${foundPhone}) differs from the one on file for ${supplier.name}`);
    }
  } else {
    reasons.push("No matching supplier on file — cannot verify payment details against history (add this supplier first for stronger checks)");
    riskPoints += 5;
  }

  if (foundAccounts.length > 1) {
    riskPoints += 15;
    reasons.push(`Document lists ${foundAccounts.length} different account/paybill numbers — inconsistent payment instructions`);
  }

  const urgencyHits = URGENCY_PHRASES.filter((p) => text.toLowerCase().includes(p));
  if (urgencyHits.length > 0) {
    riskPoints += 15;
    reasons.push(`Uses payment pressure language ("${urgencyHits[0]}")`);
  }

  const hasInvoiceNumber = /invoice\s*(?:no\.?|number|#)?\s*[:#-]?\s*\S+/i.test(text);
  if (!hasInvoiceNumber) {
    riskPoints += 10;
    reasons.push("No invoice number found — legitimate invoices usually have a traceable reference");
  }

  const hasKraPin = /(?:kra\s*pin|pin\s*no\.?)\s*[:#-]?\s*[A-Z0-9]{5,}/i.test(text);
  if (!hasKraPin) {
    riskPoints += 5;
    reasons.push("No KRA PIN / tax reference found on the document");
  }

  const score = Math.min(100, riskPoints);
  let status = "green";
  if (score >= 50) status = "red";
  else if (score >= 20) status = "amber";

  return {
    status,
    score,
    reasons,
    matchedSupplier: supplier ? { id: supplier.id, name: supplier.name } : null,
    foundAccounts,
  };
}
