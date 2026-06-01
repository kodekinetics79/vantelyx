import { useMemo, useState } from 'react';
import { getContracts, updateObligationStatus } from '../services/vantelyxData';
import { createWorkItem } from '../services/taskService';
import { hasPermission } from '../services/securityService';

type ObligationRow = {
  contractId: string;
  contractTitle: string;
  counterparty: string;
  obligationId: string;
  title: string;
  owner: string;
  dueDate: string;
  status: string;
  priority: string;
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

export default function Obligations() {
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const canManage = hasPermission('obligations.manage');

  const rows = useMemo<ObligationRow[]>(() => {
    return getContracts().flatMap((contract) =>
      contract.obligations.map((obligation) => ({
        contractId: contract.id,
        contractTitle: contract.request.title,
        counterparty: contract.counterparty.name,
        obligationId: obligation.id,
        title: obligation.title,
        owner: obligation.owner,
        dueDate: obligation.dueDate,
        status: obligation.status,
        priority: obligation.priority
      }))
    );
  }, [refresh]);

  const overdueCount = rows.filter((row) => row.status !== 'done' && daysUntil(row.dueDate) < 0).length;
  const due7Count = rows.filter((row) => row.status !== 'done' && daysUntil(row.dueDate) >= 0 && daysUntil(row.dueDate) <= 7).length;
  const openCount = rows.filter((row) => row.status !== 'done').length;

  const markComplete = (row: ObligationRow) => {
    if (!canManage) {
      setMessage('Your current role does not have permission to perform this action.');
      return;
    }
    updateObligationStatus(row.contractId, row.obligationId, 'done');
    setMessage('Obligation marked complete.');
    setRefresh((value) => value + 1);
  };

  const createObligationWorkItem = (row: ObligationRow) => {
    createWorkItem({
      title: `Obligation Follow-up: ${row.title}`,
      source: 'Obligation',
      contractId: row.contractId,
      contractTitle: row.contractTitle,
      counterparty: row.counterparty,
      priority: row.priority as 'low' | 'medium' | 'high' | 'critical',
      dueDate: row.dueDate,
      assignee: row.owner || 'Operations Owner',
      note: 'Generated from Obligations page.',
      referenceId: `obligation_manual_${row.contractId}_${row.obligationId}`
    });
    setMessage('Obligation work item created in Work Queue.');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Obligation Control</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Operational obligation queue and SLA readiness</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Open Obligations" value={String(openCount)} />
        <Metric label="Overdue" value={String(overdueCount)} />
        <Metric label="Due in 7 Days" value={String(due7Count)} />
      </div>

      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{message}</div> : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Obligation</th>
              <th className="px-5 py-4">Contract / Counterparty</th>
              <th className="px-5 py-4">Owner</th>
              <th className="px-5 py-4">Due Date</th>
              <th className="px-5 py-4">Priority</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${row.contractId}_${row.obligationId}`} className="hover:bg-slate-50/80">
                <td className="px-5 py-4 font-black text-slate-900">{row.title}</td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{row.contractTitle}</p>
                  <p className="text-xs text-slate-500">{row.counterparty}</p>
                </td>
                <td className="px-5 py-4">{row.owner}</td>
                <td className="px-5 py-4">{formatDate(row.dueDate)}</td>
                <td className="px-5 py-4">{row.priority}</td>
                <td className="px-5 py-4">{row.status}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={!canManage || row.status === 'done'}
                      onClick={() => markComplete(row)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Mark Complete
                    </button>
                    <button
                      onClick={() => createObligationWorkItem(row)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      Create Work Item
                    </button>
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
