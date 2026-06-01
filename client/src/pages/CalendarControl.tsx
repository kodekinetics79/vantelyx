import { useMemo, useState } from 'react';
import { getOperationalCalendarEvents, getSlaControlSummary } from '../services/taskService';
import type { CalendarEvent } from '../types/workflowOps';

type ViewMode = 'week' | 'month' | 'next_90' | 'overdue';

const viewLabel: Record<ViewMode, string> = {
  week: 'This Week',
  month: 'This Month',
  next_90: 'Next 90 Days',
  overdue: 'Overdue'
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const daysUntil = (value: string): number => {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return 9999;
  return Math.ceil((target - new Date().getTime()) / (1000 * 60 * 60 * 24));
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function CalendarControl() {
  const [view, setView] = useState<ViewMode>('week');
  const allEvents = useMemo(() => getOperationalCalendarEvents(), []);
  const summary = useMemo(() => getSlaControlSummary(), []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return allEvents.filter((event) => {
      const eventTs = new Date(event.startAt).getTime();
      if (Number.isNaN(eventTs)) return false;
      const deltaDays = (eventTs - now) / (1000 * 60 * 60 * 24);
      if (view === 'week') return deltaDays >= 0 && deltaDays <= 7;
      if (view === 'month') return deltaDays >= 0 && deltaDays <= 30;
      if (view === 'next_90') return deltaDays >= 0 && deltaDays <= 90;
      return deltaDays < 0;
    });
  }, [allEvents, view]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Calendar and SLA Control</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Contract operations schedule and deadline intelligence</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Approval SLA Breaches" value={String(summary.approvalSlaBreaches)} />
        <Metric label="Overdue Obligations" value={String(summary.overdueObligations)} />
        <Metric label="Missed Renewal Notices" value={String(summary.missedRenewalNotices)} />
        <Metric label="Execution Delays" value={String(summary.executionDelays)} />
        <Metric label="Escalated Work Items" value={String(summary.escalatedWorkItems)} />
      </div>

      {summary.approvalSlaBreaches === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          No SLA breaches right now. Continue tracking events in the calendar views below.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(viewLabel) as ViewMode[]).map((option) => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === option ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {viewLabel[option]}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contract / Counterparty</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((event) => (
                <CalendarRow key={event.id} event={event} />
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No calendar events in this view. Try switching to “Next 90 Days” to see upcoming operational milestones.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalendarRow({ event }: { event: CalendarEvent }) {
  const days = daysUntil(event.startAt);
  const statusTone =
    days < 0
      ? 'border-red-100 bg-red-50 text-red-700'
      : days <= 7
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';

  const priorityTone =
    event.priority === 'critical'
      ? 'border-red-200 bg-red-100 text-red-800'
      : event.priority === 'high'
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : event.priority === 'medium'
      ? 'border-brand-100 bg-brand-50 text-brand-700'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700';

  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-3">{formatDate(event.startAt)}</td>
      <td className="px-4 py-3 font-black text-slate-900">{event.title}</td>
      <td className="px-4 py-3">{pretty(event.type)}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{event.contractTitle ?? event.contractId ?? 'N/A'}</p>
        <p className="text-xs text-slate-500">{event.counterparty ?? 'N/A'}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${priorityTone}`}>{pretty(event.priority)}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
          {days < 0 ? 'Overdue' : event.status === 'completed' ? 'Completed' : 'Pending'}
        </span>
      </td>
      <td className="px-4 py-3">{event.owner || 'Unassigned'}</td>
    </tr>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
