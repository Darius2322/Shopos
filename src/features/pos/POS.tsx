import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, Minus, Trash2, UserPlus } from 'lucide-react';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { completeSale, customerOutstandingDebt } from '../../lib/sales';
import { ReceiptModal } from './ReceiptModal';
import type { CartLine, PaymentMethod } from '../../lib/types';

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'mpesa', label: 'M-Pesa' },
  { key: 'card', label: 'Card' },
  { key: 'bank', label: 'Bank' },
  { key: 'credit', label: 'Credit / Debt' },
  { key: 'other', label: 'Other' }
];

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function POS() {
  const { business, branches, activeBranchId, profile, userId } = useAuth();
  const branch = branches.find((b) => b.id === activeBranchId) ?? branches[0];
  const currency = business?.currency ?? 'KES';

  const products = useLiveQuery(
    () => (branch ? db.products.where({ businessId: business!.id, branchId: branch.id }).toArray() : []),
    [branch?.id]
  ) ?? [];
  const customers = useLiveQuery(
    () => (business ? db.customers.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];

  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptPoints, setReceiptPoints] = useState(0);
  const [debtWarning, setDebtWarning] = useState<{ overBy: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [products, query]);

  const subtotal = cart.reduce((s, l) => s + l.product.sellingPrice * l.quantity - l.discount, 0);
  const tax = business?.taxRate ? +(subtotal * (business.taxRate / 100)).toFixed(2) : 0;
  const total = +(subtotal + tax).toFixed(2);
  const amountPaid = method === 'credit' ? (amountText === '' ? 0 : parseFloat(amountText) || 0) : (amountText === '' ? total : parseFloat(amountText) || 0);
  const balanceDue = +(total - amountPaid).toFixed(2);

  function addProduct(p: typeof products[number]) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.quantity) return prev;
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (p.quantity < 1) return prev;
      return [...prev, { product: p, quantity: 1, discount: 0 }];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  }
  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }

  async function checkCreditLimit() {
    setDebtWarning(null);
    if (method !== 'credit' || !customerId || balanceDue <= 0) return;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer || customer.creditLimit <= 0) return;
    const outstanding = await customerOutstandingDebt(customerId);
    const projected = outstanding + balanceDue;
    if (projected > customer.creditLimit) {
      setDebtWarning({ overBy: +(projected - customer.creditLimit).toFixed(2) });
    }
  }

  async function handleCompleteSale() {
    if (!business || !branch || !userId || cart.length === 0) return;
    setError(null);
    await checkCreditLimit();
    setSubmitting(true);
    try {
      const result = await completeSale({
        businessId: business.id,
        branchId: branch.id,
        userId,
        customerId,
        lines: cart,
        taxRate: business.taxRate,
        paymentMethod: method,
        amountPaid,
        note: note || undefined
      });
      setReceiptSaleId(result.sale.id);
      setReceiptPoints(result.pointsEarned);
      setCart([]);
      setCustomerId(null);
      setAmountText('');
      setNote('');
      setMethod('cash');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete sale');
    } finally {
      setSubmitting(false);
    }
  }

  if (!branch) {
    return <div className="p-6 text-sm text-slate-500">No branch selected. Choose a branch from the header first.</div>;
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-49px)]">
      {/* Product picker */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0">
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9"
            placeholder="Search product name, SKU, or scan barcode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              disabled={p.quantity <= 0}
              className="card p-3 text-left hover:border-field-500 transition-colors disabled:opacity-40"
            >
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{p.quantity} {p.unit} left</div>
              <div className="tnum text-sm font-semibold mt-1.5">{money(p.sellingPrice, currency)}</div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-slate-500 col-span-full text-center py-10">No products match.</p>}
        </div>
      </div>

      {/* Cart / checkout */}
      <div className="w-full md:w-96 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 bg-paper-raised flex flex-col p-4 md:p-5">
        <h2 className="font-display font-semibold mb-3">Current sale</h2>
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[120px]">
          {cart.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Cart is empty.</p>}
          {cart.map((line) => (
            <div key={line.product.id} className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{line.product.name}</div>
                <div className="text-xs text-slate-500 tnum">{money(line.product.sellingPrice, currency)} × {line.quantity}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => changeQty(line.product.id, -1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                <span className="w-5 text-center text-sm tnum">{line.quantity}</span>
                <button onClick={() => changeQty(line.product.id, 1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                <button onClick={() => removeLine(line.product.id)} className="w-6 h-6 rounded-full bg-rust-50 text-rust-600 flex items-center justify-center ml-1"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>

        <label className="block mb-2">
          <span className="block text-xs font-medium text-slate-600 mb-1">Customer {method === 'credit' && <span className="text-rust-600">(required for credit)</span>}</span>
          <select className="input" value={customerId ?? ''} onChange={(e) => setCustomerId(e.target.value || null)}>
            <option value="">Walk-in customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => { setMethod(m.key); setAmountText(''); }}
              className={`text-xs font-medium py-2 rounded-card border ${method === m.key ? 'bg-field-50 border-field-500 text-field-700' : 'border-slate-200 text-slate-600'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Amount paid ({currency})</span>
          <input
            className="input tnum"
            type="number"
            inputMode="decimal"
            placeholder={method === 'credit' ? '0 (full credit)' : total.toFixed(2)}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={checkCreditLimit}
          />
        </label>

        <div className="space-y-1 text-sm mb-3 tnum">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
          {tax > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{money(tax, currency)}</span></div>}
          <div className="flex justify-between font-semibold text-base pt-1 border-t border-slate-100"><span>Total</span><span>{money(total, currency)}</span></div>
          {balanceDue > 0 && (
            <div className="flex justify-between text-rust-600 font-medium"><span>Balance due (debt)</span><span>{money(balanceDue, currency)}</span></div>
          )}
        </div>

        {debtWarning && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-card p-2.5 mb-3">
            Customer debt limit reached — over by {money(debtWarning.overBy, currency)}. An owner or manager must confirm to proceed.
          </div>
        )}
        {error && <p className="text-sm text-rust-600 mb-2">{error}</p>}

        <button
          onClick={handleCompleteSale}
          disabled={submitting || cart.length === 0}
          className="btn-primary w-full sticky bottom-0"
        >
          {submitting ? 'Completing sale…' : `Complete sale · ${money(total, currency)}`}
        </button>
      </div>

      {receiptSaleId && <ReceiptModal saleId={receiptSaleId} pointsEarned={receiptPoints} onClose={() => setReceiptSaleId(null)} />}
    </div>
  );
}
