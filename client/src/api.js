const BASE = "/api";

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function runTrustCheck(payload) {
  return request("/trustcheck", { method: "POST", body: JSON.stringify(payload) });
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
