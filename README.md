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
- **Known suppliers** — a per-business CRUD registry that the invoice/payment
  checks compare against. Add your real suppliers' verified payment details
  here to get real protection.

All four checks are optional and independent — fill in whichever inputs you
have, and the aggregate `/api/trustcheck` endpoint combines whatever was run
into one report, which is also saved to that business's check history.

## Accounts & data

Each business signs up with a name/email/password (`bcryptjs` hashed,
`jsonwebtoken`-based sessions). Suppliers and past checks are private to the
account that created them — this is now a real multi-tenant foundation, not
a single shared JSON file. Data lives in a SQLite database
(`server/data/trustcheck.db`, via Node's built-in `node:sqlite`, so no native
module install step) — swap `db.js` for a Postgres connection later without
touching the rest of the app, since all writes go through `suppliers.js` /
`history.js` / `auth.js`.

## Project layout

```
trustcheck/
  server/
    db.js         SQLite schema + connection
    auth.js       registration/login, password hashing, JWT sessions
    suppliers.js  per-business supplier CRUD
    history.js    per-business check history
    checks/       the heuristic engines (domain, email, invoice, payment, aggregate)
  client/         React + Vite front end (auth screens, check form, history, suppliers)
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

- `POST /api/auth/register` `{ businessName, email, password }` → `{ token, user }`
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET  /api/auth/me` (Bearer token) → `{ user }`

Everything below requires `Authorization: Bearer <token>` and is scoped to
that business:

- `GET  /api/suppliers` / `POST /api/suppliers` / `PUT /api/suppliers/:id` / `DELETE /api/suppliers/:id`
- `POST /api/check/domain`   `{ domain }`
- `POST /api/check/email`    `{ text, claimedOrgDomain? }`
- `POST /api/check/invoice`  `{ text, supplierName? }`
- `POST /api/check/payment`  `{ supplierName, accountNumber?, mpesaPaybill?, bank?, phone? }`
- `POST /api/trustcheck`     `{ domain?: {value}, email?: {text, claimedOrgDomain}, invoice?: {text, supplierName}, payment?: {...} }`
  → `{ checkId, report: { indicators, overallRisk, reasons, ranAt }, details }`
- `GET  /api/checks` → recent check history (summary)
- `GET  /api/checks/:id` → full saved report for one past check

Set `JWT_SECRET` in the environment for production; otherwise a random
secret is generated once and persisted to `server/data/.jwt-secret` (dev
only — rotating it invalidates all sessions).

## Known limitations (still not the finished product)

- Heuristics only — no external threat-intel, WHOIS, or paid verification
  APIs are wired in yet. Domain age/registrar checks are stubbed via
  best-effort DNS resolution only.
- SQLite is fine for one server instance; a real multi-region deployment
  would want Postgres.
- No document upload/OCR yet — invoices are pasted as text.
- Not deployed anywhere yet — runs locally only.
- No billing — see the M-Pesa/Daraja option discussed for a future pass.

## Where this goes next

Kenya → Africa → global, per the original pitch: turn the heuristic engine
into a proper "Trust API" that businesses can call from their own invoicing,
email, and payments tools, and layer in real data sources (WHOIS/domain age,
bank verification, AI-agent permission auditing) as the product matures.
