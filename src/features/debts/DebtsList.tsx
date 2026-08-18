import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { recordDebtPayment } from '../../lib/sales';
import type { Debt, PaymentMethod } from '../../lib/types';

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: Debt['status'] }) {
  const styles: Record<string, string> = {
    outstanding: 'bg-rust-50 text-rust-600',
    partial: 'bg-amber-100 text-amber-600',
    paid: 'bg-field-50 text-field-700',
    overdue: 'bg-rust-50 text-rust-600'
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>{status}</span>;
}

export function DebtsList() {
  const { business, userId, activeBranchId } = useAuth();
  const currency = business?.currency ?? 'KES';
  const businessId = business?.id;

  const debts = useLiveQuery(
    () => (businessId ? db.debts.where('businessId').equals(businessId).toArray() : []),
    [businessId]
  ) ?? [];
  const customers = useLiveQuery(
    () => (businessId ? db.customers.where('businessId').equals(businessId).toArray() : []),
    [businessId]
  ) ?? [];

  const [filter, setFilter] = useState<'all' | Debt['status']>('all');
  const [paying, setPaying] = useState<Debt | null>(null);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? 'Unknown customer';

  const filtered = useMemo(() => {
    return debts
      .filter((d) => filter === 'all' || d.status === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [debts, filter]);

  const totalOutstanding = debts.filter((d) => d.status !== 'paid').reduce((s, d) => s + d.remainingAmount, 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Debts</h1>
      <p className="text-sm text-slate-500 mb-4">Total outstanding: <span className="tnum font-medium text-rust-600">{money(totalOutstanding, currency)}</span></p>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {(['all', 'outstanding', 'partial', 'paid', 'overdue'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f ? 'bg-field-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-slate-100">
        {filtered.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No debts match this filter.</p>}
        {filtered.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{customerName(d.customerId)}</div>
              <div className="text-xs text-slate-500">{new Date(d.createdAt).toLocaleDateString()} · <StatusBadge status={d.status} /></div>
            </div>
            <div className="text-right shrink-0">
              <div className="tnum font-semibold">{money(d.remainingAmount, currency)}</div>
              <div className="text-xs text-slate-500 tnum">of {money(d.originalAmount, currency)}</div>
              {d.status !== 'paid' && (
                <button onClick={() => setPaying(d)} className="text-xs font-medium text-field-600 mt-1">Record payment</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {paying && userId && business && (
        <RecordPaymentModal
          debt={paying}
          currency={currency}
          businessId={business.id}
          branchId={activeBranchId ?? paying.branchId}
          userId={userId}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({
  debt, currency, businessId, branchId, userId, onClose
}: { debt: Debt; currency: string; businessId: string; branchId: string; userId: string; onClose: () => void }) {
  const [amount, setAmount] = useState(String(debt.remainingAmount));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await recordDebtPayment({ businessId, branchId, debt, amount: n, method, userId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Record payment</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500">Remaining balance: <span className="tnum font-medium text-ink">{money(debt.remainingAmount, currency)}</span></p>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Amount</span>
          <input className="input tnum" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Method</span>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
            <option value="other">Other</option>
          </select>
        </label>
        {error && <p className="text-sm text-rust-600">{error}</p>}
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Record payment'}</button>
      </div>
    </div>
  );
}
