import { useEffect, useState } from 'react';
import { clmRepository } from '../services/clmRepository';
import { hasPermission } from '../services/securityService';
import type { DashboardMetrics } from '../types/clm';
import type { ExecutionMetrics } from '../types/execution';

const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Analytics() {
  const canExport = hasPermission('reports.export');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetrics | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await clmRepository.getDashboardMetrics();
        setMetrics(response);
        setExecutionMetrics(clmRepository.getExecutionMetrics());
      } catch {
        setMetrics(null);
        setExecutionMetrics(null);
      }
    };
    void load();
  }, []);

  const runExport = async (filename: string, getter: () => Promise<string>) => {
    try {
      const csv = await getter();
      downloadCsv(filename, csv);
    } catch {
      console.warn('[Analytics] export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Analytics & Audit</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Export readiness command center</h2>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Total Contracts" value={String(metrics?.totalContracts ?? 0)} />
          <Metric label="Pending Approvals" value={String(metrics?.pendingApprovals ?? 0)} />
          <Metric label="High-Risk" value={String(metrics?.highRiskContracts ?? 0)} />
          <Metric label="Upcoming Renewals" value={String(metrics?.renewalsNext90Days ?? 0)} />
          <Metric label="Overdue Obligations" value={String(metrics?.overdueObligations ?? 0)} />
          <Metric label="Executed" value={String(metrics?.byStatus?.executed ?? 0)} />
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Contracts Executed" value={String(metrics?.byStatus?.executed ?? 0)} />
          <Metric label="Pending Signature" value={String(executionMetrics?.awaitingSignature ?? 0)} />
          <Metric label="Avg Signature Cycle" value={`${executionMetrics?.averageSignatureCycleDays ?? 0}d`} />
          <Metric label="Archived Contracts" value={String(executionMetrics?.archivedPackages ?? 0)} />
          <Metric label="Execution Blockers" value={String(executionMetrics?.executionBlockers ?? 0)} />
        </div>
        <p className="text-sm text-slate-600">
          Generate audit-ready CSV exports for contracts, obligations, renewals, execution packages, and full activity logs.
        </p>

        {!canExport ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Your current role does not have permission to perform this action.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <button
              onClick={() => runExport('vantelyx-contracts.csv', () => clmRepository.exportContractsCsv())}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              Contracts CSV
            </button>
            <button
              onClick={() => runExport('vantelyx-obligations.csv', () => clmRepository.exportObligationsCsv())}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              Obligations CSV
            </button>
            <button
              onClick={() => runExport('vantelyx-renewals.csv', () => clmRepository.exportRenewalsCsv())}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white"
            >
              Renewals CSV
            </button>
            <button
              onClick={() => runExport('vantelyx-audit-log.csv', () => clmRepository.exportAuditLogCsv())}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
            >
              Audit Log CSV
            </button>
            <button
              onClick={() => runExport('vantelyx-execution-packages.csv', () => clmRepository.exportExecutionPackagesCsv())}
              className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white"
            >
              Execution CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
