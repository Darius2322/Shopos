import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { backendConfigured } from '../../lib/supabase';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-field-600 flex items-center justify-center text-white font-display font-semibold text-xl mb-3">S</div>
          <h1 className="font-display font-semibold text-2xl">ShopOS</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your business</p>
        </div>

        {!backendConfigured() && (
          <div className="card p-3.5 mb-4 bg-amber-50 border-amber-200 text-sm text-amber-700">
            No backend configured. Set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono text-xs">.env</code>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-5 space-y-3.5">
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1.5">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 mb-1.5">Password</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="text-sm text-rust-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
