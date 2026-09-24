import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "suppliers.json");

async function readAll() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeAll(suppliers) {
  await writeFile(DATA_FILE, JSON.stringify(suppliers, null, 2), "utf-8");
}

export async function listSuppliers() {
  return readAll();
}

export async function getSupplier(id) {
  const suppliers = await readAll();
  return suppliers.find((s) => s.id === id) || null;
}

export async function findSupplierByNameOrDomain(query) {
  if (!query) return null;
  const suppliers = await readAll();
  const q = query.trim().toLowerCase();
  return (
    suppliers.find(
      (s) =>
        s.name.toLowerCase() === q ||
        s.domain?.toLowerCase() === q ||
        s.name.toLowerCase().includes(q) ||
        q.includes(s.name.toLowerCase())
    ) || null
  );
}

export async function createSupplier(data) {
  const suppliers = await readAll();
  const supplier = {
    id: `sup_${nanoid(8)}`,
    name: data.name?.trim() || "Unnamed supplier",
    domain: data.domain?.trim().toLowerCase() || "",
    email: data.email?.trim().toLowerCase() || "",
    phone: data.phone?.trim() || "",
    bank: data.bank?.trim() || "",
    accountNumber: data.accountNumber?.trim() || "",
    mpesaPaybill: data.mpesaPaybill?.trim() || "",
    notes: data.notes?.trim() || "",
  };
  suppliers.push(supplier);
  await writeAll(suppliers);
  return supplier;
}

export async function updateSupplier(id, data) {
  const suppliers = await readAll();
  const idx = suppliers.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  suppliers[idx] = { ...suppliers[idx], ...data, id };
  await writeAll(suppliers);
  return suppliers[idx];
}

export async function deleteSupplier(id) {
  const suppliers = await readAll();
  const next = suppliers.filter((s) => s.id !== id);
  const changed = next.length !== suppliers.length;
  if (changed) await writeAll(next);
  return changed;
}
