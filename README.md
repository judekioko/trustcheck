# TrustCheck

A digital trust / fraud-prevention prototype for African SMEs: paste an email or
WhatsApp message, an invoice, a domain, or a payment request, and get back a
TrustCheck report — an identity/document/domain/payment risk breakdown with an
overall risk level and the specific reasons behind it.

This targets the "invoice fraud" / business-email-compromise pattern that hits
SMEs hardest: a supplier's email gets spoofed or their invoice is intercepted,
and the attacker asks the business to pay a *new* bank account or paybill
number instead of the real one.

## How it works

There's no paid third-party fraud API here — everything is a transparent,
inspectable heuristic engine (see `server/checks/`):

- **Domain check** — typosquatting/lookalike detection against common Kenyan
  and global brands, suspicious TLDs, punycode, IP-as-domain, and live DNS
  resolution.
- **Email/message check** — phishing language (urgency, generic greetings),
  requests to change payment details or hand over credentials, sender-domain
  vs claimed-organization mismatches, and off-domain links.
- **Invoice/document check** — extracts account/paybill numbers from pasted
  invoice text and compares them against your known-supplier records.
- **Payment request check** — the core BEC-fraud catch: compares a requested
  payment destination (account number, paybill, bank, phone) against the
  supplier's record on file and flags any mismatch as high risk.
- **Known suppliers** — a small CRUD registry (`server/data/suppliers.json`)
  that the invoice/payment checks compare against. Add your real suppliers'
  verified payment details here to get real protection.

All four checks are optional and independent — fill in whichever inputs you
have, and the aggregate `/api/trustcheck` endpoint combines whatever was run
into one report.

## Project layout

```
trustcheck/
  server/   Express API (heuristics + supplier registry)
  client/   React + Vite front end
```

## Running it

Requires Node 18+.

```bash
npm run install:all
npm run dev
```

This starts the API on `http://localhost:8787` and the UI on
`http://localhost:5173` (which proxies `/api` to the server). Open the UI URL
in your browser.

To run them separately:

```bash
npm run dev:server   # http://localhost:8787
npm run dev:client   # http://localhost:5173
```

## API

- `GET  /api/suppliers` / `POST /api/suppliers` / `PUT /api/suppliers/:id` / `DELETE /api/suppliers/:id`
- `POST /api/check/domain`   `{ domain }`
- `POST /api/check/email`    `{ text, claimedOrgDomain? }`
- `POST /api/check/invoice`  `{ text, supplierName? }`
- `POST /api/check/payment`  `{ supplierName, accountNumber?, mpesaPaybill?, bank?, phone? }`
- `POST /api/trustcheck`     `{ domain?: {value}, email?: {text, claimedOrgDomain}, invoice?: {text, supplierName}, payment?: {...} }`
  → `{ report: { indicators, overallRisk, reasons, ranAt }, details }`

## Known limitations (it's a prototype)

- Heuristics only — no external threat-intel, WHOIS, or paid verification
  APIs are wired in. Domain age/registrar checks are stubbed via best-effort
  DNS resolution only.
- Supplier data is a flat JSON file, fine for a demo, not for production
  multi-tenant use.
- No document upload/OCR yet — invoices are pasted as text.
- No authentication — this is a local prototype, not a deployed multi-user
  product.

## Where this goes next

Kenya → Africa → global, per the original pitch: turn the heuristic engine
into a proper "Trust API" that businesses can call from their own invoicing,
email, and payments tools, and layer in real data sources (WHOIS/domain age,
bank verification, AI-agent permission auditing) as the product matures.
