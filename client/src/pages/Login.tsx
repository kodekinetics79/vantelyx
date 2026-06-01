import { useMemo, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { listLoginUsers, login } from '../services/authService';
import { isApiModeEnabled } from '../services/apiClient';

type LoginProps = {
  onAuthenticated: () => void;
};

export default function Login({ onAuthenticated }: LoginProps) {
  const users = useMemo(() => listLoginUsers(), []);
  const demoUser = useMemo(() => users.find((user) => user.id === 'usr_admin') ?? users[0], [users]);
  const demoEmail = 'demo@vantelyx.com';
  const demoPassword = 'VantelyxDemo!2026';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);

  const signIn = async () => {
    if (!demoUser) {
      setError('No active demo user is configured.');
      return;
    }

    if (email.trim().toLowerCase() !== demoEmail.toLowerCase() || password !== demoPassword) {
      setError('Invalid credentials. Use the demo credentials shown below.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await login(demoUser.id);
      onAuthenticated();
    } catch {
      setError('Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.22),transparent_42%),radial-gradient(circle_at_86%_8%,rgba(30,64,175,0.16),transparent_40%),radial-gradient(circle_at_72%_78%,rgba(14,165,233,0.16),transparent_44%)] animate-[bgShift_22s_ease-in-out_infinite]" />
        <div className="absolute -left-24 top-8 h-[26rem] w-[26rem] rounded-full bg-brand-300/35 blur-3xl animate-[orbA_20s_ease-in-out_infinite]" />
        <div className="absolute right-[-7rem] top-[14%] h-[28rem] w-[28rem] rounded-full bg-sky-200/30 blur-3xl animate-[orbB_24s_ease-in-out_infinite]" />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-55">
        <svg className="h-full w-full" viewBox="0 0 1600 900" fill="none" preserveAspectRatio="none">
          <path d="M-80 210 C 240 150, 500 270, 860 210 C 1140 162, 1350 206, 1700 170" stroke="rgba(148,163,184,0.36)" strokeWidth="1.2" className="animate-[vectorFlow_16s_linear_infinite]" />
          <path d="M-120 510 C 210 450, 460 560, 820 500 C 1160 444, 1400 520, 1720 470" stroke="rgba(148,163,184,0.3)" strokeWidth="1.1" className="animate-[vectorFlow_22s_linear_infinite]" />
          <path d="M-100 760 C 240 700, 540 820, 900 740 C 1200 678, 1430 760, 1720 710" stroke="rgba(125,211,252,0.34)" strokeWidth="1.1" className="animate-[vectorFlow_19s_linear_infinite]" />
        </svg>
      </div>
      <style>{`
        @keyframes bgShift {
          0%, 100% { transform: translate3d(0,0,0) scale(1); filter: saturate(100%); }
          50% { transform: translate3d(0,-10px,0) scale(1.03); filter: saturate(110%); }
        }
        @keyframes orbA {
          0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: 0.65; }
          50% { transform: translate3d(44px,-28px,0) scale(1.06); opacity: 0.9; }
        }
        @keyframes orbB {
          0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: 0.6; }
          50% { transform: translate3d(-52px,30px,0) scale(1.05); opacity: 0.85; }
        }
        @keyframes vectorFlow {
          0% { transform: translateX(0); opacity: 0.35; }
          50% { opacity: 0.8; }
          100% { transform: translateX(120px); opacity: 0.35; }
        }
      `}</style>
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="relative border-b border-slate-800 bg-slate-900 px-8 py-10 text-white lg:border-b-0 lg:border-r">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.22),transparent_50%)]" />
            <div className="relative">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                <ShieldCheck size={24} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-brand-200">Vantelyx CLM</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Contract Operations Access Portal</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                Securely access enterprise contract intelligence, risk controls, renewals, obligations, and execution workflow operations.
              </p>
              <div className="mt-8 space-y-3 text-sm text-slate-300">
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Centralized lifecycle governance and audit readiness</p>
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Operational command center with role-aware controls</p>
                <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Decision-support insights for legal, procurement, and finance</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8">
            <div className="mx-auto w-full max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Sign In</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-600">
                Enter your credentials to continue to the Vantelyx CLM workspace.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {isApiModeEnabled
                  ? 'API mode enabled: signed session token requested for write authorization.'
                  : 'Demo mode enabled: local session only, no backend token required.'}
              </p>

              <div className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Work Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={signIn}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <LogIn size={15} />
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
              ) : null}

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Client Demo Credentials</p>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p><span className="font-semibold text-slate-900">Email:</span> {demoEmail}</p>
                  <p className="mt-1"><span className="font-semibold text-slate-900">Password:</span> {demoPassword}</p>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Demo use only. Production should use enterprise SSO (SAML/OIDC) and identity governance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
