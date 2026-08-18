import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, ShoppingCart, Package, Users, Wallet, Truck, Receipt,
  Building2, RefreshCw, LogOut, WifiOff, RotateCcw, ListOrdered, Banknote,
  AlertOctagon, FileText, FileSpreadsheet, LifeBuoy, ShieldCheck, Store, Star
} from 'lucide-react';
import { BranchSwitcher } from './BranchSwitcher';
import { NotificationsBell } from './NotificationsBell';
import { useAuth } from '../../lib/auth';
import { useSyncStore } from '../../lib/sync';

const NAV_GROUPS: { label: string; items: { to: string; label: string; icon: any; end?: boolean }[] }[] = [
  { label: '', items: [{ to: '/', label: 'Dashboard', icon: LayoutGrid, end: true }] },
  {
    label: 'Sell',
    items: [
      { to: '/pos', label: 'POS', icon: ShoppingCart },
      { to: '/sales', label: 'Sales', icon: ListOrdered },
      { to: '/quotations', label: 'Quotations', icon: FileText },
      { to: '/invoices', label: 'Invoices', icon: FileSpreadsheet }
    ]
  },
  {
    label: 'Manage',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Package },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/debts', label: 'Debts', icon: Wallet },
      { to: '/refunds', label: 'Refunds', icon: RotateCcw },
      { to: '/corrections', label: 'Corrections', icon: AlertOctagon },
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/expenses', label: 'Expenses', icon: Receipt }
    ]
  },
  {
    label: 'Team',
    items: [
      { to: '/employee-payments', label: 'Employee Payments', icon: Banknote },
      { to: '/users', label: 'Users', icon: Users },
      { to: '/branches', label: 'Branches', icon: Building2 }
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/business-profile', label: 'Business Profile', icon: Store },
      { to: '/loyalty-settings', label: 'Loyalty Program', icon: Star },
      { to: '/support', label: 'Support', icon: LifeBuoy },
      { to: '/security', label: 'Security', icon: ShieldCheck }
    ]
  }
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

const MOBILE_NAV = ['/', '/pos', '/customers', '/debts'].map((path) => NAV.find((n) => n.to === path)!);

export function AppShell({ children }: { children: ReactNode }) {
  const { business, profile, signOut } = useAuth();
  const connection = useSyncStore((s) => s.connection);
  const pending = useSyncStore((s) => s.pendingCount);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-slate-200 bg-paper-raised">
        <div className="p-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-field-600 flex items-center justify-center text-white font-display font-semibold">S</div>
          <span className="font-display font-semibold text-lg">ShopOS</span>
        </div>
        <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{group.label}</div>}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium transition-colors ${
                        isActive ? 'bg-field-50 text-field-700' : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    <item.icon className="w-4.5 h-4.5" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <NavLink to="/sync" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-ink">
            <RefreshCw className="w-3.5 h-3.5" />
            {connection === 'syncing' ? 'Syncing…' : connection === 'offline' ? 'Offline' : pending > 0 ? `${pending} pending` : 'Synced'}
          </NavLink>
          <div className="px-3 py-2 text-xs text-slate-500 truncate">{profile?.fullName} · {profile?.role}</div>
          <button onClick={() => signOut()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-card">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 bg-paper-raised/95 backdrop-blur border-b border-slate-200 px-4 md:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="md:hidden w-7 h-7 rounded-lg bg-field-600 flex items-center justify-center text-white font-display font-semibold text-sm shrink-0">S</span>
            <span className="text-sm font-medium text-slate-500 hidden md:inline truncate">{business?.name}</span>
            <span className="hidden md:inline text-slate-300">/</span>
            <BranchSwitcher />
          </div>
          <div className="flex items-center gap-1">
            {connection === 'offline' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium mr-1">
                <WifiOff className="w-3.5 h-3.5" /> Offline
              </span>
            )}
            <NotificationsBell />
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper-raised border-t border-slate-200 flex items-stretch">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-field-600' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
