import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin } from 'lucide-react';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export function BranchesList() {
  const { business, profile } = useAuth();
  const branches = useLiveQuery(
    () => (business ? db.branches.where('businessId').equals(business.id).toArray() : []),
    [business?.id]
  ) ?? [];
  const canManage = profile?.role === 'owner';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Branches</h1>
      <div className="card divide-y divide-slate-100">
        {branches.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No branches yet.</p>}
        {branches.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-field-50 text-field-600 flex items-center justify-center shrink-0">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{b.name} {b.status === 'paused' && <span className="text-xs text-amber-600 font-normal">· Paused</span>}</div>
              <div className="text-xs text-slate-500">{b.location ?? 'No location set'}{b.code ? ` · ${b.code}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
      {!canManage && (
        <p className="text-xs text-slate-400 mt-3">Only owners can add branches or assign managers in this build.</p>
      )}
    </div>
  );
}
