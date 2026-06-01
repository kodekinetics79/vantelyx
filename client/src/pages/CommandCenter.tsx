import { type ReactNode, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, ShieldAlert, Workflow } from 'lucide-react';
import { getContracts, getDashboardMetrics } from '../services/vantelyxData';
import { getNotifications, getSlaMetrics, getUnreadNotificationCount, getWorkItems, markNotificationRead } from '../services/taskService';
import type { ActivityLog, Contract } from '../types/clm';
import type { Notification } from '../types/workflowOps';
import { askCopilot } from '../services/aiCopilotService';

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const riskLabel = (score: number): 'Low' | 'Medium' | 'High' | 'Critical' => {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
};

const riskTone: Record<'Low' | 'Medium' | 'High' | 'Critical', string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Medium: 'bg-brand-50 text-brand-700 border-brand-100',
  High: 'bg-amber-50 text-amber-700 border-amber-100',
  Critical: 'bg-red-50 text-red-700 border-red-100'
};

function metricTile(icon: ReactNode, label: string, value: string, note: string) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:border-brand-200 hover:shadow-glow">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-2xl bg-brand-50 p-2 text-brand-600">{icon}</div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      </div>
      <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export default function CommandCenter() {
  const [refresh, setRefresh] = useState(0);
  const contracts = useMemo(() => getContracts(), []);
  const metrics = useMemo(() => getDashboardMetrics(), []);
  const notifications = useMemo(() => getNotifications().slice(0, 10), [refresh]);

  const opsMetrics = useMemo(() => {
    const sla = getSlaMetrics();
    const workItems = getWorkItems();
    const unreadNotifications = getUnreadNotificationCount();
    return {
      openWorkItems: sla.totalOpen,
      overdueTasks: sla.overdue,
      slaBreaches: sla.breached,
      escalatedTasks: sla.escalated,
      dueThisWeek: sla.dueIn7Days,
      unreadNotifications,
      workItemCount: workItems.length
    };
  }, [refresh]);

  const executedContracts = useMemo(() => contracts.filter((contract) => contract.status === 'executed').length, [contracts]);

  const highRiskContracts = useMemo(
    () => contracts.filter((contract) => contract.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore).slice(0, 6),
    [contracts]
  );

  const upcomingRenewals = useMemo(() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 120);

    return contracts
      .filter((contract) => {
        const renewalDate = new Date(contract.renewal.renewalDate);
        return !Number.isNaN(renewalDate.getTime()) && renewalDate >= now && renewalDate <= horizon;
      })
      .sort((a, b) => (a.renewal.renewalDate < b.renewal.renewalDate ? -1 : 1))
      .slice(0, 8);
  }, [contracts]);

  const recentActivity = useMemo(() => {
    const all: Array<{ contract: Contract; entry: ActivityLog }> = [];
    contracts.forEach((contract) => {
      contract.activity.forEach((entry) => all.push({ contract, entry }));
    });
    return all.sort((a, b) => (a.entry.timestamp < b.entry.timestamp ? 1 : -1)).slice(0, 12);
  }, [contracts]);

  const onMarkRead = (notification: Notification) => {
    if (notification.read) return;
    markNotificationRead(notification.id);
    setRefresh((value) => value + 1);
  };

  const quickCopilot = (prompt: string) => {
    const response = askCopilot(prompt);
    window.localStorage.setItem('vantelyx_copilot_quick_prompt', prompt);
    window.localStorage.setItem('vantelyx_copilot_last_response', JSON.stringify(response));
    window.location.hash = '#copilot';
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Command Center</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Portfolio intelligence and operations command</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {metricTile(<ClipboardList size={18} />, 'Total Contracts', String(metrics.totalContracts), 'All contracts tracked in local workspace data.')}
        {metricTile(<Workflow size={18} />, 'Pending Approvals', String(metrics.pendingApprovals), 'Contracts with open approval decisions.')}
        {metricTile(<ShieldAlert size={18} />, 'High-Risk Contracts', String(metrics.highRiskContracts), 'Contracts scoring 70+ risk points.')}
        {metricTile(<CalendarClock size={18} />, 'Open Work Items', String(opsMetrics.openWorkItems), `Across ${opsMetrics.workItemCount} tracked workflow tasks.`)}
        {metricTile(<AlertTriangle size={18} />, 'Overdue / Breached', `${opsMetrics.overdueTasks} / ${opsMetrics.slaBreaches}`, 'Overdue tasks and SLA breaches requiring attention.')}
        {metricTile(<CheckCircle2 size={18} />, 'Escalations / Unread', `${opsMetrics.escalatedTasks} / ${opsMetrics.unreadNotifications}`, 'Escalated tasks and unread notification load.')}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Recent Activity</p>
            <h3 className="text-2xl font-black tracking-tight">Latest workflow actions</h3>
          </div>

          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No activity yet. Create or update tasks/contracts to populate the timeline.</div>
            ) : (
              recentActivity.map(({ contract, entry }) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-slate-900">{entry.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{contract.request.title} · {entry.actor} · {pretty(entry.event)}</p>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Notification Center</p>
            <h3 className="text-xl font-black tracking-tight">Recent notifications</h3>

            <div className="mt-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No notifications yet. Work item activity will generate alerts automatically.</div>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{notification.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{notification.message}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">{notification.type.replace(/_/g, ' ')} · {formatDate(notification.createdAt)}</p>
                      </div>
                      {!notification.read ? (
                        <button onClick={() => onMarkRead(notification)} className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Mark Read</button>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Read</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Risk Watchlist</p>
            <h3 className="text-xl font-black tracking-tight">High-risk contracts</h3>

            <div className="mt-4 space-y-3">
              {highRiskContracts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No high-risk contracts detected.</div>
              ) : (
                highRiskContracts.map((contract) => {
                  const label = riskLabel(contract.riskScore);
                  return (
                    <div key={contract.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-black text-slate-900">{contract.request.title}</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[label]}`}>{label}</span>
                      </div>
                      <p className="text-xs text-slate-500">{contract.counterparty.name}</p>
                      <p className="mt-2 text-sm text-slate-700">Risk Score: {contract.riskScore} · Value: {formatMoney(contract.request.estimatedValue)}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Renewal Radar</p>
            <h3 className="text-xl font-black tracking-tight">Upcoming renewals</h3>

            <div className="mt-4 space-y-3">
              {upcomingRenewals.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No upcoming renewals in the selected horizon.</div>
              ) : (
                upcomingRenewals.map((contract) => (
                  <div key={contract.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-black text-slate-900">{contract.request.title}</p>
                    <p className="text-xs text-slate-500">{contract.counterparty.name}</p>
                    <p className="mt-2 text-sm text-slate-700">Renewal: {formatDate(contract.renewal.renewalDate)}</p>
                    <p className="text-sm text-slate-700">Notice: {formatDate(contract.renewal.noticeDeadline)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Execution Snapshot</p>
            <h3 className="text-xl font-black tracking-tight">Execution and closure status</h3>
            <p className="mt-3 text-sm text-slate-700">Executed contracts: <span className="font-bold">{executedContracts}</span></p>
            <p className="mt-1 text-sm text-slate-700">Due this week: <span className="font-bold">{opsMetrics.dueThisWeek}</span></p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Today’s Contract Intelligence</p>
            <h3 className="text-xl font-black tracking-tight">Copilot smart brief</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>- High-risk contracts: <span className="font-bold">{metrics.highRiskContracts}</span></li>
              <li>- Renewals due soon: <span className="font-bold">{metrics.renewalsNext90Days}</span></li>
              <li>- Overdue obligations: <span className="font-bold">{metrics.overdueObligations}</span></li>
              <li>- Pending approvals: <span className="font-bold">{metrics.pendingApprovals}</span></li>
              <li>- Execution blockers: <span className="font-bold">{opsMetrics.escalatedTasks}</span></li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => quickCopilot('Explain risks')} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">Explain risks</button>
              <button onClick={() => quickCopilot('Show renewals')} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">Show renewals</button>
              <button onClick={() => quickCopilot('What needs attention?')} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">What needs attention?</button>
              <button onClick={() => (window.location.hash = '#copilot')} className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Open Copilot</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
