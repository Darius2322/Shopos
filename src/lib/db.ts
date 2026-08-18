import Dexie, { Table } from 'dexie';
import type {
  Business, Branch, Profile, Product, Customer, Sale, SaleItem,
  Debt, Payment, Expense, AuditEntry, Supplier, Purchase, Refund,
  RefundItem, EmployeePayment, CorrectionRequest, ProfilePermission,
  Quotation, QuotationItem, Invoice, InvoiceItem, InvoicePaymentRecord,
  AppNotification, SupportTicket, LoyaltySettingsRecord, SupportTicketReply
} from './types';

export interface SyncQueueItem {
  id: string;
  entity: string;       // table name, e.g. 'debts'
  entityId: string;
  op: 'create' | 'update' | 'delete';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

// Local-only session/context — which business/branch/user is active.
export interface AppContextRow {
  key: string; // singleton row, key = 'current'
  businessId?: string;
  branchId?: string;
  userId?: string;
}

class ShopOSDB extends Dexie {
  businesses!: Table<Business, string>;
  branches!: Table<Branch, string>;
  profiles!: Table<Profile, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  debts!: Table<Debt, string>;
  payments!: Table<Payment, string>;
  expenses!: Table<Expense, string>;
  auditLog!: Table<AuditEntry, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  refunds!: Table<Refund, string>;
  refundItems!: Table<RefundItem, string>;
  employeePayments!: Table<EmployeePayment, string>;
  correctionRequests!: Table<CorrectionRequest, string>;
  profilePermissions!: Table<ProfilePermission, string>;
  quotations!: Table<Quotation, string>;
  quotationItems!: Table<QuotationItem, string>;
  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  invoicePayments!: Table<InvoicePaymentRecord, string>;
  notifications!: Table<AppNotification, string>;
  supportTickets!: Table<SupportTicket, string>;
  supportTicketReplies!: Table<SupportTicketReply, string>;
  loyaltySettings!: Table<LoyaltySettingsRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  appContext!: Table<AppContextRow, string>;

  constructor() {
    super('shopos');
    this.version(1).stores({
      businesses: 'id, ownerId',
      branches: 'id, businessId',
      profiles: 'id, businessId',
      products: 'id, businessId, branchId, barcode, sku, [businessId+branchId]',
      customers: 'id, businessId, branchId, phone',
      sales: 'id, businessId, branchId, customerId, receiptNumber, createdAt',
      saleItems: 'id, saleId, productId',
      debts: 'id, businessId, branchId, customerId, saleId, status',
      payments: 'id, businessId, branchId, customerId, saleId, debtId',
      expenses: 'id, businessId, branchId, createdAt',
      auditLog: 'id, businessId, branchId, createdAt',
      syncQueue: 'id, entity, attempts, createdAt',
      appContext: 'key'
    });
    this.version(2).stores({
      suppliers: 'id, businessId, status',
      purchases: 'id, businessId, branchId, supplierId, createdAt',
      refunds: 'id, businessId, branchId, saleId, status',
      refundItems: 'id, refundId, productId',
      employeePayments: 'id, businessId, branchId, employeeId, createdAt'
    });
    this.version(3).stores({
      correctionRequests: 'id, businessId, branchId, saleId, status',
      profilePermissions: 'id, profileId'
    });
    this.version(4).stores({
      quotations: 'id, businessId, branchId, customerId, status, quotationNumber',
      quotationItems: 'id, quotationId',
      invoices: 'id, businessId, branchId, customerId, status, invoiceNumber',
      invoiceItems: 'id, invoiceId',
      invoicePayments: 'id, invoiceId',
      notifications: 'id, businessId, userId, read, createdAt',
      supportTickets: 'id, businessId, userId, status, createdAt'
    });
    this.version(5).stores({
      loyaltySettings: 'businessId'
    });
    this.version(6).stores({
      supportTicketReplies: 'id, ticketId, createdAt'
    });
  }
}

export const db = new ShopOSDB();

/** Every locally-created record shares this base: stable client-generated
 * uuid (safe for idempotent sync), version counter, and sync bookkeeping. */
export function newRecordBase() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    syncStatus: 'pending' as const
  };
}

export async function enqueueSync(entity: string, entityId: string, op: 'create' | 'update' | 'delete') {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    entity,
    entityId,
    op,
    attempts: 0,
    createdAt: new Date().toISOString()
  });
}
