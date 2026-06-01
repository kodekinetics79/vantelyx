import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { clmRepository } from '../services/clmRepository';
import { hasPermission } from '../services/securityService';
import type { ClauseSignal, Contract, ContractRequest } from '../types/clm';

type IntakePriority = 'Low' | 'Medium' | 'High' | 'Critical';

type IntakeFormState = {
  contractTitle: string;
  counterparty: string;
  contractType: ContractRequest['contractType'];
  value: string;
  owner: string;
  department: string;
  startDate: string;
  endDate: string;
  renewalNoticeDays: string;
  priority: IntakePriority;
  notes: string;
};

type AIIntakeProps = {
  onNavigateRepository?: () => void;
};

const initialForm: IntakeFormState = {
  contractTitle: '',
  counterparty: '',
  contractType: 'Vendor Agreement',
  value: '',
  owner: '',
  department: '',
  startDate: '',
  endDate: '',
  renewalNoticeDays: '90',
  priority: 'Medium',
  notes: ''
};

const contractTypes: ContractRequest['contractType'][] = [
  'MSA',
  'NDA',
  'SOW',
  'Order Form',
  'Vendor Agreement',
  'Customer Agreement'
];

const priorities: IntakePriority[] = ['Low', 'Medium', 'High', 'Critical'];

const daysBetween = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(diff) || diff <= 0) {
    return 30;
  }
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
};

const toTermMonths = (start: string, end: string): number => {
  const days = daysBetween(start, end);
  return Math.max(1, Math.round(days / 30));
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString();
};

const clauseMissing = (clauses: ClauseSignal[]): ClauseSignal[] => clauses.filter((clause) => clause.status === 'missing');

export default function AIIntake({ onNavigateRepository }: AIIntakeProps) {
  const [form, setForm] = useState<IntakeFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [createdContract, setCreatedContract] = useState<Contract | null>(null);
  const canCreateContract = hasPermission('contracts.create');

  const missingClauses = useMemo(
    () => (createdContract ? clauseMissing(createdContract.clauseSignals) : []),
    [createdContract]
  );

  const handleChange = <K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateContract) {
      setSuccessMessage('Your current role does not have permission to perform this action.');
      return;
    }

    if (!form.startDate || !form.endDate) {
      setSuccessMessage('Please provide start and end dates.');
      return;
    }

    setSubmitting(true);
    const termMonths = toTermMonths(form.startDate, form.endDate);

    const request: ContractRequest = {
      requesterName: form.owner,
      requesterEmail: `${form.owner.toLowerCase().replace(/\s+/g, '.')}@vantelyx.com`,
      title: form.contractTitle,
      contractType: form.contractType,
      counterpartyName: form.counterparty,
      counterpartyRegion: 'US',
      estimatedValue: Number(form.value) || 0,
      currency: 'USD',
      startDate: new Date(form.startDate).toISOString(),
      termMonths,
      autoRenew: true,
      notes:
        `Department: ${form.department}\n` +
        `Priority: ${form.priority}\n` +
        `Requested Renewal Notice: ${form.renewalNoticeDays} days\n` +
        `End Date: ${form.endDate}\n` +
        `Notes: ${form.notes || 'None'}`
    };

    try {
      const result = await clmRepository.createContractFromIntake(request);
      setCreatedContract(result);
      setSuccessMessage('Contract intake submitted. AI extraction and workflow generation completed.');
    } catch {
      setSuccessMessage('Unable to submit intake right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Smart Intake</p>
          <h2 className="text-2xl font-black tracking-tight">AI Contract Intake</h2>
          <p className="mt-2 text-sm text-slate-500">
            Capture intake details and generate contract intelligence, obligations, approvals, and renewal reminders.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {!canCreateContract ? (
            <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Your current role does not have permission to perform this action.
            </div>
          ) : null}
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            Contract Title
            <input
              required
              value={form.contractTitle}
              onChange={(event) => handleChange('contractTitle', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="e.g. Enterprise SaaS Subscription Agreement"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Counterparty
            <input
              required
              value={form.counterparty}
              onChange={(event) => handleChange('counterparty', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="Counterparty legal name"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Contract Type
            <select
              value={form.contractType}
              onChange={(event) => handleChange('contractType', event.target.value as ContractRequest['contractType'])}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            >
              {contractTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Value (USD)
            <input
              required
              type="number"
              min="0"
              value={form.value}
              onChange={(event) => handleChange('value', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="250000"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Owner
            <input
              required
              value={form.owner}
              onChange={(event) => handleChange('owner', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="Business owner"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Department
            <input
              required
              value={form.department}
              onChange={(event) => handleChange('department', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="e.g. Procurement"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Start Date
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(event) => handleChange('startDate', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            End Date
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(event) => handleChange('endDate', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Renewal Notice Days
            <input
              required
              type="number"
              min="1"
              value={form.renewalNoticeDays}
              onChange={(event) => handleChange('renewalNoticeDays', event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="90"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Priority
            <select
              value={form.priority}
              onChange={(event) => handleChange('priority', event.target.value as IntakePriority)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={4}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
              placeholder="Add any context for legal and approvers"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !canCreateContract}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <Sparkles size={16} />
              {submitting ? 'Processing Intake...' : 'Submit AI Intake'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (onNavigateRepository) {
                  onNavigateRepository();
                }
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              Go to Contract Repository <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {successMessage ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5" />
            <p className="text-sm font-semibold">{successMessage}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">AI Draft Output</p>
        <h3 className="text-xl font-black tracking-tight">Generated Summary</h3>

        {!createdContract ? (
          <p className="mt-4 text-sm text-slate-500">Submit intake details to generate risk, obligations, approvals, and renewal insights.</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-900">Risk Score</p>
              <p className="mt-1 text-slate-700">{createdContract.riskScore} / 100</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">Missing Clauses</p>
              {missingClauses.length === 0 ? (
                <p className="mt-1 text-slate-600">No missing clauses detected.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-slate-700">
                  {missingClauses.map((clause) => (
                    <li key={clause.clause}>- {clause.clause}: {clause.message}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">Obligations</p>
              <ul className="mt-2 space-y-1 text-slate-700">
                {createdContract.obligations.map((obligation) => (
                  <li key={obligation.id}>- {obligation.title} ({formatDate(obligation.dueDate)})</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">Approval Path</p>
              <ul className="mt-2 space-y-1 text-slate-700">
                {createdContract.approvals.map((step) => (
                  <li key={step.id}>- {step.role}: {step.approver} ({step.decision})</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
              <p className="font-bold">Renewal Notice Date</p>
              <p className="mt-1">{formatDate(createdContract.renewal.noticeDeadline)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
