import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { Login } from './features/auth/Login';
import { Dashboard } from './features/dashboard/Dashboard';
import { POS } from './features/pos/POS';
import { InventoryList } from './features/inventory/InventoryList';
import { CustomersList } from './features/customers/CustomersList';
import { DebtsList } from './features/debts/DebtsList';
import { BranchesList } from './features/branches/BranchesList';
import { SuppliersList } from './features/suppliers/SuppliersList';
import { ExpensesList } from './features/expenses/ExpensesList';
import { SyncCenter } from './features/settings/SyncCenter';
import { SalesList } from './features/sales/SalesList';
import { RefundsList } from './features/refunds/RefundsList';
import { UsersList } from './features/users/UsersList';
import { EmployeePayments } from './features/payroll/EmployeePayments';
import { CorrectionsList } from './features/corrections/CorrectionsList';
import { QuotationsList } from './features/quotations/QuotationsList';
import { InvoicesList } from './features/invoices/InvoicesList';
import { SupportCenter } from './features/support/SupportCenter';
import { Security } from './features/settings/Security';
import { BusinessProfile } from './features/settings/BusinessProfile';
import { LoyaltySettingsPage } from './features/settings/LoyaltySettingsPage';

export default function App() {
  const { loading, userId, bootstrap } = useAuth();

  useEffect(() => { bootstrap(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-sm text-slate-500">Loading ShopOS…</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/sales" element={<SalesList />} />
        <Route path="/inventory" element={<InventoryList />} />
        <Route path="/customers" element={<CustomersList />} />
        <Route path="/debts" element={<DebtsList />} />
        <Route path="/refunds" element={<RefundsList />} />
        <Route path="/corrections" element={<CorrectionsList />} />
        <Route path="/quotations" element={<QuotationsList />} />
        <Route path="/invoices" element={<InvoicesList />} />
        <Route path="/support" element={<SupportCenter />} />
        <Route path="/security" element={<Security />} />
        <Route path="/business-profile" element={<BusinessProfile />} />
        <Route path="/loyalty-settings" element={<LoyaltySettingsPage />} />
        <Route path="/suppliers" element={<SuppliersList />} />
        <Route path="/expenses" element={<ExpensesList />} />
        <Route path="/employee-payments" element={<EmployeePayments />} />
        <Route path="/users" element={<UsersList />} />
        <Route path="/branches" element={<BranchesList />} />
        <Route path="/sync" element={<SyncCenter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
