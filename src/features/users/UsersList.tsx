import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, X } from 'lucide-react';
import { db, enqueueSync } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import type { Profile, Role } from '../../lib/types';
import { PERMISSION_KEYS } from '../../lib/types';

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner', manager: 'Manager', cashier: 'Cashier',
  inventory_manager: 'Inventory Manager', accountant: 'Accountant', sales_staff: 'Sales Staff'
};

const STATUS_STYLES: Record<Profile['status'], string> = {
  active: 'bg-field-50 text-field-700',
  paused: 'bg-amber-100 text-amber-600',
  suspended: 'bg-rust-50 text-rust-600',
  pending: 'bg-slate-200 text-slate-600'
};

export function UsersList() {
  const { business, profile: myProfile } = useAuth();
  const canManage = myProfile?.role === 'owner';
  const profiles = useLiveQuery(
    () => (business ? db.profiles.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];
  const [selected, setSelected] = useState<Profile | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Users</h1>
      <div className="card divide-y divide-slate-100">
        {profiles.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No users yet.</p>}
        {profiles.map((p) => (
          <button key={p.id} onClick={() => setSelected(p)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-paper">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{p.fullName}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[p.role]}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>{p.status}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <UserProfileDrawer profile={selected} canManage={canManage} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function UserProfileDrawer({ profile, canManage, onClose }: { profile: Profile; canManage: boolean; onClose: () => void }) {
  const sales = useLiveQuery(() => db.sales.where('userId').equals(profile.id).toArray(), [profile.id]) ?? [];
  const totalSalesValue = sales.reduce((s, sale) => s + sale.total, 0);
  const [role, setRole] = useState<Role>(profile.role);
  const [status, setStatus] = useState<Profile['status']>(profile.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await db.profiles.update(profile.id, { role, status, updatedAt: new Date().toISOString() });
      await enqueueSync('profiles', profile.id, 'update');
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-paper-raised rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg">{profile.fullName}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="card p-3"><div className="text-xs text-slate-500">Transactions</div><div className="tnum font-semibold">{sales.length}</div></div>
          <div className="card p-3"><div className="text-xs text-slate-500">Sales value</div><div className="tnum font-semibold">{totalSalesValue.toLocaleString()}</div></div>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!canManage}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-600 mb-1.5">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Profile['status'])} disabled={!canManage}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>

        {!canManage && <p className="text-xs text-slate-400">Only the business owner can change role or status.</p>}
        {canManage && (
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save changes'}</button>
        )}

        {canManage && profile.role !== 'owner' && <PermissionsEditor profileId={profile.id} grantedBy={profile.id} />}
      </div>
    </div>
  );
}

function PermissionsEditor({ profileId }: { profileId: string; grantedBy?: string }) {
  const { userId } = useAuth();
  const overrides = useLiveQuery(
    () => db.profilePermissions.where('profileId').equals(profileId).toArray(),
    [profileId]
  ) ?? [];

  function isAllowed(key: string): boolean | null {
    const row = overrides.find((o) => o.permission === key);
    return row ? row.allowed : null; // null = using role default
  }

  async function toggle(key: string) {
    const current = isAllowed(key);
    const nextAllowed = current === false ? true : current === true ? false : false; // default -> revoke -> restore
    const id = `${profileId}:${key}`;
    await db.profilePermissions.put({
      id, profileId, permission: key, allowed: nextAllowed,
      grantedBy: userId ?? null, updatedAt: new Date().toISOString(), syncStatus: 'pending'
    });
    await enqueueSync('profilePermissions', id, 'update');
  }

  return (
    <div className="pt-2 border-t border-slate-100">
      <h4 className="text-sm font-medium mb-2">Permission overrides</h4>
      <p className="text-xs text-slate-500 mb-2.5">Tap to revoke a permission this role normally has. Enforced server-side via RLS, not just hidden in the UI.</p>
      <div className="space-y-1.5">
        {PERMISSION_KEYS.map((key) => {
          const allowed = isAllowed(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-card border border-slate-200 text-sm"
            >
              <span className="font-mono text-xs">{key}</span>
              <span className={`text-xs font-medium ${allowed === false ? 'text-rust-600' : 'text-field-600'}`}>
                {allowed === false ? 'Revoked' : 'Allowed'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
