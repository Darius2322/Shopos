import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { biometricsSupported, isBiometricEnabled, enableBiometric, disableBiometric } from '../../lib/webauthn';

export function Security() {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [supported] = useState(biometricsSupported());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { isBiometricEnabled().then(setEnabled); }, []);

  async function toggle() {
    setError(null); setBusy(true);
    try {
      if (enabled) {
        await disableBiometric();
        setEnabled(false);
      } else {
        await enableBiometric(profile?.fullName ?? 'ShopOS user');
        setEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update biometric setting');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">Security</h1>
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-field-50 text-field-600 flex items-center justify-center shrink-0">
            <Fingerprint className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Biometric confirmation</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Use your device's fingerprint or face unlock to confirm sensitive actions like refund approvals.
              This is a device-level check, not a replacement for your password sign-in.
            </p>
            {!supported && <p className="text-xs text-amber-600 mt-2">Not supported on this device or browser.</p>}
            {error && <p className="text-xs text-rust-600 mt-2">{error}</p>}
            <button onClick={toggle} disabled={!supported || busy} className={enabled ? 'btn-secondary text-sm mt-3' : 'btn-primary text-sm mt-3'}>
              {busy ? 'Please wait…' : enabled ? 'Disable' : 'Enable biometric confirmation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
