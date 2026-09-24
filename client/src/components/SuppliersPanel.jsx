import { useEffect, useState } from "react";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../api";

const EMPTY = {
  name: "",
  domain: "",
  email: "",
  phone: "",
  bank: "",
  accountNumber: "",
  mpesaPaybill: "",
  notes: "",
};

export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      setSuppliers(await listSuppliers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function startEdit(supplier) {
    setEditingId(supplier.id);
    setForm({ ...EMPTY, ...supplier });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setError(null);
    try {
      if (editingId) {
        await updateSupplier(editingId, form);
      } else {
        await createSupplier(form);
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this supplier record?")) return;
    try {
      await deleteSupplier(id);
      if (editingId === id) cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="suppliers-layout">
      <form className="trustcheck-form" onSubmit={handleSubmit}>
        <h3>{editingId ? "Edit supplier" : "Add a known supplier"}</h3>
        <p className="hint">
          Known suppliers are what payment and invoice checks compare against to catch new/changed
          payment destinations.
        </p>
        <div className="grid-2">
          <input placeholder="Name" value={form.name} onChange={update("name")} />
          <input placeholder="Website domain" value={form.domain} onChange={update("domain")} />
          <input placeholder="Email" value={form.email} onChange={update("email")} />
          <input placeholder="Phone" value={form.phone} onChange={update("phone")} />
          <input placeholder="Bank" value={form.bank} onChange={update("bank")} />
          <input placeholder="Account number" value={form.accountNumber} onChange={update("accountNumber")} />
          <input placeholder="M-Pesa paybill" value={form.mpesaPaybill} onChange={update("mpesaPaybill")} />
          <input placeholder="Notes" value={form.notes} onChange={update("notes")} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit">{editingId ? "Save changes" : "Add supplier"}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="suppliers-list">
        {loading && <p>Loading suppliers...</p>}
        {!loading && suppliers.length === 0 && <p>No suppliers on file yet.</p>}
        {suppliers.map((s) => (
          <div className="supplier-card" key={s.id}>
            <div className="supplier-card-header">
              <strong>{s.name}</strong>
              <div className="supplier-actions">
                <button type="button" onClick={() => startEdit(s)}>Edit</button>
                <button type="button" className="danger" onClick={() => handleDelete(s.id)}>Delete</button>
              </div>
            </div>
            <p className="supplier-detail">{s.domain}</p>
            <p className="supplier-detail">{s.bank} · {s.accountNumber} {s.mpesaPaybill && `· Paybill ${s.mpesaPaybill}`}</p>
            <p className="supplier-detail">{s.email} {s.phone && `· ${s.phone}`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
