import { type ReactNode, useMemo, useState } from 'react';
import { clmRepository } from '../services/clmRepository';
import {
  addTemplateDraftVersion,
  addTemplateNegotiationComment,
  getMostRecentTemplateDraft,
  getTemplateDraftById,
  updateTemplateDraft
} from '../services/templateService';
import type { TemplateDraft } from '../types/authoring';

type AuthoringTab = 'Draft Summary' | 'Template Fields' | 'Clauses' | 'Versions' | 'Negotiation' | 'Execution Checklist';

const SELECTED_DRAFT_KEY = 'vantelyx_selected_template_draft_id';
const SELECTED_CONTRACT_KEY = 'vantelyx_selected_contract_id';
const tabs: AuthoringTab[] = ['Draft Summary', 'Template Fields', 'Clauses', 'Versions', 'Negotiation', 'Execution Checklist'];

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const riskTone: Record<string, string> = {
  low: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-brand-100 bg-brand-50 text-brand-700',
  high: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-red-100 bg-red-50 text-red-700'
};

export default function Authoring() {
  const [refresh, setRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState<AuthoringTab>('Draft Summary');
  const [message, setMessage] = useState('');
  const [negotiationComment, setNegotiationComment] = useState('');
  const [converting, setConverting] = useState(false);

  const draft = useMemo(() => {
    const selectedDraftId = typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_DRAFT_KEY) : null;
    if (selectedDraftId) {
      const selected = getTemplateDraftById(selectedDraftId);
      if (selected) return selected;
    }
    return getMostRecentTemplateDraft();
  }, [refresh]);

  const saveDraft = (updates: Partial<TemplateDraft>, successMessage: string) => {
    if (!draft) return;
    const updated = updateTemplateDraft(draft.id, updates);
    if (!updated) {
      setMessage('Unable to save draft updates.');
      return;
    }
    setMessage(successMessage);
    setRefresh((value) => value + 1);
  };

  const convertDraftToContract = async () => {
    if (!draft) return;
    setConverting(true);
    const created = await clmRepository.convertDraftToContract(draft);
    setConverting(false);
    if (!created) {
      setMessage('Unable to convert draft to contract.');
      return;
    }
    window.localStorage.setItem(SELECTED_CONTRACT_KEY, created.id);
    setMessage(`Contract ${created.id} created from approved draft.`);
    setRefresh((value) => value + 1);
  };

  if (!draft) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Authoring Workspace</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">No draft available</h2>
        <p className="mt-3 text-sm text-slate-500">
          Create a draft from Template Studio first, then reopen this page. The workspace loads selected draft id or the most recent draft.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Authoring Workspace</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">{draft.title}</h2>
          <div className="flex gap-2">
            <button
              onClick={convertDraftToContract}
              disabled={converting}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {converting ? 'Converting...' : 'Convert Draft to Contract'}
            </button>
            <button
              onClick={() => {
                window.location.hash = '#workspace';
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              Open Workspace
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Template Source" value={draft.templateName} />
          <Metric label="Counterparty" value={draft.counterparty} />
          <Metric label="Department" value={draft.department} />
          <Metric label="Owner" value={draft.owner} />
          <Metric label="Draft Status" value={pretty(draft.status)} />
          <Metric label="Version Number" value={`v${draft.versionNumber}`} />
          <Metric label="Created" value={formatDateTime(draft.createdAt)} />
          <Metric label="Updated" value={formatDateTime(draft.updatedAt)} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {activeTab === 'Draft Summary' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Draft Profile">
                <p className="text-sm text-slate-700">Template: {draft.templateName}</p>
                <p className="mt-2 text-sm text-slate-700">Current Version: v{draft.versionNumber}</p>
                <p className="mt-2 text-sm text-slate-700">Fields Completed: {draft.templateFields.filter((field) => field.value.trim().length > 0).length}/{draft.templateFields.length}</p>
              </Panel>
              <Panel title="Clause Health">
                <p className="text-sm text-slate-700">Included Clauses: {draft.clauses.filter((clause) => clause.included).length}</p>
                <p className="mt-2 text-sm text-slate-700">High/Critical Risks: {draft.clauses.filter((clause) => clause.riskLevel === 'high' || clause.riskLevel === 'critical').length}</p>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'Template Fields' ? (
            <div className="space-y-3">
              {draft.templateFields.map((field) => (
                <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</p>
                  <input
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      const nextFields = draft.templateFields.map((item) =>
                        item.id === field.id ? { ...item, value: event.target.value } : item
                      );
                      saveDraft({ templateFields: nextFields }, `${field.label} updated.`);
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Clauses' ? (
            <div className="space-y-3">
              {draft.clauses.map((clause) => (
                <div key={clause.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-black text-slate-900">{clause.clauseName}</p>
                      <p className="mt-1 text-sm text-slate-700">Fallback Option: {clause.fallbackOption}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[clause.riskLevel]}`}>{pretty(clause.riskLevel)}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${clause.included ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {clause.included ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Versions' ? (
            <div className="space-y-3">
              <button
                onClick={() => {
                  const updated = addTemplateDraftVersion(draft.id, 'Manual version checkpoint from workspace.');
                  if (!updated) {
                    setMessage('Unable to create version.');
                    return;
                  }
                  setMessage(`Version v${updated.versionNumber} created.`);
                  setRefresh((value) => value + 1);
                }}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
              >
                Add New Version
              </button>
              {draft.versions.map((version) => (
                <div key={version.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-black text-slate-900">Version v{version.versionNumber}</p>
                  <p className="mt-1 text-sm text-slate-700">{version.note}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(version.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Negotiation' ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Comments">
                <div className="space-y-3">
                  <textarea
                    value={negotiationComment}
                    onChange={(event) => setNegotiationComment(event.target.value)}
                    rows={3}
                    placeholder="Add negotiation comment..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => {
                      if (!negotiationComment.trim()) return;
                      const updated = addTemplateNegotiationComment(draft.id, negotiationComment.trim());
                      if (!updated) {
                        setMessage('Unable to add comment.');
                        return;
                      }
                      setNegotiationComment('');
                      setMessage('Negotiation comment added.');
                      setRefresh((value) => value + 1);
                    }}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    Add Comment
                  </button>
                  {draft.negotiation.comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{comment.actor}</p>
                      <p className="mt-1 text-sm text-slate-700">{comment.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(comment.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Simulated Redlines">
                <div className="space-y-3">
                  {draft.negotiation.redlines.map((redline) => (
                    <div key={redline.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{redline.summary}</p>
                      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[redline.severity]}`}>
                        {pretty(redline.severity)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'Execution Checklist' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ['legalApproved', 'Legal approved'],
                  ['businessApproved', 'Business approved'],
                  ['financeApproved', 'Finance approved'],
                  ['vendorDetailsConfirmed', 'Vendor details confirmed'],
                  ['signaturePackageReady', 'Signature package ready'],
                  ['finalPdfGenerated', 'Final PDF generated']
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={draft.executionChecklist[key]}
                    onChange={(event) => {
                      saveDraft(
                        {
                          executionChecklist: {
                            ...draft.executionChecklist,
                            [key]: event.target.checked
                          }
                        },
                        `${label} updated.`
                      );
                    }}
                  />
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="font-black text-slate-900">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
