import { db, newRecordBase, enqueueSync } from './db';
import { completeSale } from './sales';
import type { DocumentLineInput, Quotation, QuotationItem, Invoice, InvoiceItem, PaymentMethod } from './types';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function totals(lines: DocumentLineInput[], taxRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0));
  const discount = round2(lines.reduce((s, l) => s + l.discount, 0));
  const tax = taxRate ? round2(subtotal * (taxRate / 100)) : 0;
  const total = round2(subtotal + tax);
  return { subtotal, discount, tax, total };
}

async function nextDocNumber(businessId: string, prefix: string, count: number) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
}

export interface CreateQuotationInput {
  businessId: string;
  branchId: string;
  userId: string;
  customerId?: string | null;
  lines: DocumentLineInput[];
  taxRate: number;
  validUntil?: string | null;
  notes?: string;
  terms?: string;
}

export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
  if (input.lines.length === 0) throw new Error('A quotation needs at least one line item');
  const { subtotal, discount, tax, total } = totals(input.lines, input.taxRate);
  const count = await db.quotations.where('businessId').equals(input.businessId).count();
  const quotationNumber = await nextDocNumber(input.businessId, 'QT', count);

  const quotation: Quotation = {
    ...newRecordBase(),
    businessId: input.businessId,
    branchId: input.branchId,
    customerId: input.customerId ?? null,
    userId: input.userId,
    quotationNumber,
    status: 'draft',
    subtotal, discount, tax, total,
    validUntil: input.validUntil ?? null,
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    convertedSaleId: null
  } as Quotation;

  await db.transaction('rw', [db.quotations, db.quotationItems, db.syncQueue], async () => {
    await db.quotations.add(quotation);
    await enqueueSync('quotations', quotation.id, 'create');
    for (const line of input.lines) {
      const item: QuotationItem = {
        id: crypto.randomUUID(),
        quotationId: quotation.id,
        productId: line.productId ?? null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        lineTotal: round2(line.unitPrice * line.quantity - line.discount)
      };
      await db.quotationItems.add(item);
      await enqueueSync('quotationItems', item.id, 'create');
    }
  });

  return quotation;
}

export async function setQuotationStatus(quotation: Quotation, status: Quotation['status']) {
  await db.quotations.update(quotation.id, { status, updatedAt: new Date().toISOString(), syncStatus: 'pending' });
  await enqueueSync('quotations', quotation.id, 'update');
}

export interface ConvertQuotationToSaleInput {
  quotation: Quotation;
  userId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
}

/** Converts an accepted quotation straight into a completed sale, reusing
 * the same debt-safe completeSale() path — a converted quotation is never
 * a separate, looser code path that could reintroduce the debt bug. */
export async function convertQuotationToSale(input: ConvertQuotationToSaleInput) {
  const items = await db.quotationItems.where('quotationId').equals(input.quotation.id).toArray();
  const lines = [];
  for (const item of items) {
    if (!item.productId) continue; // service lines with no linked product can't deduct stock
    const product = await db.products.get(item.productId);
    if (!product) continue;
    lines.push({ product, quantity: item.quantity, discount: item.discount });
  }
  if (lines.length === 0) throw new Error('Quotation has no sellable product lines to convert');

  const result = await completeSale({
    businessId: input.quotation.businessId,
    branchId: input.quotation.branchId,
    userId: input.userId,
    customerId: input.quotation.customerId,
    lines,
    taxRate: 0, // quotation already includes its own tax total; avoid double-taxing
    paymentMethod: input.paymentMethod,
    amountPaid: input.amountPaid
  });

  await db.quotations.update(input.quotation.id, {
    status: 'converted', convertedSaleId: result.sale.id,
    updatedAt: new Date().toISOString(), syncStatus: 'pending'
  });
  await enqueueSync('quotations', input.quotation.id, 'update');

  return result;
}

export interface CreateInvoiceInput {
  businessId: string;
  branchId: string;
  userId: string;
  customerId?: string | null;
  quotationId?: string | null;
  lines: DocumentLineInput[];
  taxRate: number;
  dueDate?: string | null;
  notes?: string;
  terms?: string;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  if (input.lines.length === 0) throw new Error('An invoice needs at least one line item');
  const { subtotal, discount, tax, total } = totals(input.lines, input.taxRate);
  const count = await db.invoices.where('businessId').equals(input.businessId).count();
  const invoiceNumber = await nextDocNumber(input.businessId, 'INV', count);

  const invoice: Invoice = {
    ...newRecordBase(),
    businessId: input.businessId,
    branchId: input.branchId,
    customerId: input.customerId ?? null,
    userId: input.userId,
    quotationId: input.quotationId ?? null,
    invoiceNumber,
    status: 'draft',
    subtotal, discount, tax, total,
    amountPaid: 0,
    balance: total,
    dueDate: input.dueDate ?? null,
    notes: input.notes ?? null,
    terms: input.terms ?? null
  } as Invoice;

  await db.transaction('rw', [db.invoices, db.invoiceItems, db.syncQueue], async () => {
    await db.invoices.add(invoice);
    await enqueueSync('invoices', invoice.id, 'create');
    for (const line of input.lines) {
      const item: InvoiceItem = {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        productId: line.productId ?? null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        lineTotal: round2(line.unitPrice * line.quantity - line.discount)
      };
      await db.invoiceItems.add(item);
      await enqueueSync('invoiceItems', item.id, 'create');
    }
  });

  return invoice;
}

/** Records a payment against an invoice — same non-negotiable rule as debts:
 * balance = total - amountPaid, guarded against overpayment. */
export async function recordInvoicePayment(invoice: Invoice, amount: number, method: string, userId?: string) {
  if (amount <= 0) throw new Error('Payment amount must be positive');
  if (amount > invoice.balance) throw new Error(`Payment exceeds outstanding balance of ${invoice.balance}`);

  const amountPaid = round2(invoice.amountPaid + amount);
  const balance = round2(invoice.total - amountPaid);
  const status = balance <= 0 ? 'paid' : 'partially_paid';

  await db.transaction('rw', [db.invoices, db.invoicePayments, db.syncQueue], async () => {
    await db.invoices.put({ ...invoice, amountPaid, balance, status, updatedAt: new Date().toISOString(), syncStatus: 'pending' });
    await enqueueSync('invoices', invoice.id, 'update');
    const payment = { id: crypto.randomUUID(), invoiceId: invoice.id, amount, method, userId: userId ?? null, createdAt: new Date().toISOString() };
    await db.invoicePayments.add(payment as any);
    await enqueueSync('invoicePayments', payment.id, 'create');
  });
}
