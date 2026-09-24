# TrustCheck

A digital trust / fraud-prevention SaaS for African SMEs: paste an email or
WhatsApp message, an invoice, a domain, or a payment request, and get back a
TrustCheck report — an identity/document/domain/payment risk breakdown with an
overall risk level and the specific reasons behind it.

This targets the "invoice fraud" / business-email-compromise pattern that hits
SMEs hardest: a supplier's email gets spoofed or their invoice is intercepted,
and the attacker asks the business to pay a *new* bank account or paybill
number instead of the real one.

## How the fraud checks work

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
- **Known suppliers** — an org-wide CRUD registry that the invoice/payment
  checks compare against.

All four checks are optional and independent — fill in whichever inputs you
have, and the aggregate `/api/trustcheck` endpoint combines whatever was run
into one report, which is also saved to the organization's check history.

## Accounts, teams & billing

- **Organizations, not just users.** Signing up creates an *organization*
  (the business) plus its first *owner* user. Owners can invite staff by
  email — the invite generates a shareable link (no email sending set up
  yet, so share it via WhatsApp/etc.) — and everyone in the org shares the
  same suppliers and check history.
- **Roles.** `owner` can manage billing and team members; `staff` can run
  checks and manage suppliers but not billing/team.
- **Platform admin.** The very first account ever created on a given server
  is automatically a platform admin and gets an "Admin" tab: business count,
  user count, active subscriptions, checks run, high-risk-flag count, and
  total revenue, plus a table of every organization.
- **Plans & usage limits** (`server/plans.js`): Free = 10 TrustChecks/month,
  1 team member. Pro = unlimited checks, up to 10 team members, KES 1,500/month.
  Hitting the Free limit returns HTTP 402 and the UI shows an upgrade prompt.
- **M-Pesa billing** (`server/mpesa.js`, `server/billing.js`): upgrading to
  Pro triggers a Safaricom Daraja STK Push — the owner gets a prompt on
  their phone to enter their M-Pesa PIN. A webhook
  (`POST /api/billing/mpesa/callback`) receives the async result and
  activates the subscription.

### Setting up M-Pesa (sandbox)

1. Register a free app at https://developer.safaricom.co.ke (Daraja sandbox
   — no business paperwork needed).
2. Copy `server/.env.example` to `server/.env` and fill in
   `DARAJA_CONSUMER_KEY` / `DARAJA_CONSUMER_SECRET` from that app.
3. `DARAJA_CALLBACK_URL` must be a **public https URL** — Safaricom's
   servers call it directly, so `localhost` will not work. Use a tunnel
   during development, e.g.:
   ```bash
   ngrok http 8787
   ```
   then set `DARAJA_CALLBACK_URL=https://<your-subdomain>.ngrok-free.app/api/billing/mpesa/callback`.
4. Leave `DARAJA_SHORTCODE`/`DARAJA_PASSKEY` unset to use Safaricom's
   published sandbox defaults (shortcode `174379`).
5. Sandbox STK pushes only deliver to Safaricom's official test number
   `254708374149` — real Kenyan numbers won't get a prompt until you switch
   to production credentials (`DARAJA_ENV=production`) with your own
   registered paybill/till.

Until these env vars are set, the Billing tab shows exactly what's missing
and disables the "Pay with M-Pesa" button rather than failing silently.

## Accounts & data model

Data lives in a SQLite database (`server/data/trustcheck.db`, via Node's
built-in `node:sqlite` — no native module install step). Passwords are
`bcryptjs`-hashed; sessions are `jsonwebtoken`-based. Tables: `organizations`,
`users` (org_id + role + is_platform_admin), `invites`, `suppliers`,
`checks`, `payments`. Swap `db.js` for a Postgres connection later without
touching the rest of the app, since all access goes through `suppliers.js` /
`history.js` / `auth.js` / `team.js` / `billing.js`.

## Project layout

```
trustcheck/
  server/
    db.js         SQLite schema + connection
    auth.js       org/owner registration, login, JWT sessions, role/admin guards
    team.js       staff invites (create/accept/list/remove)
    plans.js      Free/Pro plan definitions
    billing.js    usage limits + subscription state
    mpesa.js      Safaricom Daraja STK Push integration
    admin.js      platform-wide stats for the admin dashboard
    suppliers.js  org-scoped supplier CRUD
    history.js    org-scoped check history + monthly usage counter
    checks/       the heuristic engines (domain, email, invoice, payment, aggregate)
  client/         React + Vite front end
    src/components/
      AuthScreen.jsx       login / register
      JoinTeamScreen.jsx   accept a team invite link
      TrustCheckForm.jsx   run a check
      HistoryPanel.jsx     past checks
      SuppliersPanel.jsx   known-supplier CRUD
      TeamPanel.jsx        members + invites
      BillingPanel.jsx     plan, usage, M-Pesa upgrade
      AdminPanel.jsx       platform admin dashboard
```

## Running it

Requires Node 20.6+ (uses `node:sqlite` and `--env-file-if-exists`).

```bash
npm run install:all
npm run dev
```

This starts the API on `http://localhost:8787` and the UI on
`http://localhost:5173` (which proxies `/api` to the server). Open the UI URL
in your browser. The first account you register becomes the platform admin.

To run them separately:

```bash
npm run dev:server   # http://localhost:8787
npm run dev:client   # http://localhost:5173
```

## API

- `POST /api/auth/register` `{ name, orgName, email, password }` → `{ token, user }`
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET  /api/auth/me` (Bearer token) → `{ user }`
- `GET  /api/invites/:token` / `POST /api/invites/:token/accept` `{ name, password }`
- `POST /api/billing/mpesa/callback` — public webhook for Safaricom, not for the UI

Everything below requires `Authorization: Bearer <token>` and is scoped to
the caller's organization:

- `GET/POST /api/suppliers`, `PUT/DELETE /api/suppliers/:id`
- `POST /api/check/domain` `{ domain }`
- `POST /api/check/email` `{ text, claimedOrgDomain? }`
- `POST /api/check/invoice` `{ text, supplierName? }`
- `POST /api/check/payment` `{ supplierName, accountNumber?, mpesaPaybill?, bank?, phone? }`
- `POST /api/trustcheck` `{ domain?, email?, invoice?, payment? }` → `{ checkId, report, details }` (402 if the Free quota is used up)
- `GET /api/checks`, `GET /api/checks/:id`
- `GET /api/team/members`, `POST /api/team/invite` (owner only) `{ email, role }`, `DELETE /api/team/members/:id` (owner only)
- `GET /api/billing/plans`, `GET /api/billing/usage`, `GET /api/billing/mpesa-status`
- `POST /api/billing/subscribe` (owner only) `{ phone }` → `{ checkoutRequestId }`
- `GET /api/billing/status/:checkoutRequestId`
- `GET /api/admin/overview`, `GET /api/admin/organizations` (platform admin only)

Set `JWT_SECRET` in the environment for production; otherwise a random
secret is generated once and persisted to `server/data/.jwt-secret` (dev
only — rotating it invalidates all sessions).

## Known limitations (still not the finished product)

- Heuristics only for fraud detection — no external threat-intel, WHOIS, or
  paid verification APIs are wired in yet. Domain age/registrar checks are
  stubbed via best-effort DNS resolution only.
- M-Pesa billing needs your own Daraja sandbox (or production) credentials
  and a public callback URL — it won't work out of the box on localhost.
- SQLite is fine for one server instance; a real multi-region deployment
  would want Postgres.
- No document upload/OCR yet — invoices are pasted as text.
- No email delivery — team invite links must be shared manually.
- Not deployed anywhere yet — runs locally only.

## Where this goes next

Kenya → Africa → global, per the original pitch: turn the heuristic engine
into a proper "Trust API" that businesses can call from their own invoicing,
email, and payments tools, and layer in real data sources (WHOIS/domain age,
KRA PIN/business-registry checks, bank verification, AI-agent permission
auditing) as the product matures.
