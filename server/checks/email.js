const URGENCY_PHRASES = [
  "urgent", "immediately", "act now", "as soon as possible", "asap",
  "final notice", "account will be suspended", "account has been suspended",
  "verify your account", "confirm your details", "unusual activity",
  "failure to respond", "within 24 hours", "within 12 hours",
  "your account is locked", "avoid suspension", "kindly note",
];

const PAYMENT_CHANGE_PHRASES = [
  "new account number", "new bank account", "updated bank details",
  "change of bank", "changed our bank", "new payment details",
  "kindly update", "update your records", "new supplier account",
  "different account", "alternative account", "gift card",
  "wire transfer", "send the payment to", "remit to",
];

const CREDENTIAL_REQUEST_PHRASES = [
  "enter your password", "confirm your password", "your pin", "otp",
  "one time password", "login details", "click the link below to verify",
  "social security number", "id number and password",
];

const GENERIC_GREETINGS = [
  "dear customer", "dear sir/madam", "dear sir madam", "dear valued customer",
  "dear account holder", "dear user", "hello dear",
];

function extractEmailAddress(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function extractDisplayNameDomainClaim(text) {
  // Looks for patterns like "From: Jane Doe <jane@company.com>" or "KCB Bank <support@kcb-alerts.com>"
  const match = text.match(/from\s*:?\s*([^<\n]+)<([^>]+)>/i);
  if (!match) return null;
  return { displayName: match[1].trim(), email: match[2].trim().toLowerCase() };
}

function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/gi) || [];
  return matches.map((u) => u.replace(/[.,;)]+$/, ""));
}

function countMatches(text, phrases) {
  const lower = text.toLowerCase();
  const found = [];
  for (const phrase of phrases) {
    if (lower.includes(phrase)) found.push(phrase);
  }
  return found;
}

export function checkEmail(rawText, claimedOrgDomain) {
  const reasons = [];
  let riskPoints = 0;

  if (!rawText || !rawText.trim()) {
    return { status: "unknown", score: 0, reasons: ["No message text provided"] };
  }

  const text = rawText.trim();

  const urgencyHits = countMatches(text, URGENCY_PHRASES);
  if (urgencyHits.length > 0) {
    riskPoints += Math.min(25, urgencyHits.length * 10);
    reasons.push(`Uses pressure/urgency language ("${urgencyHits[0]}")`);
  }

  const paymentHits = countMatches(text, PAYMENT_CHANGE_PHRASES);
  if (paymentHits.length > 0) {
    riskPoints += Math.min(35, paymentHits.length * 15);
    reasons.push(`Requests a change to payment details ("${paymentHits[0]}") — classic invoice-fraud pattern`);
  }

  const credentialHits = countMatches(text, CREDENTIAL_REQUEST_PHRASES);
  if (credentialHits.length > 0) {
    riskPoints += 30;
    reasons.push(`Asks for credentials or one-time codes ("${credentialHits[0]}")`);
  }

  const greetingHits = countMatches(text, GENERIC_GREETINGS);
  if (greetingHits.length > 0) {
    riskPoints += 10;
    reasons.push(`Uses a generic greeting ("${greetingHits[0]}") instead of your name`);
  }

  const senderEmail = extractEmailAddress(text);
  const displayClaim = extractDisplayNameDomainClaim(text);
  const senderDomain = (displayClaim?.email || senderEmail || "").split("@")[1] || null;

  if (claimedOrgDomain && senderDomain) {
    const claimed = claimedOrgDomain.trim().toLowerCase().replace(/^www\./, "");
    if (senderDomain !== claimed && !senderDomain.endsWith(`.${claimed}`)) {
      riskPoints += 40;
      reasons.push(
        `Sender domain "${senderDomain}" does not match the claimed organization's domain "${claimed}"`
      );
    } else {
      reasons.push(`Sender domain matches the claimed organization ("${claimed}")`);
    }
  }

  const urls = extractUrls(text);
  if (urls.length > 0 && senderDomain) {
    const offDomainLinks = urls.filter((u) => {
      try {
        const host = new URL(u).hostname.replace(/^www\./, "");
        return !host.endsWith(senderDomain) && !senderDomain.endsWith(host);
      } catch {
        return false;
      }
    });
    if (offDomainLinks.length > 0) {
      riskPoints += 20;
      reasons.push(`Contains link(s) pointing to a different domain than the sender: ${offDomainLinks[0]}`);
    }
  }

  const score = Math.min(100, riskPoints);
  let status = "green";
  if (score >= 50) status = "red";
  else if (score >= 20) status = "amber";

  if (reasons.length === 0) {
    reasons.push("No common phishing or impersonation indicators detected");
  }

  return { status, score, reasons, senderDomain, urls };
}
