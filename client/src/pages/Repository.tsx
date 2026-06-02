import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Filter, Search } from 'lucide-react';
import { clmRepository } from '../services/clmRepository';
import { getContractAccessScopeLabel, getVisibleContracts } from '../services/securityService';
import { getDashboardMetrics } from '../services/vantelyxData';
import { searchContractsNaturalLanguage } from '../services/aiCopilotService';
import { addIntegrationEvent, getAvailableImportSources } from '../services/integrationService';
import type { ClauseSignal, Contract, ContractStatus } from '../types/clm';
import type { ExecutionPackage } from '../types/execution';

type RepositoryProps = {
  onOpenContractWorkspace?: (contractId: string) => void;
};

type SavedViewKey =
  | 'all'
  | 'pending_review'
  | 'high_risk'
  | 'expiring_soon'
  | 'auto_renew'
  | 'missing_clauses'
  | 'executed';

const WORKSPACE_SELECTION_KEY = 'vantelyx_selected_contract_id';

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString();
};

const toRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const riskTone: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  medium: 'bg-brand-50 text-brand-700 border-brand-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100'
};

const statusTone: Record<ContractStatus, string> = {
  intake: 'bg-slate-50 text-slate-700 border-slate-200',
  drafting: 'bg-slate-50 text-slate-700 border-slate-200',
  internal_review: 'bg-violet-50 text-violet-700 border-violet-100',
  counterparty_review: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  executed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  active: 'bg-brand-50 text-brand-700 border-brand-100',
  renewal_pending: 'bg-red-50 text-red-700 border-red-100',
  expired: 'bg-red-50 text-red-700 border-red-100',
  terminated: 'bg-slate-50 text-slate-700 border-slate-200'
};

const renewalTone = (daysToRenewal: number): string => {
  if (daysToRenewal < 0) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (daysToRenewal <= 30) return 'bg-red-50 text-red-700 border-red-100';
  if (daysToRenewal <= 90) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
};

const prettyStatus = (status: string): string =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const uniqueValues = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const extractDepartment = (contract: Contract): string => {
  if (contract.request.department) {
    return contract.request.department;
  }
  const match = contract.request.notes?.match(/Department:\s*([^\n]+)/i);
  return match?.[1]?.trim() ?? '';
};

const contractTags = (contract: Contract): string[] => {
  const requestTags = contract.request.tags ?? [];
  const metadataTags = Object.values(contract.request.metadata ?? {});
  return uniqueValues([...requestTags, ...metadataTags]);
};

const getContractSource = (contract: Contract): 'AI Intake' | 'Template Draft' | 'Imported Contract' => {
  const metadataSource = contract.request.metadata?.source;
  if (metadataSource === 'Template Draft' || metadataSource === 'Imported Contract' || metadataSource === 'AI Intake') {
    return metadataSource;
  }
  return contract.source ?? 'AI Intake';
};

const missingClauses = (clauses: ClauseSignal[]): number => clauses.filter((clause) => clause.status === 'missing').length;

const daysUntil = (iso: string): number => {
  const now = new Date();
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const savedViewLabel: Record<SavedViewKey, string> = {
  all: 'All Contracts',
  pending_review: 'Pending Review',
  high_risk: 'High Risk',
  expiring_soon: 'Expiring Soon',
  auto_renew: 'Auto-Renew Contracts',
  missing_clauses: 'Missing Key Clauses',
  executed: 'Executed Contracts'
};

export default function Repository({ onOpenContractWorkspace }: RepositoryProps) {
  const [query, setQuery] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [nlResultIds, setNlResultIds] = useState<string[] | null>(null);
  const [savedView, setSavedView] = useState<SavedViewKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Contract['request']['contractType']>('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | string>('all');
  const [counterpartyFilter, setCounterpartyFilter] = useState<'all' | string>('all');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [executionPackages, setExecutionPackages] = useState<ExecutionPackage[]>([]);
  const [importNotice, setImportNotice] = useState('');
  const dashboardMetrics = useMemo(() => getDashboardMetrics(), []);
  const accessScopeLabel = getContractAccessScopeLabel();
  const importSources = useMemo(() => {
    try {
      return getAvailableImportSources();
    } catch {
      return [];
    }
  }, []);

  const selectImportSource = (source: (typeof importSources)[number]) => {
    addIntegrationEvent({ type: 'import_source_selected', connectorId: source.connectorId, message: `Import source selected: ${source.label}.` });
    if (source.setupRequired) {
      setImportNotice(`${source.label} requires setup. Configure it in the Integrations Hub.`);
    } else if (source.key === 'local_upload') {
      setImportNotice('Local upload ready (demo). Choose files to import.');
    } else {
      setImportNotice('Demo import simulated. No external documents were accessed.');
    }
  };

  useEffect(() => {
    const loadContracts = async () => {
      try {
        const allContracts = await clmRepository.getContracts();
        setContracts(getVisibleContracts(allContracts));
        setExecutionPackages(clmRepository.getExecutionPackages());
      } catch {
        setContracts([]);
        setExecutionPackages([]);
      }
    };
    void loadContracts();
  }, []);

  const ownerOptions = useMemo(() => uniqueValues(contracts.map((contract) => contract.request.requesterName)), [contracts]);
  const counterpartyOptions = useMemo(() => uniqueValues(contracts.map((contract) => contract.counterparty.name)), [contracts]);
  const typeOptions = useMemo(
    () => uniqueValues(contracts.map((contract) => contract.request.contractType)) as Contract['request']['contractType'][],
    [contracts]
  );

  const filteredContracts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return contracts.filter((contract) => {
      const riskLevel = toRiskLevel(contract.riskScore);
      const department = extractDepartment(contract);
      const tags = contractTags(contract);
      const missingClauseCount = missingClauses(contract.clauseSignals);
      const renewalInDays = daysUntil(contract.renewal.renewalDate);
      const hasPendingReview = contract.approvals.some((step) => step.decision === 'pending' || step.decision === 'changes_requested');

      const searchable = [
        contract.request.title,
        contract.counterparty.name,
        contract.request.requesterName,
        department,
        contract.request.contractType,
        contract.status,
        riskLevel,
        getContractSource(contract),
        ...tags,
        ...(contract.request.notes ? [contract.request.notes] : [])
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = q.length === 0 || searchable.includes(q);
      const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
      const matchesRisk = riskFilter === 'all' || riskLevel === riskFilter;
      const matchesType = typeFilter === 'all' || contract.request.contractType === typeFilter;
      const matchesOwner = ownerFilter === 'all' || contract.request.requesterName === ownerFilter;
      const matchesCounterparty = counterpartyFilter === 'all' || contract.counterparty.name === counterpartyFilter;
      const matchesNl = !nlResultIds || nlResultIds.includes(contract.id);

      const matchesSavedView =
        savedView === 'all' ||
        (savedView === 'pending_review' && hasPendingReview) ||
        (savedView === 'high_risk' && contract.riskScore >= 70) ||
        (savedView === 'expiring_soon' && renewalInDays >= 0 && renewalInDays <= 90) ||
        (savedView === 'auto_renew' && contract.renewal.autoRenew) ||
        (savedView === 'missing_clauses' && missingClauseCount > 0) ||
        (savedView === 'executed' && contract.status === 'executed');

      return (
        matchesQuery &&
        matchesStatus &&
        matchesRisk &&
        matchesType &&
        matchesOwner &&
        matchesCounterparty &&
        matchesSavedView &&
        matchesNl
      );
    });
  }, [contracts, counterpartyFilter, nlResultIds, ownerFilter, query, riskFilter, savedView, statusFilter, typeFilter]);

  const packageByContractId = useMemo(
    () => new Map(executionPackages.map((pkg) => [pkg.contractId, pkg])),
    [executionPackages]
  );

  const getExecutionLifecycleStatus = (contract: Contract): string => {
    const pkg = packageByContractId.get(contract.id);
    if (pkg?.status === 'archived') return 'Archived';
    if (pkg?.status === 'executed' || contract.status === 'executed') return 'Executed';
    if (pkg?.status === 'sent' || pkg?.status === 'partially_signed') return 'Sent for Signature';
    if (contract.status === 'approved') return 'Approved';
    if (contract.status === 'intake' || contract.status === 'drafting') return 'Draft';
    return 'In Review';
  };

  const openWorkspace = (contractId: string) => {
    window.localStorage.setItem(WORKSPACE_SELECTION_KEY, contractId);
    if (onOpenContractWorkspace) {
      onOpenContractWorkspace(contractId);
      return;
    }
    window.location.hash = '#workspace';
  };

  const runNaturalSearch = () => {
    const q = nlQuery.trim();
    if (!q) {
      setNlResultIds(null);
      return;
    }
    const results = searchContractsNaturalLanguage(q);
    setNlResultIds(results.map((result) => result.contractId));
  };

  const clearNaturalSearch = () => {
    setNlQuery('');
    setNlResultIds(null);
  };

  const totalContractValue = useMemo(
    () => contracts.reduce((sum, contract) => sum + contract.request.estimatedValue, 0),
    [contracts]
  );

  const expiringIn90Days = useMemo(
    () => contracts.filter((contract) => {
      const days = daysUntil(contract.renewal.renewalDate);
      return days >= 0 && days <= 90;
    }).length,
    [contracts]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Repository</p>
            <h2 className="text-2xl font-black tracking-tight">Enterprise Contract Command Center</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Access Scope: {accessScopeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, counterparty, owner, department, type, status, risk, tags..."
                className="w-80 border-none bg-transparent text-sm outline-none"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              <Filter size={15} /> Advanced Filters
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(savedViewLabel) as SavedViewKey[]).map((view) => (
            <button
              key={view}
              onClick={() => setSavedView(view)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                savedView === view ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {savedViewLabel[view]}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Import Sources</p>
            <span className="text-[11px] font-semibold text-slate-400">Status from Integrations Hub (demo)</span>
          </div>
          {importSources.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No import sources available.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {importSources.map((source) => (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => selectImportSource(source)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {source.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      source.available
                        ? 'bg-emerald-50 text-emerald-700'
                        : source.demoMode
                        ? 'bg-violet-50 text-violet-700'
                        : source.setupRequired
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {source.setupRequired ? 'Setup' : source.demoMode ? 'Demo' : source.available ? 'Ready' : source.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          {importNotice ? (
            <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{importNotice}</p>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Natural Language Search</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={nlQuery}
              onChange={(event) => setNlQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runNaturalSearch();
              }}
              placeholder="Ask: high-risk vendor agreements expiring in 90 days..."
              className="min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button onClick={runNaturalSearch} className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white">
              Run Search
            </button>
            <button onClick={clearNaturalSearch} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">
              Clear Search
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            {nlResultIds
              ? `Natural search matched ${nlResultIds.length} contract(s).`
              : 'Supports high risk, low risk, pending approval, renewals 30/60/90 days, auto-renew, missing clauses, owner, vendor, and execution blockers.'}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ContractStatus)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="intake">Intake</option>
            <option value="drafting">Drafting</option>
            <option value="internal_review">Internal Review</option>
            <option value="counterparty_review">Counterparty Review</option>
            <option value="approved">Approved</option>
            <option value="executed">Executed</option>
            <option value="active">Active</option>
            <option value="renewal_pending">Renewal Pending</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as 'all' | 'low' | 'medium' | 'high' | 'critical')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | Contract['request']['contractType'])}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">All Contract Types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">All Owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>

          <select
            value={counterpartyFilter}
            onChange={(event) => setCounterpartyFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">All Counterparties</option>
            {counterpartyOptions.map((counterparty) => (
              <option key={counterparty} value={counterparty}>
                {counterparty}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Contract Value" value={formatMoney(totalContractValue)} />
        <SummaryCard title="Expiring in 90 Days" value={String(expiringIn90Days)} />
        <SummaryCard title="High-Risk Contracts" value={String(dashboardMetrics.highRiskContracts)} />
        <SummaryCard title="Pending Approvals" value={String(dashboardMetrics.pendingApprovals)} />
        <SummaryCard title="Missing Clauses" value={String(dashboardMetrics.missingClauseCount)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Title</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Value</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Execution</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Renewal</th>
              <th className="px-5 py-4">Missing Clauses</th>
              <th className="px-5 py-4">Owner</th>
              <th className="px-5 py-4">Source</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredContracts.map((contract) => {
              const riskLevel = toRiskLevel(contract.riskScore);
              const renewalInDays = daysUntil(contract.renewal.renewalDate);
              const missingClauseCount = missingClauses(contract.clauseSignals);
              const department = extractDepartment(contract);

              return (
                <tr key={contract.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <button className="text-left" onClick={() => openWorkspace(contract.id)}>
                      <p className="font-black text-slate-950">{contract.request.title}</p>
                      <p className="text-xs text-slate-500">{contract.id}{department ? ` · ${department}` : ''}</p>
                    </button>
                  </td>
                  <td className="px-5 py-4">{contract.counterparty.name}</td>
                  <td className="px-5 py-4">{contract.request.contractType}</td>
                  <td className="px-5 py-4 font-bold">{formatMoney(contract.request.estimatedValue)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone[contract.status]}`}>
                      {prettyStatus(contract.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {getExecutionLifecycleStatus(contract)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[riskLevel]}`}>
                      {contract.riskScore} ({riskLevel})
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${renewalTone(renewalInDays)}`}>
                      {renewalInDays < 0 ? 'Expired' : `${renewalInDays}d`} · {formatDate(contract.renewal.renewalDate)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${missingClauseCount > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                      {missingClauseCount > 0 ? `${missingClauseCount} Missing` : 'Complete'}
                    </span>
                  </td>
                  <td className="px-5 py-4">{contract.request.requesterName}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {getContractSource(contract)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => openWorkspace(contract.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Open Workspace <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-5 py-10 text-center text-sm text-slate-500">
                  No contracts match the current command center filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
