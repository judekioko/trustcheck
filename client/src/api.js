const BASE = "/api";
const TOKEN_KEY = "trustcheck_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("trustcheck:unauthorized"));
  }

  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function register(data) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export function login(data) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(data) });
}

export function fetchMe() {
  return request("/auth/me");
}

export function runTrustCheck(payload) {
  return request("/trustcheck", { method: "POST", body: JSON.stringify(payload) });
}

export function listChecks() {
  return request("/checks");
}

export function getCheckDetail(id) {
  return request(`/checks/${id}`);
}

export function listSuppliers() {
  return request("/suppliers");
}

export function createSupplier(data) {
  return request("/suppliers", { method: "POST", body: JSON.stringify(data) });
}

export function updateSupplier(id, data) {
  return request(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteSupplier(id) {
  return request(`/suppliers/${id}`, { method: "DELETE" });
}
