import {
  Activity,
  Archive,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  ScrollText,
  Settings,
  ShieldAlert,
  Workflow
} from 'lucide-react';
import type { ReactNode } from 'react';
import { brand } from '../config/brand';
import { cx } from '../utils/format';

export type ViewKey =
  | 'dashboard'
  | 'intake'
  | 'repository'
  | 'workspace'
  | 'workflow'
  | 'obligations'
  | 'renewals'
  | 'vendors'
  | 'risk'
  | 'reports'
  | 'admin'
  | 'rfp';

const navItems: Array<{ key: ViewKey; label: string; icon: ReactNode; badge?: string }> = [
  { key: 'dashboard', label: 'Command Center', icon: <LayoutDashboard size={18} /> },
  { key: 'intake', label: 'AI Intake', icon: <Bot size={18} />, badge: 'AI' },
  { key: 'repository', label: 'Repository', icon: <Archive size={18} /> },
  { key: 'workspace', label: 'Contract Workspace', icon: <ScrollText size={18} /> },
  { key: 'workflow', label: 'Workflow Studio', icon: <Workflow size={18} /> },
  { key: 'obligations', label: 'Obligations', icon: <ClipboardCheck size={18} /> },
  { key: 'renewals', label: 'Renewals', icon: <CalendarClock size={18} /> },
  { key: 'vendors', label: 'Vendors', icon: <Building2 size={18} /> },
  { key: 'risk', label: 'Risk & Compliance', icon: <ShieldAlert size={18} /> },
  { key: 'reports', label: 'Analytics', icon: <Gauge size={18} /> },
  { key: 'admin', label: 'Admin & Security', icon: <LockKeyhole size={18} /> },
  { key: 'rfp', label: 'RFP Coverage', icon: <FileCheck2 size={18} /> }
];

export function Shell({ activeView, setActiveView, children }: { activeView: ViewKey; setActiveView: (view: ViewKey) => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/60 bg-slate-950 text-white shadow-soft lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-glow">
                <FileSearch size={22} />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{brand.productName}</p>
                <p className="text-xs text-slate-400">{brand.suiteName}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={cx(
                  'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition',
                  activeView === item.key
                    ? 'bg-white text-slate-950 shadow-soft'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
              </button>
            ))}
          </nav>

          <div className="m-4 rounded-3xl border border-white/10 bg-white/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity size={16} /> Live RFP Mode
            </div>
            <p className="text-xs leading-5 text-slate-300">
              Built to demonstrate repository, workflow, obligations, renewals, auditability, reporting, and AI differentiators.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">AI Contract Operations</p>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">Future-ready CLM command workspace</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm md:inline-flex">
                Export Board
              </button>
              <button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-soft">
                + New Contract
              </button>
              <button className="relative rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <Bell size={18} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
