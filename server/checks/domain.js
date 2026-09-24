import dns from "node:dns/promises";

// Well-known brands frequently impersonated in East African phishing/BEC scams.
// Used only for typosquat / lookalike detection, not as an allowlist.
const KNOWN_BRANDS = [
  { name: "KCB Bank", domain: "kcbgroup.com", aliases: ["kcb"] },
  { name: "Equity Bank", domain: "equitybank.co.ke", aliases: ["equity"] },
  { name: "Safaricom", domain: "safaricom.co.ke", aliases: ["safaricom"] },
  { name: "M-Pesa", domain: "mpesa.co.ke", aliases: ["mpesa", "m-pesa"] },
  { name: "Co-operative Bank", domain: "co-opbank.co.ke", aliases: ["coop", "co-op"] },
  { name: "Absa Bank Kenya", domain: "absabank.co.ke", aliases: ["absa"] },
  { name: "NCBA Bank", domain: "ncbagroup.com", aliases: ["ncba"] },
  { name: "Standard Chartered Kenya", domain: "sc.com", aliases: ["stanchart"] },
  { name: "DHL", domain: "dhl.com", aliases: ["dhl"] },
  { name: "Kenya Revenue Authority", domain: "kra.go.ke", aliases: ["kra"] },
  { name: "Google", domain: "google.com", aliases: ["google"] },
  { name: "Microsoft", domain: "microsoft.com", aliases: ["microsoft"] },
  { name: "PayPal", domain: "paypal.com", aliases: ["paypal"] },
];

const SUSPICIOUS_KEYWORDS = [
  "secure", "alert", "verify", "login", "update", "confirm", "account",
  "support", "billing", "signin", "auth", "recover", "unlock",
];

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "click", "work", "support", "gq", "tk", "ml", "cf", "ga",
  "live", "loan", "win", "icu", "cam", "rest",
]);

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function normalizeDomain(input) {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  d = d.split(":")[0];
  return d;
}

function isIpAddress(domain) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
}

function isPunycode(domain) {
  return domain.split(".").some((part) => part.startsWith("xn--"));
}

async function resolveDns(domain) {
  const result = { hasA: false, hasMx: false, error: null };
  try {
    const a = await dns.resolve4(domain);
    result.hasA = a.length > 0;
  } catch (err) {
    result.error = err.code || "DNS_ERROR";
  }
  try {
    const mx = await dns.resolveMx(domain);
    result.hasMx = mx.length > 0;
  } catch {
    // MX absence is common for non-mail domains; not itself suspicious.
  }
  return result;
}

export async function checkDomain(rawDomain) {
  const reasons = [];
  const domain = normalizeDomain(rawDomain);

  if (!domain || !domain.includes(".")) {
    return {
      input: rawDomain,
      domain,
      status: "unknown",
      score: 0,
      reasons: ["Could not parse a valid domain from the input"],
    };
  }

  let riskPoints = 0;

  if (isIpAddress(domain)) {
    riskPoints += 40;
    reasons.push("Domain is a raw IP address rather than a registered name");
  }

  if (isPunycode(domain)) {
    riskPoints += 35;
    reasons.push("Domain uses punycode (xn--) encoding, often used to spoof lookalike characters");
  }

  const tld = domain.split(".").pop();
  if (SUSPICIOUS_TLDS.has(tld)) {
    riskPoints += 15;
    reasons.push(`Uses a top-level domain (.${tld}) commonly abused for throwaway phishing sites`);
  }

  const hyphenCount = (domain.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    riskPoints += 15;
    reasons.push("Unusually high number of hyphens in the domain name");
  }

  const digitCount = (domain.match(/\d/g) || []).length;
  if (digitCount >= 3 && !isIpAddress(domain)) {
    riskPoints += 10;
    reasons.push("Domain contains an unusually high number of digits");
  }

  // Typosquat detection against known brands
  const label = domain.split(".")[0];
  let closestBrand = null;
  let closestDistance = Infinity;
  for (const brand of KNOWN_BRANDS) {
    const brandLabel = brand.domain.split(".")[0];
    if (domain === brand.domain) {
      closestBrand = null;
      closestDistance = Infinity;
      break; // exact match to a known legitimate domain, not a lookalike
    }
    const distance = levenshtein(label, brandLabel);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestBrand = brand;
    }
  }
  if (closestBrand && closestDistance > 0 && closestDistance <= 2 && label.length > 3) {
    riskPoints += 45;
    reasons.push(
      `Looks like a lookalike of "${closestBrand.domain}" (${closestBrand.name}) — differs by only ${closestDistance} character${closestDistance > 1 ? "s" : ""}`
    );
  } else {
    // Catch the common pattern of a real brand name combined with alarming
    // keywords on an unrelated domain, e.g. "kcb-secure-alerts.xyz".
    const labelWords = label.split(/[^a-z0-9]+/).filter(Boolean);
    const embeddedBrand = KNOWN_BRANDS.find((brand) => {
      if (domain === brand.domain) return false;
      return brand.aliases.some((alias) => labelWords.includes(alias) || label.includes(alias));
    });
    const hasSuspiciousKeyword = SUSPICIOUS_KEYWORDS.some((kw) => label.includes(kw));
    if (embeddedBrand && hasSuspiciousKeyword) {
      riskPoints += 50;
      reasons.push(
        `Combines the brand name "${embeddedBrand.name}" with alarming keywords on a domain that is not "${embeddedBrand.domain}"`
      );
    } else if (embeddedBrand) {
      riskPoints += 20;
      reasons.push(
        `Contains the brand name "${embeddedBrand.name}" but is not their official domain ("${embeddedBrand.domain}")`
      );
    }
  }

  const dnsResult = await resolveDns(domain);
  if (dnsResult.error === "ENOTFOUND" || dnsResult.error === "ENODATA") {
    riskPoints += 30;
    reasons.push("Domain does not currently resolve to any server (no DNS A record)");
  } else if (dnsResult.error) {
    reasons.push(`DNS lookup could not be completed (${dnsResult.error}) — treat as unverified`);
  } else if (dnsResult.hasA) {
    reasons.push("Domain resolves correctly and has an active DNS record");
  }

  const score = Math.min(100, riskPoints);
  let status = "green";
  if (score >= 50) status = "red";
  else if (score >= 20) status = "amber";

  if (reasons.length === 0) {
    reasons.push("No red flags detected in domain structure or DNS records");
  }

  return { input: rawDomain, domain, status, score, reasons };
}
