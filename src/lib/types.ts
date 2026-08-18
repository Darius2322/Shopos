// Domain types used throughout the app. Field names here are camelCase —
// this is the ONLY place camelCase and Postgres snake_case ever meet is
// lib/sync.ts, via the explicit `mappers` table. Never let a raw Supabase
// row or a raw Dexie row leak past that boundary un-mapped.

export type Role = 'owner' | 'manager' | 'cashier' | 'inventory_manager' | 'accountant' | 'sales_staff';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  currency: string;
  taxRate: number;
  paymentInstructions?: string | null;
  receiptFooter?: string | null;
  status: 'active' | 'paused' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  code?: string | null;
  location?: string | null;
  phone?: string | null;
  managerId?: string | null;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  businessId: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  status: 'active' | 'paused' | 'suspended' | 'pending';
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  branchId: string;
  categoryId?: string | null;
  supplierId?: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  description?: string | null;
  unit: string;
  imageUrl?: string | null;
  buyingPrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;
  quantity: number;
  minStock: number;
  reorderLevel: number;
  expiryDate?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // local-only sync bookkeeping
  syncStatus?: SyncStatus;
  version?: number;
  deletedAt?: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  branchId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit: number;
  loyaltyRegistered: boolean;
  loyaltyPoints: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
  deletedAt?: string | null;
}

export type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'bank' | 'credit' | 'other';

export interface Sale {
  id: string;
  businessId: string;
  branchId: string;
  customerId?: string | null;
  userId: string;
  receiptNumber: string;
  status: 'completed' | 'cancelled' | 'refunded' | 'partially_refunded';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod: PaymentMethod;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
  deletedAt?: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  lineTotal: number;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface Debt {
  id: string;
  businessId: string;
  branchId: string;
  customerId: string;
  saleId?: string | null;
  receiptId?: string | null;
  userId?: string | null;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'outstanding' | 'partial' | 'paid' | 'overdue';
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
  deletedAt?: string | null;
}

export interface Payment {
  id: string;
  businessId: string;
  branchId: string;
  customerId?: string | null;
  saleId?: string | null;
  debtId?: string | null;
  direction: 'in' | 'out';
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  userId?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface Expense {
  id: string;
  businessId: string;
  branchId: string;
  category: string;
  amount: number;
  paymentMethod?: string | null;
  description?: string | null;
  userId?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
  version?: number;
  deletedAt?: string | null;
}

export interface AuditEntry {
  id: string;
  businessId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
}

export interface CartLine {
  product: Product;
  quantity: number;
  discount: number;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface PurchaseItemInput {
  productId: string;
  productName: string;
  quantity: number;
  buyingPrice: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  userId?: string | null;
  invoiceNumber?: string | null;
  total: number;
  amountPaid: number;
  amountOwed: number;
  paymentMethod?: string | null;
  status: 'paid' | 'partial' | 'credit';
  notes?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface Refund {
  id: string;
  businessId: string;
  branchId: string;
  saleId: string;
  customerId?: string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  totalAmount: number;
  refundMethod?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  processedAt?: string | null;
  notes?: string | null;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface RefundItem {
  id: string;
  refundId: string;
  saleItemId?: string | null;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  condition: 'resalable' | 'damaged' | 'expired';
}

export interface EmployeePayment {
  id: string;
  businessId: string;
  branchId: string;
  employeeId: string;
  paidBy?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  baseAmount: number;
  additions: number;
  deductions: number;
  advance: number;
  netAmount: number;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface CorrectionRequest {
  id: string;
  businessId: string;
  branchId: string;
  saleId?: string | null;
  requestedBy?: string | null;
  decidedBy?: string | null;
  problem: string;
  requestedCorrection: string;
  status: 'requested' | 'info_needed' | 'approved' | 'rejected';
  requestedAt: string;
  decidedAt?: string | null;
  resolutionNotes?: string | null;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface ProfilePermission {
  id: string; // synthetic `${profileId}:${permission}`, matches Postgres generated column
  profileId: string;
  permission: string;
  allowed: boolean;
  grantedBy?: string | null;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface DocumentLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quotation {
  id: string;
  businessId: string;
  branchId: string;
  customerId?: string | null;
  userId?: string | null;
  quotationNumber: string;
  status: QuotationStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
  convertedSaleId?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  businessId: string;
  branchId: string;
  customerId?: string | null;
  userId?: string | null;
  quotationId?: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
  version?: number;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface InvoicePaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  userId?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
}

export type NotificationType =
  | 'low_stock' | 'out_of_stock' | 'debt_limit' | 'new_debt' | 'payment_received'
  | 'invoice_overdue' | 'quotation_expiring' | 'refund_request' | 'correction_request' | 'sync_failed';

export interface AppNotification {
  id: string;
  businessId: string;
  branchId?: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  read: boolean;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  syncStatus?: SyncStatus;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  businessId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  subject: string;
  category: string;
  description: string;
  status: TicketStatus;
  appVersion?: string | null;
  deviceInfo?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorId?: string | null;
  isAdmin: boolean;
  message: string;
  createdAt: string;
  syncStatus?: SyncStatus;
}

/** The granular permission keys owners/managers can revoke per employee
 * (spec §40–41). Defaults come from role; entries here are overrides. */
export const PERMISSION_KEYS = [
  'sales.discount',
  'sales.cancel',
  'sales.price_override',
  'sales.refund',
  'sales.view_analytics',
  'inventory.adjust',
  'inventory.delete',
  'debts.view',
  'debts.override_limit',
  'customers.delete',
  'expenses.add'
] as const;
export type PermissionKey = typeof PERMISSION_KEYS[number];

export interface LoyaltySettingsRecord {
  businessId: string; // primary key, matches Postgres
  enabled: boolean;
  pointsPerAmount: number;
  amountPerPoint: number;
  minPurchase: number;
  countDiscount: boolean;
  countTax: boolean;
  syncStatus?: SyncStatus;
}
