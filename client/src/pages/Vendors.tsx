import { useMemo } from 'react';
import { getContracts, getCounterpartyIntelligence } from '../services/vantelyxData';
import { hasPermission } from '../services/securityService';
import type { Counterparty } from '../types/clm';

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const riskTone: Record<Counterparty['riskRating'], string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  medium: 'bg-brand-50 text-brand-700 border-brand-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100'
};

const complianceTone: Record<Counterparty['complianceStatus'], string> = {
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  watch: 'bg-amber-50 text-amber-700 border-amber-100',
  non_compliant: 'bg-red-50 text-red-700 border-red-100',
  pending_review: 'bg-slate-100 text-slate-700 border-slate-200'
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const renewalExposureCount = (counterpartyName: string, renewalDates: Record<string, string[]>): number => {
  const dates = renewalDates[counterpartyName] ?? [];
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 120);
  return dates.filter((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= now && date <= horizon;
  }).length;
};

export default function Vendors() {
  const canManageVendors = hasPermission('vendors.manage');
  const counterparties = useMemo(() => getCounterpartyIntelligence(), []);
  const contracts = useMemo(() => getContracts(), []);

  const renewalDatesByCounterparty = useMemo(() => {
    const map: Record<string, string[]> = {};
    contracts.forEach((contract) => {
      const key = contract.counterparty.name;
      map[key] = map[key] ?? [];
      map[key].push(contract.renewal.renewalDate);
    });
    return map;
  }, [contracts]);

  const totalExposure = useMemo(
    () => counterparties.reduce((sum, counterparty) => sum + counterparty.totalContractValue, 0),
    [counterparties]
  );

  const highRiskCount = useMemo(
    () => counterparties.filter((counterparty) => counterparty.riskRating === 'high' || counterparty.riskRating === 'critical').length,
    [counterparties]
  );

  const missingDocsCount = useMemo(
    () => counterparties.filter((counterparty) => counterparty.documentCompleteness !== 'complete').length,
    [counterparties]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Counterparty Intelligence</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Vendor and counterparty command center</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Exposure" value={formatMoney(totalExposure)} />
        <SummaryCard label="High-Risk Counterparties" value={String(highRiskCount)} />
        <SummaryCard label="Missing Documents" value={String(missingDocsCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {counterparties.slice(0, 6).map((counterparty) => (
          <div key={counterparty.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">{counterparty.name}</p>
                <p className="text-xs text-slate-500">{pretty(counterparty.type)} · Owner: {counterparty.relationshipOwner}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[counterparty.riskRating]}`}>
                {pretty(counterparty.riskRating)} Risk
              </span>
            </div>
            <p className="text-sm text-slate-700">Contract Exposure: <span className="font-bold">{formatMoney(counterparty.totalContractValue)}</span></p>
            <p className="mt-1 text-sm text-slate-700">Compliance: <span className="font-bold">{pretty(counterparty.complianceStatus)}</span></p>
            <p className="mt-1 text-sm text-slate-700">Renewal Exposure: <span className="font-bold">{renewalExposureCount(counterparty.name, renewalDatesByCounterparty)} upcoming</span></p>
            <p className="mt-1 text-sm text-slate-700">Missing Documents: <span className="font-bold">{counterparty.documentCompleteness === 'complete' ? 'None' : pretty(counterparty.documentCompleteness)}</span></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Contract Exposure</th>
              <th className="px-5 py-4">Compliance</th>
              <th className="px-5 py-4">Renewal Exposure</th>
              <th className="px-5 py-4">Missing Documents</th>
              <th className="px-5 py-4">Owner</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {counterparties.map((counterparty) => (
              <tr key={counterparty.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-4 font-black text-slate-900">{counterparty.name}</td>
                <td className="px-5 py-4">{pretty(counterparty.type)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[counterparty.riskRating]}`}>
                    {pretty(counterparty.riskRating)}
                  </span>
                </td>
                <td className="px-5 py-4 font-bold">{formatMoney(counterparty.totalContractValue)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${complianceTone[counterparty.complianceStatus]}`}>
                    {pretty(counterparty.complianceStatus)}
                  </span>
                </td>
                <td className="px-5 py-4">{renewalExposureCount(counterparty.name, renewalDatesByCounterparty)} upcoming</td>
                <td className="px-5 py-4">{counterparty.documentCompleteness === 'complete' ? 'None' : pretty(counterparty.documentCompleteness)}</td>
                <td className="px-5 py-4">{counterparty.relationshipOwner}</td>
                <td className="px-5 py-4">
                  <button
                    disabled={!canManageVendors}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    title={!canManageVendors ? 'Your current role does not have permission to perform this action.' : 'Manage vendor'}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canManageVendors ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Your current role does not have permission to perform this action.
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
