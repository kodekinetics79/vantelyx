import { useMemo, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { listLoginUsers, login } from '../services/authService';
import { getRoles } from '../services/securityService';
import { isApiModeEnabled } from '../services/apiClient';

type LoginProps = {
  onAuthenticated: () => void;
};

export default function Login({ onAuthenticated }: LoginProps) {
  const users = useMemo(() => listLoginUsers(), []);
  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    getRoles().forEach((role) => map.set(role.id, role.name));
    return map;
  }, []);

  const [busyId, setBusyId] = useState<string>('');
  const [error, setError] = useState('');

  const signIn = async (userId: string) => {
    setBusyId(userId);
    setError('');
    try {
      await login(userId);
      onAuthenticated();
    } catch {
      setError('Sign-in failed. Please try again.');
      setBusyId('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-4 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <ShieldCheck size={26} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Vantelyx CLM</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Sign in to the contract command center</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Choose a role to continue. {isApiModeEnabled
              ? 'A signed session token is requested from the API so write actions are authorized.'
              : 'Running in local demo mode (no backend token required).'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => signIn(user.id)}
              disabled={busyId !== ''}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 hover:shadow-glow disabled:opacity-60"
            >
              <div>
                <p className="font-black text-slate-900">{user.fullName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
                <p className="mt-2 inline-flex rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                  {roleNameById.get(user.roleId) ?? user.roleId}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
                {busyId === user.id ? 'Signing in…' : (<><LogIn size={15} /> Enter</>)}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">{error}</p>
        ) : null}

        <p className="mt-8 text-center text-xs text-slate-400">
          Demo sign-in for POC evaluation. Production replaces this with university SSO (SAML/OIDC).
        </p>
      </div>
    </div>
  );
}
