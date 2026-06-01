import type { ReactNode } from 'react';
import { cx } from '../utils/format';
import type { RiskLevel } from '../types/domain';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl border border-slate-200 bg-white p-5 shadow-soft', className)}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">{eyebrow}</p>}
        <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, note, tone = 'blue' }: { label: string; value: string; note: string; tone?: 'blue' | 'green' | 'amber' | 'violet' | 'slate' }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700',
    green: 'bg-emeraldsoft text-emerald-700',
    amber: 'bg-amberlight text-amber-700',
    violet: 'bg-violetsoft text-violet-700',
    slate: 'bg-slate-100 text-slate-700'
  };
  return (
    <Card>
      <div className={cx('mb-4 inline-flex rounded-2xl px-3 py-1 text-xs font-bold', tones[tone])}>{label}</div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </Card>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate' }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700 border-brand-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200'
  };
  return <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', tones[tone])}>{children}</span>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = risk === 'Critical' ? 'red' : risk === 'High' ? 'amber' : risk === 'Medium' ? 'blue' : 'green';
  return <Badge tone={tone}>{risk}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-slate-950" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
