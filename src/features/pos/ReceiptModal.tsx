import { useLiveQuery } from 'dexie-react-hooks';
import { X, Printer, Share2 } from 'lucide-react';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';

function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptModal({ saleId, pointsEarned, onClose }: { saleId: string; pointsEarned?: number; onClose: () => void }) {
  const { business, profile } = useAuth();
  const currency = business?.currency ?? 'KES';
  const sale = useLiveQuery(() => db.sales.get(saleId), [saleId]);
  const items = useLiveQuery(() => db.saleItems.where('saleId').equals(saleId).toArray(), [saleId]) ?? [];
  const customer = useLiveQuery(
    () => (sale?.customerId ? db.customers.get(sale.customerId) : undefined),
    [sale?.customerId]
  );

  if (!sale) return null;

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const text = buildShareText();
    if (navigator.share) {
      try { await navigator.share({ title: `Receipt ${sale!.receiptNumber}`, text }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  function buildShareText() {
    if (!sale) return '';
    const lines = items.map((i) => `${i.productName} x${i.quantity} — ${money(i.lineTotal, currency)}`);
    return [
      `${business?.name ?? 'ShopOS'} — Receipt ${sale.receiptNumber}`,
      new Date(sale.createdAt).toLocaleString(),
      '',
      ...lines,
      '',
      `Total: ${money(sale.total, currency)}`,
      `Paid: ${money(sale.amountPaid, currency)} (${sale.paymentMethod})`,
      sale.balanceDue > 0 ? `Balance due: ${money(sale.balanceDue, currency)}` : 'Paid in full',
    ].join('\n');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center print:static print:block">
      <div className="absolute inset-0 bg-ink/40 print:hidden" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl overflow-hidden print:rounded-none print:shadow-none print:max-w-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 print:hidden">
          <h3 className="font-display font-semibold">Receipt</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 font-mono text-xs space-y-3" id="receipt-content">
          <div className="text-center space-y-0.5 mb-2">
            <div className="font-display font-semibold text-sm">{business?.name ?? 'ShopOS'}</div>
            {business?.address && <div className="text-slate-500">{business.address}</div>}
            {business?.phone && <div className="text-slate-500">{business.phone}</div>}
          </div>
          <div className="flex justify-between text-slate-500">
            <span>{sale.receiptNumber}</span>
            <span>{new Date(sale.createdAt).toLocaleString()}</span>
          </div>
          {customer && <div className="text-slate-500">Customer: {customer.name}{customer.phone ? ` (${customer.phone})` : ''}</div>}

          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="truncate pr-2">{i.productName} ×{i.quantity}</span>
                <span className="tnum shrink-0">{i.lineTotal.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span className="tnum">{sale.subtotal.toLocaleString()}</span></div>
            {sale.tax > 0 && <div className="flex justify-between"><span>Tax</span><span className="tnum">{sale.tax.toLocaleString()}</span></div>}
            <div className="flex justify-between font-semibold"><span>Total</span><span className="tnum">{sale.total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Paid ({sale.paymentMethod})</span><span className="tnum">{sale.amountPaid.toLocaleString()}</span></div>
            {sale.balanceDue > 0 && (
              <div className="flex justify-between font-semibold text-rust-600"><span>Balance due</span><span className="tnum">{sale.balanceDue.toLocaleString()}</span></div>
            )}
          </div>

          <div className="text-center text-slate-500 pt-2 border-t border-dashed border-slate-300">
            Served by {profile?.fullName ?? '—'}
            {business?.receiptFooter && <div className="mt-1">{business.receiptFooter}</div>}
          </div>

          {customer && (
            customer.loyaltyRegistered ? (
              (pointsEarned ?? 0) > 0 && (
                <div className="text-center border-t border-dashed border-slate-300 pt-2">
                  <div>Loyalty points earned: {pointsEarned}</div>
                  <div>Current points balance: {customer.loyaltyPoints}</div>
                </div>
              )
            ) : (
              <div className="text-center border-t border-dashed border-slate-300 pt-2 text-slate-400">
                Join the loyalty program to earn points on future purchases.
              </div>
            )
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100 print:hidden">
          <button onClick={handlePrint} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleShare} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
