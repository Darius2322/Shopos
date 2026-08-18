import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, ArrowRightCircle } from 'lucide-react';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { createQuotation, setQuotationStatus, convertQuotationToSale } from '../../lib/documents';
import type { DocumentLineInput, Quotation, PaymentMethod } from '../../lib/types';

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<Quotation['status'], string> = {
  draft: 'bg-slate-200 text-slate-600',
  sent: 'bg-field-50 text-field-700',
  accepted: 'bg-field-50 text-field-700',
  rejected: 'bg-rust-50 text-rust-600',
  expired: 'bg-amber-100 text-amber-600',
  converted: 'bg-field-50 text-field-700'
};

export function QuotationsList() {
  const { business, activeBranchId, userId } = useAuth();
  const currency = business?.currency ?? 'KES';
  const quotations = useLiveQuery(
    () => (business ? db.quotations.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState<Quotation | null>(null);

  const sorted = [...quotations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold">Quotations</h1>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> New quotation
        </button>
      </div>
      <div className="card divide-y divide-slate-100">
        {sorted.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No quotations yet.</p>}
        {sorted.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{q.quotationNumber}</div>
              <div className="text-xs text-slate-500">{new Date(q.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[q.status]}`}>{q.status}</span>
              <span className="tnum text-sm font-medium">{money(q.total, currency)}</span>
              {q.status === 'draft' && (
                <button onClick={() => setQuotationStatus(q, 'sent')} className="text-xs font-medium text-field-600">Mark sent</button>
              )}
              {(q.status === 'sent' || q.status === 'accepted') && (
                <button onClick={() => setConverting(q)} className="text-xs font-medium text-field-600 flex items-center gap-1">
                  Convert <ArrowRightCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {creating && business && activeBranchId && userId && (
        <CreateQuotationModal businessId={business.id} branchId={activeBranchId} userId={userId} taxRate={business.taxRate} onClose={() => setCreating(false)} />
      )}
      {converting && userId && (
        <ConvertModal quotation={converting} currency={currency} userId={userId} onClose={() => setConverting(null)} />
      )}
    </div>
  );
}

function CreateQuotationModal({ businessId, branchId, userId, taxRate, onClose }: { businessId: string; branchId: string; userId: string; taxRate: number; onClose: () => void }) {
  const products = useLiveQuery(() => db.products.where({ businessId, branchId }).toArray(), [businessId, branchId]) ?? [];
  const customers = useLiveQuery(() => db.customers.where('businessId').equals(businessId).toArray(), [businessId]) ?? [];
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<DocumentLineInput[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  function addLine() {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) => [...prev, { productId: product.id, description: product.name, quantity: parseFloat(qty) || 1, unitPrice: product.sellingPrice, discount: 0 }]);
    setProductId(''); setQty('1');
  }

  async function submit() {
    if (lines.length === 0) return;
    setSaving(true);
    try {
      await createQuotation({ businessId, branchId, userId, customerId: customerId || null, lines, taxRate });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">New quotation</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in / no customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="grid grid-cols-4 gap-2">
          <select className="input col-span-3" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input tnum" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <button onClick={addLine} className="btn-secondary text-sm w-full">Add line</button>
        {lines.length > 0 && (
          <div className="border border-slate-200 rounded-card divide-y divide-slate-100">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between px-3 py-2 text-sm">
                <span>{l.description} × {l.quantity}</span>
                <span className="tnum">{(l.unitPrice * l.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={submit} disabled={saving || lines.length === 0} className="btn-primary w-full">{saving ? 'Saving…' : 'Create quotation'}</button>
      </div>
    </div>
  );
}

function ConvertModal({ quotation, currency, userId, onClose }: { quotation: Quotation; currency: string; userId: string; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState(String(quotation.total));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null); setSaving(true);
    try {
      await convertQuotationToSale({ quotation, userId, paymentMethod: method, amountPaid: parseFloat(amountPaid) || 0 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert quotation');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Convert to sale</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500">Total: <span className="tnum font-medium text-ink">{money(quotation.total, currency)}</span></p>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Payment method</span>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="card">Card</option>
            <option value="bank">Bank</option><option value="credit">Credit</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Amount paid</span>
          <input className="input tnum" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
        </label>
        {error && <p className="text-sm text-rust-600">{error}</p>}
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? 'Converting…' : 'Convert to sale'}</button>
      </div>
    </div>
  );
}
