import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X, Search } from 'lucide-react';
import { db, newRecordBase, enqueueSync } from '../../lib/db';
import { useAuth } from '../../lib/auth';

const FILTERS = ['all', 'low', 'out'] as const;

export function InventoryList() {
  const { business, activeBranchId } = useAuth();
  const currency = business?.currency ?? 'KES';
  const products = useLiveQuery(
    () => (business && activeBranchId ? db.products.where({ businessId: business.id, branchId: activeBranchId }).toArray() : []),
    [business?.id, activeBranchId]
  ) ?? [];

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    let list = products;
    if (filter === 'low') list = list.filter((p) => p.quantity > 0 && p.quantity <= p.minStock);
    if (filter === 'out') list = list.filter((p) => p.quantity <= 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    return list;
  }, [products, filter, query]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Add product
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="input pl-9" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs font-medium px-3 py-1.5 rounded-full ${filter === f ? 'bg-field-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {f === 'all' ? 'All' : f === 'low' ? 'Low stock' : 'Out of stock'}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Product</th>
              <th className="text-right font-medium px-4 py-2.5">Stock</th>
              <th className="text-right font-medium px-4 py-2.5 hidden sm:table-cell">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium truncate max-w-[220px]">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sku ?? '—'}</div>
                </td>
                <td className={`px-4 py-2.5 text-right tnum ${p.quantity <= 0 ? 'text-rust-600' : p.quantity <= p.minStock ? 'text-amber-600' : ''}`}>
                  {p.quantity} {p.unit}
                </td>
                <td className="px-4 py-2.5 text-right tnum hidden sm:table-cell">{currency} {p.sellingPrice.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="text-center text-sm text-slate-500 py-8">No products match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && business && activeBranchId && (
        <AddProductModal businessId={business.id} branchId={activeBranchId} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function AddProductModal({ businessId, branchId, onClose }: { businessId: string; branchId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [unit, setUnit] = useState('piece');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !sellingPrice) return;
    setSaving(true);
    try {
      const record = {
        ...newRecordBase(),
        businessId, branchId,
        categoryId: null, supplierId: null,
        name: name.trim(), sku: sku || null, barcode: null, brand: null, description: null,
        unit, imageUrl: null,
        buyingPrice: parseFloat(buyingPrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        wholesalePrice: null,
        quantity: parseFloat(quantity) || 0,
        minStock: parseFloat(minStock) || 0,
        reorderLevel: parseFloat(minStock) || 0,
        expiryDate: null,
        active: true
      };
      await db.products.add(record as any);
      await enqueueSync('products', record.id, 'create');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">Add product</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">SKU</span><input className="input" value={sku} onChange={(e) => setSku(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Selling price</span><input className="input tnum" type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} /></label>
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Buying price</span><input className="input tnum" type="number" value={buyingPrice} onChange={(e) => setBuyingPrice(e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Quantity</span><input className="input tnum" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="block"><span className="block text-sm font-medium text-slate-600 mb-1.5">Min stock</span><input className="input tnum" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Unit</span>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {['piece', 'box', 'carton', 'pack', 'dozen', 'bottle', 'kg', 'g', 'litre', 'ml', 'metre', 'set'].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <button onClick={submit} disabled={saving || !name.trim() || !sellingPrice} className="btn-primary w-full">{saving ? 'Saving…' : 'Add product'}</button>
      </div>
    </div>
  );
}
