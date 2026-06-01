import { useMemo, useState } from 'react';
import {
  askCopilot,
  getCopilotHealth,
  getPromptSuggestions,
  recordCopilotFeedback,
  searchContractsNaturalLanguage
} from '../services/aiCopilotService';
import type { CopilotAction, CopilotResponse } from '../types/ai';
import { clmRepository } from '../services/clmRepository';

type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: CopilotResponse;
};

const toneByConfidence = {
  High: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  Medium: 'border-amber-100 bg-amber-50 text-amber-700',
  Low: 'border-red-100 bg-red-50 text-red-700'
};

export default function Copilot() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const prompts = useMemo(() => getPromptSuggestions('copilot'), []);
  const health = useMemo(() => getCopilotHealth(), []);

  const submit = (value?: string) => {
    const text = (value ?? question).trim();
    if (!text) {
      setError('Ask me about contracts, renewals, approvals, obligations, risks, vendors, or clauses.');
      return;
    }

    setError('');
    setLoading(true);
    const userMessage: ChatItem = { id: `usr_${Date.now()}`, role: 'user', text };

    try {
      const response = askCopilot(text);
      const assistantMessage: ChatItem = {
        id: response.messageId,
        role: 'assistant',
        text: response.summary,
        response
      };
      setHistory((prev) => [...prev, userMessage, assistantMessage]);
      setQuestion('');
    } catch {
      setError('Copilot could not process this request. Please try a supported question.');
    } finally {
      setLoading(false);
    }
  };

  const runAction = (action: CopilotAction) => {
    if (action.disabled) return;
    if (action.type === 'OPEN_CONTRACT' || action.type === 'OPEN_WORKSPACE') {
      if (action.contractId) window.localStorage.setItem('vantelyx_selected_contract_id', action.contractId);
      window.location.hash = '#workspace';
      return;
    }
    if (action.type === 'FILTER_REPOSITORY') {
      window.location.hash = '#repository';
      return;
    }
    if (action.type === 'OPEN_RENEWALS') {
      window.location.hash = '#renewals';
      return;
    }
    if (action.type === 'OPEN_OBLIGATIONS') {
      window.location.hash = '#obligations';
      return;
    }
    if (action.type === 'OPEN_WORK_QUEUE') {
      window.location.hash = '#workqueue';
      return;
    }
    if (action.type === 'EXPORT_RESULTS') {
      void clmRepository.exportContractsCsv();
    }
  };

  const feedback = (messageId: string, rating: 'helpful' | 'not_helpful') => {
    recordCopilotFeedback(messageId, rating);
    setCopied(rating === 'helpful' ? 'Thanks for your feedback.' : 'Feedback captured. I will improve suggestions.');
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('Copied to clipboard.');
    } catch {
      setCopied('Unable to copy in this browser context.');
    }
  };

  const noData = Array.isArray(health.contractCount) ? false : Number(health.contractCount ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">AI Copilot</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Vantelyx Copilot</h2>
        <p className="mt-2 text-sm text-slate-600">Analyze contracts, risks, renewals, obligations, approvals, and vendor issues using local intelligence.</p>
        <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          AI-generated insights are decision-support only and should be reviewed by authorized business/legal users.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button key={prompt.label} onClick={() => submit(prompt.prompt)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
              {prompt.prompt}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Start by asking: “Which contracts are high risk?” or “What renewals are due in 90 days?”
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 ${item.role === 'user' ? 'border-slate-200 bg-slate-50' : 'border-brand-100 bg-white'}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.role === 'user' ? 'You' : 'Copilot'}</p>
                <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{item.text}</p>

                {item.response ? (
                  <div className="mt-3 space-y-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${toneByConfidence[item.response.confidence]}`}>
                      Confidence: {item.response.confidence}
                    </span>

                    {item.response.results.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {item.response.results.slice(0, 6).map((result) => (
                          <button
                            key={result.contractId}
                            onClick={() => {
                              window.localStorage.setItem('vantelyx_selected_contract_id', result.contractId);
                              window.location.hash = '#workspace';
                            }}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"
                          >
                            <p className="font-bold text-slate-900">{result.title}</p>
                            <p className="text-xs text-slate-500">{result.counterparty} · {result.status}</p>
                            <p className="mt-1 text-xs text-slate-700">{result.reason}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {item.response.results.length === 0 && item.response.intent.type === 'FIND_HIGH_RISK_CONTRACTS' ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        No high-risk contracts were found in the current dataset.
                      </div>
                    ) : null}

                    {item.response.draftText ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Draft Text</p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{item.response.draftText}</pre>
                        <button onClick={() => copyText(item.response?.draftText || '')} className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Copy Draft Text</button>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {item.response.actions.map((action) => (
                        <button key={action.label} onClick={() => runAction(action)} disabled={action.disabled} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">
                          {action.label}
                        </button>
                      ))}
                      <button onClick={() => feedback(item.response?.messageId || item.id, 'helpful')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Mark Helpful</button>
                      <button onClick={() => feedback(item.response?.messageId || item.id, 'not_helpful')} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">Mark Not Helpful</button>
                    </div>

                    {item.response.humanReviewReminder ? (
                      <p className="text-xs font-semibold text-amber-800">{item.response.humanReviewReminder}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-500">Copilot is thinking...</p> : null}
        {error ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p> : null}
        {copied ? <p className="mt-3 text-xs font-semibold text-emerald-700">{copied}</p> : null}

        {noData ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No contract data is available yet. Create a contract from AI Intake or Template Studio to start using Copilot.
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask: high-risk vendor agreements expiring in 90 days..."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
          />
          <button onClick={() => submit()} className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">Send</button>
        </div>
      </div>
    </div>
  );
}
