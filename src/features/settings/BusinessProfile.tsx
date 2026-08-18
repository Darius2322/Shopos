import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { db, enqueueSync } from '../../lib/db';

export function BusinessProfile() {
  const { business, profile } = useAuth();
  const canEdit = profile?.role === 'owner';
  const [form, setForm] = useState(() => ({
    name: business?.name ?? '',
    phone: business?.phone ?? '',
    email: business?.email ?? '',
    address: business?.address ?? '',
    currency: business?.currency ?? 'KES',
    taxRate: String(business?.taxRate ?? 0),
    paymentInstructions: business?.paymentInstructions ?? '',
    receiptFooter: business?.receiptFooter ?? ''
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!business) return null;

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const updated = {
        ...business,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        currency: form.currency,
        taxRate: parseFloat(form.taxRate) || 0,
        paymentInstructions: form.paymentInstructions || null,
        receiptFooter: form.receiptFooter || null,
        updatedAt: new Date().toISOString()
      };
      await db.businesses.put(updated as any);
      await enqueueSync('businesses', business!.id, 'update');
      setSaved(true);
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Business profile</h1>
      {!canEdit && <p className="text-xs text-slate-500 mb-4">Only the owner can edit these details.</p>}
      <div className="card p-4 space-y-3.5">
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Business name</span>
          <input className="input" value={form.name} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Phone</span>
            <input className="input" value={form.phone} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Email</span>
            <input className="input" value={form.email} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
        </div>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Address</span>
          <input className="input" value={form.address} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Currency</span>
            <input className="input" value={form.currency} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
          </label>
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Tax rate (%)</span>
            <input className="input tnum" type="number" value={form.taxRate} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))} />
          </label>
        </div>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Payment instructions (shown on invoices)</span>
          <textarea className="input min-h-16" value={form.paymentInstructions} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, paymentInstructions: e.target.value }))} />
        </label>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Receipt footer</span>
          <textarea className="input min-h-16" value={form.receiptFooter} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))} />
        </label>
        {canEdit && (
          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        )}
      </div>
    </div>
  );
}
