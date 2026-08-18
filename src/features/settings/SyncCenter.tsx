import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { db } from '../../lib/db';
import { runSync, retryFailed, useSyncStore } from '../../lib/sync';
import { backendConfigured } from '../../lib/supabase';

export function SyncCenter() {
  const { connection, lastSyncAt, lastError, pendingCount, failedCount } = useSyncStore();
  const queue = useLiveQuery(() => db.syncQueue.orderBy('createdAt').reverse().toArray(), []) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Sync Center</h1>

      {!backendConfigured() && (
        <div className="card p-4 mb-4 bg-amber-50 border-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700">No cloud backend connected yet</p>
            <p className="text-slate-600 mt-0.5">Every sale, payment and change is being saved locally and will sync once Supabase is configured.</p>
          </div>
        </div>
      )}

      <div className="card p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-slate-500 text-xs">Status</div><div className="font-medium capitalize">{connection}</div></div>
        <div><div className="text-slate-500 text-xs">Last synced</div><div className="font-medium">{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}</div></div>
        <div><div className="text-slate-500 text-xs">Pending</div><div className="font-medium tnum">{pendingCount}</div></div>
        <div><div className="text-slate-500 text-xs">Failed</div><div className="font-medium tnum text-rust-600">{failedCount}</div></div>
      </div>

      {lastError && <p className="text-sm text-rust-600 mb-4">{lastError}</p>}

      <div className="flex gap-2 mb-6">
        <button onClick={() => runSync()} className="btn-primary flex items-center gap-1.5 text-sm">
          <RefreshCw className="w-4 h-4" /> Sync now
        </button>
        {failedCount > 0 && (
          <button onClick={() => retryFailed()} className="btn-secondary text-sm">Retry failed ({failedCount})</button>
        )}
      </div>

      <h2 className="font-display font-semibold mb-2 text-sm">Queue</h2>
      <div className="card divide-y divide-slate-100">
        {queue.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Nothing queued.</p>}
        {queue.slice(0, 30).map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <div>
              <div className="font-medium">{item.entity} · {item.op}</div>
              {item.lastError && <div className="text-xs text-rust-600 truncate max-w-[220px]">{item.lastError}</div>}
            </div>
            <div className="text-xs text-slate-500 tnum">{item.attempts > 0 ? `${item.attempts} attempts` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
