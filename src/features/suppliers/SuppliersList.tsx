import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, ChevronRight } from 'lucide-react';
import { db, newRecordBase, enqueueSync } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { recordPurchase, supplierOutstandingBalance } from '../../lib/purchases';
import type { PurchaseItemInput } from '../../lib/types';

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SuppliersList() {
  const { business } = useAuth();
  const currency = business?.currency ?? 'KES';
  const suppliers = useLiveQuery(
    () => (business ? db.suppliers.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];

  const [adding, setAdding] = useState(false);
  const [supplying, setSupplying] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold">Suppliers</h1>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Add supplier
        </button>
      </div>
      <div className="card divide-y divide-slate-100">
        {suppliers.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No suppliers yet.</p>}
        {suppliers.map((s) => <SupplierRow key={s.id} supplier={s} currency={currency} onSupply={() => setSupplying(s.id)} />)}
      </div>
      {adding && business && <AddSupplierModal businessId={business.id} onClose={() => setAdding(false)} />}
      {supplying && business && (
        <RecordPurchaseModal supplierId={supplying} businessId={business.id} onClose={() => setSupplying(null)} />
      )}
    </div>
  );
}

function SupplierRow({ supplier, currency, onSupply }: { supplier: any; currency: string; onSupply: () => void }) {
  const balance = useLiveQuery(() => supplierOutstandingBalance(supplier.id), [supplier.id]) ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{supplier.name}</div>
        <div className="text-xs text-slate-500">{supplier.phone ?? 'No phone'}</div>
        {balance > 0 && <div className="text-xs tnum text-rust-600 mt-0.5">Owed: {money(balance, currency)}</div>}
      </div>
      <button onClick={onSupply} className="btn-secondary text-xs flex items-center gap-1 shrink-0">
        Record supply <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddSupplierModal({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const record = { ...newRecordBase(), businessId, name: name.trim(), phone: phone || null, email: null, address: null, status: 'active' as const };
      await db.suppliers.add(record as any);
      await enqueueSync('suppliers', record.id, 'create');
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Add supplier</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Phone</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <button onClick={submit} disabled={saving || !name.trim()} className="btn-primary w-full">{saving ? 'Saving…' : 'Add supplier'}</button>
      </div>
    </div>
  );
}

function RecordPurchaseModal({ supplierId, businessId, onClose }: { supplierId: string; businessId: string; onClose: () => void }) {
  const { activeBranchId, userId } = useAuth();
  const products = useLiveQuery(
    () => (activeBranchId ? db.products.where({ businessId, branchId: activeBranchId }).toArray() : []),
    [businessId, activeBranchId]
  ) ?? [];

  const [lines, setLines] = useState<PurchaseItemInput[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => lines.reduce((s, l) => s + l.buyingPrice * l.quantity, 0), [lines]);

  function addLine() {
    const product = products.find((p) => p.id === productId);
    if (!product || !qty || !price) return;
    setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: parseFloat(qty), buyingPrice: parseFloat(price) }]);
    setProductId(''); setQty(''); setPrice('');
  }

  async function submit() {
    if (!activeBranchId || lines.length === 0) return;
    setError(null); setSaving(true);
    try {
      await recordPurchase({
        businessId, branchId: activeBranchId, supplierId, userId: userId ?? undefined,
        items: lines, amountPaid: amountPaid === '' ? 0 : parseFloat(amountPaid), paymentMethod: method
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record supply');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Record supply</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select className="input col-span-3" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input tnum" placeholder="Qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input tnum" placeholder="Buying price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button onClick={addLine} className="btn-secondary text-sm">Add</button>
        </div>

        {lines.length > 0 && (
          <div className="border border-slate-200 rounded-card divide-y divide-slate-100">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between px-3 py-2 text-sm">
                <span>{l.productName} × {l.quantity}</span>
                <span className="tnum">{(l.buyingPrice * l.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 text-sm font-semibold"><span>Total</span><span className="tnum">{total.toLocaleString()}</span></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Amount paid</span><input className="input tnum" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0 (full credit)" /></label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1.5">Method</span>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="credit">Credit</option>
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-rust-600">{error}</p>}
        <button onClick={submit} disabled={saving || lines.length === 0} className="btn-primary w-full">{saving ? 'Saving…' : 'Record supply'}</button>
      </div>
    </div>
  );
}
