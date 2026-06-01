import { useMemo, useState } from 'react';
import {
  createTemplateDraft,
  getClauseLibrary,
  getTemplateDrafts,
  getTemplateLibrary,
  seedTemplateStudioData
} from '../services/templateService';
import type { ClauseLibraryItem } from '../types/authoring';

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const riskTone: Record<string, string> = {
  low: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-brand-100 bg-brand-50 text-brand-700',
  high: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-red-100 bg-red-50 text-red-700'
};
const SELECTED_DRAFT_KEY = 'vantelyx_selected_template_draft_id';

export default function Templates() {
  useMemo(() => {
    seedTemplateStudioData();
    return null;
  }, []);

  const [refresh, setRefresh] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [message, setMessage] = useState('');

  const templates = useMemo(() => getTemplateLibrary(), [refresh]);
  const clauses = useMemo(() => getClauseLibrary(), [refresh]);
  const drafts = useMemo(() => getTemplateDrafts(), [refresh]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates]
  );

  const createDraft = (templateId: string) => {
    const draft = createTemplateDraft(templateId);
    if (!draft) {
      setMessage('Unable to create draft from template.');
      return;
    }
    window.localStorage.setItem(SELECTED_DRAFT_KEY, draft.id);
    setMessage(`Draft created: ${draft.id} (${draft.templateName})`);
    setRefresh((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Template Studio</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Template authoring and clause control center</h2>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-black tracking-tight text-slate-950">Template Library</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Template Type</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3">Approved by Legal</th>
                <th className="px-4 py-3">Usage Count</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-black text-slate-900">{template.name}</td>
                  <td className="px-4 py-3">{template.templateType}</td>
                  <td className="px-4 py-3">{template.department}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[template.riskLevel]}`}>
                      {pretty(template.riskLevel)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(template.lastUpdated)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${template.legalApproved ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                      {template.legalApproved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{template.usageCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white">Use Template</button>
                      <button
                        onClick={() => setSelectedTemplateId(template.id)}
                        className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        View Clauses
                      </button>
                      <button
                        onClick={() => createDraft(template.id)}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Create Draft
                      </button>
                      <button
                        onClick={() => {
                          const latest = drafts[0];
                          if (latest) {
                            window.localStorage.setItem(SELECTED_DRAFT_KEY, latest.id);
                          }
                          window.location.hash = '#authoring';
                        }}
                        className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Open Authoring
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-black tracking-tight text-slate-950">Clause Library</h3>
          {selectedTemplate ? (
            <p className="mt-1 text-sm font-semibold text-slate-600">Viewing clauses for: {selectedTemplate.name}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Select “View Clauses” from a template to focus the review.</p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Clause Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Risk Level</th>
                  <th className="px-4 py-3">Fallback Language</th>
                  <th className="px-4 py-3">Legal Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clauses.map((clause) => (
                  <ClauseRow key={clause.id} clause={clause} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xl font-black tracking-tight text-slate-950">Draft Queue</h3>
          <p className="mt-1 text-sm text-slate-500">Drafts created in Template Studio are stored in localStorage.</p>
          <div className="mt-4 space-y-3">
            {drafts.length === 0 ? (
              <p className="text-sm text-slate-500">No drafts yet.</p>
            ) : (
              drafts.slice(0, 6).map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-sm font-black text-slate-900">{draft.templateName}</p>
                  <p className="mt-1 text-xs text-slate-600">{draft.id}</p>
                  <p className="mt-1 text-xs text-slate-500">Created {formatDate(draft.createdAt)}</p>
                </div>
              ))
            )}
          </div>
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

function ClauseRow({ clause }: { clause: ClauseLibraryItem }) {
  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-4 py-3 font-semibold text-slate-900">{clause.clauseName}</td>
      <td className="px-4 py-3">{clause.category}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[clause.riskLevel]}`}>
          {pretty(clause.riskLevel)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${clause.fallbackLanguageAvailable ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {clause.fallbackLanguageAvailable ? 'Available' : 'Missing'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${clause.legalApproved ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
          {clause.legalApproved ? 'Approved' : 'Pending'}
        </span>
      </td>
    </tr>
  );
}
