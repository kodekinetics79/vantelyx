import { useMemo, useState } from 'react';
import { getRenewalQueue, updateRenewalAction } from '../services/vantelyxData';
import { hasPermission } from '../services/securityService';
import { createWorkItem } from '../services/taskService';
import type { Contract } from '../types/clm';

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function Renewals() {
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const canManageRenewals = hasPermission('renewals.manage');
  const contracts = useMemo(() => getRenewalQueue(), [refresh]);

  const expiring30 = contracts.filter((c) => c.renewal.daysUntilNoticeDeadline >= 0 && c.renewal.daysUntilNoticeDeadline <= 30).length;
  const expiring60 = contracts.filter((c) => c.renewal.daysUntilNoticeDeadline > 30 && c.renewal.daysUntilNoticeDeadline <= 60).length;
  const expiring90 = contracts.filter((c) => c.renewal.daysUntilNoticeDeadline > 60 && c.renewal.daysUntilNoticeDeadline <= 90).length;
  const missedNotice = contracts.filter((c) => c.renewal.daysUntilNoticeDeadline < 0).length;
  const autoRenewCount = contracts.filter((c) => c.renewal.autoRenew).length;
  const highRiskRenewals = contracts.filter((c) => c.renewal.renewalRisk === 'high' || c.renewal.renewalRisk === 'critical').length;
  const renewalValueExposure = contracts.reduce((sum, c) => sum + c.request.estimatedValue, 0);

  const applyAction = (
    contractId: string,
    action: 'start_review' | 'notice_sent' | 'do_not_renew' | 'renewed' | 'escalate'
  ) => {
    if (!canManageRenewals) {
      setMessage('Your current role does not have permission to perform this action.');
      return;
    }
    updateRenewalAction(contractId, action);
    setMessage('Renewal action saved.');
    setRefresh((v) => v + 1);
  };

  const createRenewalWorkItem = (contract: Contract) => {
    createWorkItem({
      title: `Renewal Control: ${contract.request.title}`,
      source: 'Renewal',
      contractId: contract.id,
      contractTitle: contract.request.title,
      counterparty: contract.counterparty.name,
      priority: contract.renewal.renewalRisk === 'critical' ? 'critical' : 'high',
      dueDate: contract.renewal.noticeDeadline,
      assignee: contract.renewal.renewalOwner || 'Renewal Owner',
      note: `Generated from Renewals page. Recommended: ${contract.renewal.recommendedAction}`,
      referenceId: `renewal_manual_${contract.id}`
    });
    setMessage('Renewal work item created in Work Queue.');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Renewal Control System</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Renewal command center and decision controls</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <Metric label="Expiring 30d" value={String(expiring30)} />
        <Metric label="Expiring 60d" value={String(expiring60)} />
        <Metric label="Expiring 90d" value={String(expiring90)} />
        <Metric label="Missed Notices" value={String(missedNotice)} />
        <Metric label="Auto-Renew" value={String(autoRenewCount)} />
        <Metric label="High-Risk" value={String(highRiskRenewals)} />
        <Metric label="Value Exposure" value={formatMoney(renewalValueExposure)} />
      </div>
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Contract</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Renewal Date</th>
              <th className="px-5 py-4">Notice Deadline</th>
              <th className="px-5 py-4">Days to Notice</th>
              <th className="px-5 py-4">Auto-Renew</th>
              <th className="px-5 py-4">Owner</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Recommended Action</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((contract: Contract) => (
              <tr key={contract.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-4">
                  <p className="font-black text-slate-900">{contract.request.title}</p>
                  <p className="text-xs text-slate-500">{formatMoney(contract.request.estimatedValue)} · {contract.renewal.commercialImpact}</p>
                </td>
                <td className="px-5 py-4">{contract.counterparty.name}</td>
                <td className="px-5 py-4">{formatDate(contract.renewal.renewalDate)}</td>
                <td className="px-5 py-4">{formatDate(contract.renewal.noticeDeadline)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                    contract.renewal.daysUntilNoticeDeadline < 0
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : contract.renewal.daysUntilNoticeDeadline <= 30
                      ? 'border-amber-100 bg-amber-50 text-amber-700'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  }`}>
                    {contract.renewal.daysUntilNoticeDeadline}
                  </span>
                </td>
                <td className="px-5 py-4">{contract.renewal.autoRenew ? 'Yes' : 'No'}</td>
                <td className="px-5 py-4">{contract.renewal.renewalOwner}</td>
                <td className="px-5 py-4">{pretty(contract.renewal.renewalRisk)}</td>
                <td className="px-5 py-4 max-w-[240px]">{contract.renewal.recommendedAction}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!canManageRenewals} onClick={() => applyAction(contract.id, 'start_review')} className="rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Start Review</button>
                    <button disabled={!canManageRenewals} onClick={() => applyAction(contract.id, 'notice_sent')} className="rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Notice Sent</button>
                    <button disabled={!canManageRenewals} onClick={() => applyAction(contract.id, 'do_not_renew')} className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Do Not Renew</button>
                    <button disabled={!canManageRenewals} onClick={() => applyAction(contract.id, 'renewed')} className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Renewed</button>
                    <button disabled={!canManageRenewals} onClick={() => applyAction(contract.id, 'escalate')} className="rounded-xl bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Escalate</button>
                    <button onClick={() => createRenewalWorkItem(contract)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">Create Work Item</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
