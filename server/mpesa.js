// Safaricom Daraja (M-Pesa) integration — STK Push ("Lipa na M-Pesa Online").
//
// Sandbox setup (free, no business paperwork):
//   1. Create an app at https://developer.safaricom.co.ke (Daraja sandbox).
//   2. Copy its Consumer Key / Consumer Secret into DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET.
//   3. Sandbox shortcode 174379 and its passkey (published in Safaricom's own docs) are
//      already the defaults below — you don't need to change them for sandbox testing.
//   4. DARAJA_CALLBACK_URL must be a PUBLIC https URL Safaricom's servers can reach —
//      localhost will NOT work. Use a tunnel (e.g. `ngrok http 8787`) during development
//      and point it at POST /api/billing/mpesa/callback.
//   5. Sandbox STK pushes only deliver to Safaricom's official test MSISDN: 254708374149.
//      Real Kenyan numbers will not receive a prompt until you move to production credentials.

const ENV = process.env.DARAJA_ENV === "production" ? "production" : "sandbox";
const BASE_URL =
  ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET || "";
const SHORTCODE = process.env.DARAJA_SHORTCODE || "174379";
const PASSKEY =
  process.env.DARAJA_PASSKEY ||
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // Safaricom's published sandbox passkey
const CALLBACK_URL = process.env.DARAJA_CALLBACK_URL || "";

export function isConfigured() {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET && CALLBACK_URL);
}

export function configStatus() {
  return {
    configured: isConfigured(),
    env: ENV,
    shortcode: SHORTCODE,
    callbackUrlSet: Boolean(CALLBACK_URL),
    missing: [
      !CONSUMER_KEY && "DARAJA_CONSUMER_KEY",
      !CONSUMER_SECRET && "DARAJA_CONSUMER_SECRET",
      !CALLBACK_URL && "DARAJA_CALLBACK_URL",
    ].filter(Boolean),
  };
}

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    throw new Error(`Daraja auth failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  // Tokens are valid ~1 hour; refresh a little early.
  cachedTokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function normalizeMsisdn(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

export async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  if (!isConfigured()) {
    const status = configStatus();
    const err = new Error(
      `M-Pesa is not configured yet. Missing: ${status.missing.join(", ")}. See server/mpesa.js for sandbox setup steps.`
    );
    err.code = "MPESA_NOT_CONFIGURED";
    throw err;
  }

  const token = await getAccessToken();
  const timestamp = timestampNow();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");
  const msisdn = normalizeMsisdn(phone);

  const body = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(amount)),
    PartyA: msisdn,
    PartyB: SHORTCODE,
    PhoneNumber: msisdn,
    CallBackURL: CALLBACK_URL,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: transactionDesc.slice(0, 13),
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ResponseCode !== "0") {
    const err = new Error(data.errorMessage || data.ResponseDescription || "STK push request failed");
    err.details = data;
    throw err;
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseDescription: data.ResponseDescription,
  };
}

// Parses the async callback Safaricom POSTs to CALLBACK_URL once the customer
// enters their PIN (or cancels/times out).
export function parseStkCallback(body) {
  const callback = body?.Body?.stkCallback;
  if (!callback) return null;

  const result = {
    merchantRequestId: callback.MerchantRequestID,
    checkoutRequestId: callback.CheckoutRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    success: callback.ResultCode === 0,
    amount: null,
    mpesaReceipt: null,
    phone: null,
    transactionDate: null,
  };

  const items = callback.CallbackMetadata?.Item || [];
  for (const item of items) {
    if (item.Name === "Amount") result.amount = item.Value;
    if (item.Name === "MpesaReceiptNumber") result.mpesaReceipt = item.Value;
    if (item.Name === "PhoneNumber") result.phone = item.Value;
    if (item.Name === "TransactionDate") result.transactionDate = item.Value;
  }

  return result;
}
