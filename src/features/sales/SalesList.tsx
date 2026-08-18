import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db, newRecordBase, enqueueSync } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { requestRefund } from '../../lib/refunds';
import type { Sale } from '../../lib/types';

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SalesList() {
  const { business, activeBranchId } = useAuth();
  const currency = business?.currency ?? 'KES';
  const sales = useLiveQuery(
    () => (business ? db.sales.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];
  const [refunding, setRefunding] = useState<Sale | null>(null);
  const [correcting, setCorrecting] = useState<Sale | null>(null);

  const scoped = (activeBranchId ? sales.filter((s) => s.branchId === activeBranchId) : sales)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Sales</h1>
      <div className="card divide-y divide-slate-100">
        {scoped.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No sales yet.</p>}
        {scoped.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.receiptNumber}</div>
              <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()} · {s.paymentMethod} · {s.status}</div>
            </div>
            <div className="text-right shrink-0 flex items-center gap-3">
              <div className="tnum font-medium">{money(s.total, currency)}</div>
              {s.status === 'completed' && (
                <div className="flex gap-2">
                  <button onClick={() => setCorrecting(s)} className="text-xs font-medium text-amber-600">Correction</button>
                  <button onClick={() => setRefunding(s)} className="text-xs font-medium text-rust-600">Refund</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {refunding && business && (
        <RequestRefundModal sale={refunding} businessId={business.id} currency={currency} onClose={() => setRefunding(null)} />
      )}
      {correcting && business && (
        <RequestCorrectionModal sale={correcting} businessId={business.id} onClose={() => setCorrecting(null)} />
      )}
    </div>
  );
}

const CORRECTION_PROBLEMS = [
  'Wrong product', 'Wrong quantity', 'Wrong price', 'Wrong customer',
  'Wrong payment method', 'Wrong discount', 'Wrong debt', 'Duplicate sale', 'Other'
];

function RequestCorrectionModal({ sale, businessId, onClose }: { sale: Sale; businessId: string; onClose: () => void }) {
  const { userId } = useAuth();
  const [problem, setProblem] = useState('');
  const [correction, setCorrection] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!userId || !problem || !correction.trim()) return;
    setSaving(true);
    try {
      const record = {
        ...newRecordBase(),
        businessId, branchId: sale.branchId, saleId: sale.id,
        requestedBy: userId, decidedBy: null,
        problem, requestedCorrection: correction.trim(),
        status: 'requested' as const,
        requestedAt: new Date().toISOString(), decidedAt: null, resolutionNotes: null
      };
      await db.correctionRequests.add(record as any);
      await enqueueSync('correctionRequests', record.id, 'create');
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Request correction — {sale.receiptNumber}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500">This never edits the sale directly — a manager or owner reviews and applies the fix.</p>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">What went wrong</span>
          <select className="input" value={problem} onChange={(e) => setProblem(e.target.value)}>
            <option value="">Select…</option>
            {CORRECTION_PROBLEMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">What should it be instead?</span>
          <textarea className="input min-h-20" value={correction} onChange={(e) => setCorrection(e.target.value)} />
        </label>
        <button onClick={submit} disabled={saving || !problem || !correction.trim()} className="btn-primary w-full">
          {saving ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </div>
  );
}

function RequestRefundModal({ sale, businessId, currency, onClose }: { sale: Sale; businessId: string; currency: string; onClose: () => void }) {
  const { userId } = useAuth();
  const items = useLiveQuery(() => db.saleItems.where('saleId').equals(sale.id).toArray(), [sale.id]) ?? [];
  const [selected, setSelected] = useState<Record<string, { quantity: number; condition: 'resalable' | 'damaged' | 'expired' }>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, maxQty: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { quantity: maxQty, condition: 'resalable' };
      return next;
    });
  }

  async function submit() {
    if (!userId || !reason.trim() || Object.keys(selected).length === 0) return;
    setError(null); setSaving(true);
    try {
      await requestRefund({
        businessId,
        branchId: sale.branchId,
        sale,
        requestedBy: userId,
        reason: reason.trim(),
        items: items
          .filter((i) => selected[i.id])
          .map((i) => ({
            saleItemId: i.id,
            productId: i.productId,
            quantity: selected[i.id].quantity,
            unitPrice: i.unitPrice,
            condition: selected[i.id].condition
          }))
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit refund request');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Request refund — {sale.receiptNumber}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500">Select items to refund. This creates a request for manager/owner approval — nothing changes until then.</p>

        <div className="space-y-2">
          {items.map((i) => (
            <label key={i.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-card">
              <span className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!selected[i.id]} onChange={() => toggle(i.id, i.quantity)} />
                {i.productName} × {i.quantity}
              </span>
              <span className="tnum text-sm text-slate-500">{money(i.lineTotal, currency)}</span>
            </label>
          ))}
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Reason</span>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            <option>Defective product</option>
            <option>Wrong product</option>
            <option>Wrong quantity</option>
            <option>Duplicate transaction</option>
            <option>Customer return</option>
            <option>Damaged product</option>
            <option>Incorrect price</option>
            <option>Other authorized reason</option>
          </select>
        </label>

        {error && <p className="text-sm text-rust-600">{error}</p>}
        <button onClick={submit} disabled={saving || !reason || Object.keys(selected).length === 0} className="btn-primary w-full">
          {saving ? 'Submitting…' : 'Submit refund request'}
        </button>
      </div>
    </div>
  );
}
