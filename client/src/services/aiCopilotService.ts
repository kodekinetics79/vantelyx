import { addActivityLog, getContracts, seedDemoData } from './vantelyxData';
import { getCurrentUser, getVisibleContracts, hasPermission } from './securityService';
import { getExecutionPackages } from './executionService';
import type { ClauseSignal, Contract, Obligation } from '../types/clm';
import type {
  ClauseRecommendation,
  ContractInsight,
  CopilotAction,
  CopilotConfidence,
  CopilotFeedback,
  CopilotIntent,
  CopilotIntentType,
  CopilotPromptSuggestion,
  CopilotResponse,
  NaturalLanguageSearchResult,
  RiskExplanation,
  SuggestedAction
} from '../types/ai';

const FEEDBACK_KEY = 'vantelyx_copilot_feedback';

const nowIso = (): string => new Date().toISOString();
const randomId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const readFeedback = (): CopilotFeedback[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as CopilotFeedback[]) : [];
  } catch {
    return [];
  }
};

const writeFeedback = (entries: CopilotFeedback[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
};

const safeContracts = (): Contract[] => {
  const seeded = getContracts();
  if (seeded.length === 0) {
    seedDemoData();
  }
  return getVisibleContracts(getContracts());
};

const confidenceFromCount = (count: number): CopilotConfidence => {
  if (count >= 3) return 'High';
  if (count >= 1) return 'Medium';
  return 'Low';
};

const riskLevel = (score: number | undefined): 'low' | 'medium' | 'high' | 'critical' => {
  const value = score ?? 0;
  if (value >= 85) return 'critical';
  if (value >= 70) return 'high';
  if (value >= 45) return 'medium';
  return 'low';
};

const daysUntil = (date: string | undefined): number => {
  if (!date) return Number.POSITIVE_INFINITY;
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
};

const hasMissingClause = (contract: Contract): boolean =>
  (contract.clauseSignals || []).some((clause) => clause.status === 'missing');

const normalize = (value: string): string => value.toLowerCase().trim();

const includesAny = (text: string, needles: string[]): boolean => needles.some((needle) => text.includes(needle));

const unknownResponse = (): CopilotResponse => ({
  messageId: randomId('copilot_msg'),
  summary:
    'I could not find enough contract data to answer that confidently. Try asking about renewals, approvals, obligations, high-risk contracts, or a specific contract.',
  confidence: 'Low',
  intent: { type: 'UNKNOWN', confidence: 'Low' },
  results: [],
  actions: [],
  citations: [{ label: 'Local contract dataset', source: 'contracts' }],
  humanReviewReminder: 'Review required by authorized legal/business users before action.'
});

export const detectIntent = (question: string): CopilotIntent => {
  const q = normalize(question);
  if (!q) return { type: 'GENERAL_HELP', confidence: 'Low' };

  if (includesAny(q, ['high risk', 'legal risks', 'procurement risks'])) return { type: 'FIND_HIGH_RISK_CONTRACTS', confidence: 'High' };
  if (includesAny(q, ['renewal', 'expiring', 'due in 30', 'due in 60', 'due in 90'])) return { type: 'FIND_UPCOMING_RENEWALS', confidence: 'High' };
  if (includesAny(q, ['pending approval', 'approvals are pending'])) return { type: 'FIND_PENDING_APPROVALS', confidence: 'High' };
  if (includesAny(q, ['overdue obligation', 'obligations are overdue', 'obligations due this week'])) return { type: 'FIND_OVERDUE_OBLIGATIONS', confidence: 'High' };
  if (includesAny(q, ['explain risk'])) return { type: 'EXPLAIN_CONTRACT_RISK', confidence: 'Medium' };
  if (includesAny(q, ['summarize contract', 'summarize this contract'])) return { type: 'SUMMARIZE_CONTRACT', confidence: 'Medium' };
  if (includesAny(q, ['draft approval note'])) return { type: 'DRAFT_APPROVAL_NOTE', confidence: 'High' };
  if (includesAny(q, ['draft renewal', 'renewal email', 'renewal notice email'])) return { type: 'DRAFT_RENEWAL_EMAIL', confidence: 'High' };
  if (includesAny(q, ['fallback', 'indemnity', 'limitation of liability'])) return { type: 'SUGGEST_CLAUSE_FALLBACK', confidence: 'High' };
  if (includesAny(q, ['vendor compliance', 'vendors have compliance'])) return { type: 'FIND_VENDOR_COMPLIANCE_ISSUES', confidence: 'High' };
  if (includesAny(q, ['execution blocker', 'waiting for signature', 'blocked'])) return { type: 'SHOW_EXECUTION_BLOCKERS', confidence: 'High' };
  if (includesAny(q, ['what should i work on today', 'what needs attention', 'executive summary', 'help'])) return { type: 'GENERAL_HELP', confidence: 'Medium' };

  return { type: 'UNKNOWN', confidence: 'Low' };
};

const toSearchResult = (contract: Contract, reason: string, confidence: CopilotConfidence): NaturalLanguageSearchResult => ({
  contractId: contract.id,
  title: contract.request.title,
  counterparty: contract.counterparty.name,
  status: contract.status,
  riskScore: contract.riskScore,
  reason,
  confidence
});

export const searchContractsNaturalLanguage = (query: string): NaturalLanguageSearchResult[] => {
  const q = normalize(query);
  const contracts = safeContracts();
  const execution = getExecutionPackages();

  const filtered = contracts.filter((contract) => {
    const renewalDays = daysUntil(contract.renewal?.renewalDate);
    const noticeDays = daysUntil(contract.renewal?.noticeDeadline);
    const overdueObligations = (contract.obligations || []).some((o) => (o.status !== 'done' && daysUntil(o.dueDate) < 0));
    const hasPendingApprovals = (contract.approvals || []).some((a) => a.decision !== 'approved');
    const pkg = execution.find((item) => item.contractId === contract.id);

    if (includesAny(q, ['high risk'])) return contract.riskScore >= 70;
    if (includesAny(q, ['low risk'])) return contract.riskScore < 45;
    if (includesAny(q, ['pending approval'])) return hasPendingApprovals;
    if (includesAny(q, ['executed'])) return contract.status === 'executed';
    if (includesAny(q, ['expiring soon'])) return renewalDays >= 0 && renewalDays <= 90;
    if (includesAny(q, ['due in 30'])) return renewalDays >= 0 && renewalDays <= 30;
    if (includesAny(q, ['due in 60'])) return renewalDays >= 0 && renewalDays <= 60;
    if (includesAny(q, ['due in 90'])) return renewalDays >= 0 && renewalDays <= 90;
    if (includesAny(q, ['auto-renew', 'auto renew'])) return !!contract.renewal?.autoRenew;
    if (includesAny(q, ['missing clause'])) return hasMissingClause(contract);
    if (includesAny(q, ['overdue obligation'])) return overdueObligations;
    if (includesAny(q, ['waiting for signature'])) return !!pkg && (pkg.status === 'sent' || pkg.status === 'partially_signed');
    if (includesAny(q, ['archived'])) return pkg?.status === 'archived';
    if (includesAny(q, ['missed renewal notice'])) return noticeDays < 0;

    const hay = [
      contract.request.title,
      contract.counterparty.name,
      contract.request.requesterName,
      contract.request.department || '',
      contract.request.contractType,
      contract.status,
      ...(contract.request.tags || [])
    ]
      .join(' ')
      .toLowerCase();

    return hay.includes(q);
  });

  return filtered.map((contract) => toSearchResult(contract, `Matched query: ${query}`, confidenceFromCount(filtered.length)));
};

const contractById = (contractId: string): Contract | undefined => safeContracts().find((contract) => contract.id === contractId);

export const summarizeContract = (contractId: string): ContractInsight => {
  const contract = contractById(contractId);
  if (!contract) {
    return {
      contractId,
      title: 'Unknown Contract',
      summary: 'Your current role does not have access to this contract insight.',
      riskScore: 0,
      missingClauses: [],
      pendingApprovals: 0,
      renewalInsight: { risk: 'low', recommendation: 'No data available.' },
      obligationInsight: { totalOpen: 0, overdue: 0, dueThisWeek: 0, recommendation: 'No obligations found.' },
      vendorRiskInsight: {
        counterparty: 'Unknown',
        complianceStatus: 'unknown',
        insuranceStatus: 'unknown',
        sanctionsStatus: 'unknown',
        risk: 'low'
      },
      confidence: 'Low',
      humanReviewNeeded: true
    };
  }

  const obligations = contract.obligations || [];
  const openObligations = obligations.filter((item) => item.status !== 'done');
  const overdue = openObligations.filter((item) => daysUntil(item.dueDate) < 0).length;
  const dueThisWeek = openObligations.filter((item) => {
    const d = daysUntil(item.dueDate);
    return d >= 0 && d <= 7;
  }).length;

  const insight: ContractInsight = {
    contractId: contract.id,
    title: contract.request.title,
    summary: `${contract.request.title} with ${contract.counterparty.name} is currently ${contract.status}. Risk score ${contract.riskScore}.`,
    riskScore: contract.riskScore,
    missingClauses: (contract.clauseSignals || []).filter((signal) => signal.status === 'missing').map((signal) => signal.clause),
    pendingApprovals: (contract.approvals || []).filter((item) => item.decision !== 'approved').length,
    renewalInsight: {
      renewalDate: contract.renewal?.renewalDate,
      noticeDeadline: contract.renewal?.noticeDeadline,
      daysUntilNotice: daysUntil(contract.renewal?.noticeDeadline),
      autoRenew: !!contract.renewal?.autoRenew,
      risk: contract.renewal?.renewalRisk || riskLevel(contract.riskScore),
      recommendation: contract.renewal?.recommendedAction || 'Review renewal strategy with owner.'
    },
    obligationInsight: {
      totalOpen: openObligations.length,
      overdue,
      dueThisWeek,
      recommendation: overdue > 0 ? 'Prioritize overdue obligations immediately.' : 'Track open obligations through due date.'
    },
    vendorRiskInsight: {
      counterparty: contract.counterparty.name,
      complianceStatus: contract.counterparty.complianceStatus,
      insuranceStatus: contract.counterparty.insuranceStatus,
      sanctionsStatus: contract.counterparty.sanctionsStatus,
      risk: contract.counterparty.riskLevel || riskLevel(contract.riskScore)
    },
    confidence: 'High',
    humanReviewNeeded: contract.riskScore >= 70 || hasMissingClause(contract)
  };

  addActivityLog(contract.id, {
    actor: getCurrentUser().fullName || 'Copilot User',
    event: 'comment',
    message: 'Copilot summary generated',
    action: 'AI Copilot',
    note: 'Rule-based summary generated from local dataset.',
    source: 'AI Copilot',
    labels: ['system generated', 'review required']
  });

  return insight;
};

export const explainRisk = (contractId: string): RiskExplanation => {
  const contract = contractById(contractId);
  if (!contract) {
    return {
      contractId,
      title: 'Unknown Contract',
      riskScore: 0,
      level: 'low',
      riskDrivers: ['No contract data visible for this request.'],
      missingClauseWarnings: [],
      confidence: 'Low',
      reviewReminder: 'Review required by authorized legal/business users before action.'
    };
  }

  const missing = (contract.clauseSignals || []).filter((item) => item.status === 'missing').map((item) => item.clause);
  const drivers = [
    ...(contract.riskSignals || []).map((item) => `${item.name}: ${item.reason}`),
    ...(contract.renewal?.autoRenew ? ['Auto-renew enabled; verify notice strategy.'] : []),
    ...((contract.obligations || []).some((item) => daysUntil(item.dueDate) < 0) ? ['Overdue obligations increase operational risk.'] : [])
  ];

  const explanation: RiskExplanation = {
    contractId: contract.id,
    title: contract.request.title,
    riskScore: contract.riskScore,
    level: riskLevel(contract.riskScore),
    riskDrivers: drivers.length > 0 ? drivers : ['No high-confidence risk drivers found.'],
    missingClauseWarnings: missing,
    confidence: drivers.length > 0 ? 'High' : 'Medium',
    reviewReminder: 'Review required by authorized legal/business users before action.'
  };

  addActivityLog(contract.id, {
    actor: getCurrentUser().fullName || 'Copilot User',
    event: 'comment',
    message: 'Copilot risk explanation viewed',
    action: 'AI Copilot',
    note: `Risk level ${explanation.level}, score ${explanation.riskScore}.`,
    source: 'AI Copilot',
    labels: ['system generated', 'review required']
  });

  return explanation;
};

export const generateNextBestActions = (contractId: string): SuggestedAction[] => {
  const contract = contractById(contractId);
  if (!contract) return [];

  const actions: SuggestedAction[] = [];
  if ((contract.approvals || []).some((item) => item.decision !== 'approved')) {
    actions.push({
      label: hasPermission('contracts.approve') ? 'Complete pending approvals' : 'Request authorized approver review',
      rationale: 'Approval steps are still open.',
      priority: 'high',
      requiresApproval: true
    });
  }
  if ((contract.obligations || []).some((item) => daysUntil(item.dueDate) < 0 && item.status !== 'done')) {
    actions.push({
      label: 'Resolve overdue obligations',
      rationale: 'One or more obligations are overdue.',
      priority: 'critical'
    });
  }
  if (daysUntil(contract.renewal?.noticeDeadline) <= 30) {
    actions.push({
      label: 'Start renewal review',
      rationale: 'Notice deadline is within 30 days.',
      priority: 'high'
    });
  }
  if (hasMissingClause(contract)) {
    actions.push({
      label: 'Run clause fallback review',
      rationale: 'Missing key clauses were detected.',
      priority: 'high'
    });
  }

  return actions;
};

export const draftApprovalNote = (contractId: string): string => {
  const contract = contractById(contractId);
  if (!contract) return 'Unable to draft approval note because the contract is not visible in your current access scope.';
  const text = [
    `Approval Note: ${contract.request.title}`,
    `Counterparty: ${contract.counterparty.name}`,
    `Value: ${contract.request.currency} ${contract.request.estimatedValue.toLocaleString()}`,
    `Risk Score: ${contract.riskScore}`,
    `Key Risks: ${(contract.riskSignals || []).map((item) => item.name).join(', ') || 'No major risks flagged.'}`,
    `Recommendation: ${hasPermission('contracts.approve') ? 'Proceed with approval subject to legal confirmation.' : 'Route to authorized approver for final decision.'}`
  ].join('\n');

  addActivityLog(contract.id, {
    actor: getCurrentUser().fullName || 'Copilot User',
    event: 'comment',
    message: 'Copilot drafted approval note',
    action: 'AI Copilot',
    note: 'Draft approval note generated.',
    source: 'AI Copilot',
    labels: ['system generated', 'review required']
  });

  return text;
};

export const draftRenewalEmail = (contractId: string): string => {
  const contract = contractById(contractId);
  if (!contract) return 'Unable to draft renewal email because the contract is not visible in your current access scope.';
  const text = [
    `Subject: Renewal Notice - ${contract.request.title}`,
    '',
    `Hello ${contract.counterparty.name},`,
    '',
    `This is a formal renewal notice regarding ${contract.request.title}.`,
    `Current renewal date: ${contract.renewal.renewalDate || 'N/A'}`,
    `Notice deadline: ${contract.renewal.noticeDeadline || 'N/A'}`,
    '',
    `Recommended next step: ${contract.renewal.recommendedAction || 'Please confirm renewal intent.'}`,
    '',
    'Regards,',
    getCurrentUser().fullName || 'Vantelyx CLM Team'
  ].join('\n');

  addActivityLog(contract.id, {
    actor: getCurrentUser().fullName || 'Copilot User',
    event: 'comment',
    message: 'Copilot drafted renewal notice',
    action: 'AI Copilot',
    note: 'Draft renewal email generated.',
    source: 'AI Copilot',
    labels: ['system generated', 'review required']
  });

  return text;
};

const clauseFallbackTemplates: Record<string, string> = {
  indemnity:
    'Each party will indemnify, defend, and hold harmless the other party from third-party claims arising from its breach of this agreement, negligence, or willful misconduct.',
  'limitation of liability':
    'Except for excluded liabilities, each party\'s aggregate liability will not exceed fees paid in the 12 months preceding the claim.',
  confidentiality:
    'Each party will protect confidential information using at least reasonable care and use it only for purposes of this agreement.'
};

export const suggestClauseFallback = (clauseName: string, riskLevelInput: string): ClauseRecommendation => {
  const key = normalize(clauseName);
  const match = Object.keys(clauseFallbackTemplates).find((item) => key.includes(item));
  const fallbackLanguage = match
    ? clauseFallbackTemplates[match]
    : 'Use approved Vantelyx legal playbook fallback for this clause before proceeding.';

  return {
    clauseName,
    riskLevel: riskLevelInput,
    fallbackLanguage,
    rationale: 'Fallback language is generated from local rule-based playbook mappings.',
    confidence: match ? 'High' : 'Medium'
  };
};

export const getPromptSuggestions = (context?: string): CopilotPromptSuggestion[] => {
  const base: CopilotPromptSuggestion[] = [
    { label: 'High risk', prompt: 'Which contracts are high risk?' },
    { label: 'Renewals', prompt: 'What renewals are due in 90 days?' },
    { label: 'Approvals', prompt: 'Which approvals are pending?' },
    { label: 'Obligations', prompt: 'Which obligations are overdue?' },
    { label: 'Vendors', prompt: 'Which vendors have compliance issues?' },
    { label: 'Today\'s work', prompt: 'What should I work on today?' }
  ];

  if (context?.toLowerCase().includes('workspace')) {
    base.unshift({ label: 'Summarize contract', prompt: 'Summarize this contract.' });
    base.unshift({ label: 'Explain risk', prompt: 'Explain risk on this contract.' });
  }

  return base;
};

export const askCopilot = (question: string, context?: Record<string, unknown>): CopilotResponse => {
  const intent = detectIntent(question);
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      messageId: randomId('copilot_msg'),
      summary: 'Ask me about contracts, renewals, approvals, obligations, risks, vendors, or clauses.',
      confidence: 'Low',
      intent,
      results: [],
      actions: [],
      citations: [{ label: 'Copilot prompt guidance', source: 'contracts' }]
    };
  }

  const contracts = safeContracts();
  if (contracts.length === 0) {
    return {
      messageId: randomId('copilot_msg'),
      summary: 'No contract data is available yet. Create a contract from AI Intake or Template Studio to start using Copilot.',
      confidence: 'Low',
      intent,
      results: [],
      actions: [],
      citations: [{ label: 'Local contract dataset', source: 'contracts' }]
    };
  }

  const workspaceId = typeof context?.contractId === 'string' ? context.contractId : undefined;
  const targetId = workspaceId || contracts.find((item) => normalize(trimmed).includes(normalize(item.request.title)))?.id;

  let results: NaturalLanguageSearchResult[] = [];
  let summary = '';
  let riskExplanation: RiskExplanation | undefined;
  let insights: ContractInsight[] | undefined;
  let draftText: string | undefined;
  let clauseRecommendation: ClauseRecommendation | undefined;

  if (intent.type === 'FIND_HIGH_RISK_CONTRACTS') {
    results = contracts.filter((item) => item.riskScore >= 70).map((item) => toSearchResult(item, 'Risk score >= 70', 'High'));
    summary = results.length > 0 ? `${results.length} high-risk contracts found.` : 'No high-risk contracts were found in the current dataset.';
  } else if (intent.type === 'FIND_UPCOMING_RENEWALS') {
    const d = includesAny(normalize(trimmed), ['30']) ? 30 : includesAny(normalize(trimmed), ['60']) ? 60 : 90;
    results = contracts
      .filter((item) => {
        const renewalDays = daysUntil(item.renewal?.renewalDate);
        return renewalDays >= 0 && renewalDays <= d;
      })
      .map((item) => toSearchResult(item, `Renewal due within ${d} days`, 'High'));
    summary = results.length > 0 ? `${results.length} renewals are due within ${d} days.` : `No renewals are due within ${d} days.`;
  } else if (intent.type === 'FIND_PENDING_APPROVALS') {
    results = contracts
      .filter((item) => (item.approvals || []).some((step) => step.decision !== 'approved'))
      .map((item) => toSearchResult(item, 'Has pending approval steps', 'High'));
    summary = results.length > 0 ? `${results.length} contracts are pending approval.` : 'No pending approvals were found.';
  } else if (intent.type === 'FIND_OVERDUE_OBLIGATIONS') {
    const week = includesAny(normalize(trimmed), ['this week']);
    results = contracts
      .filter((item) =>
        (item.obligations || []).some((obligation) => {
          if (obligation.status === 'done') return false;
          const days = daysUntil(obligation.dueDate);
          return week ? days >= 0 && days <= 7 : days < 0;
        })
      )
      .map((item) => toSearchResult(item, week ? 'Obligation due this week' : 'Overdue obligations detected', 'High'));
    summary = week
      ? results.length > 0
        ? `${results.length} contracts have obligations due this week.`
        : 'No obligations are due this week.'
      : results.length > 0
      ? `${results.length} contracts have overdue obligations.`
      : 'No overdue obligations were found.';
  } else if (intent.type === 'FIND_VENDOR_COMPLIANCE_ISSUES') {
    results = contracts
      .filter((item) => item.counterparty.complianceStatus !== 'compliant')
      .map((item) => toSearchResult(item, `Vendor compliance status: ${item.counterparty.complianceStatus}`, 'High'));
    summary = results.length > 0 ? `${results.length} vendor compliance issues found.` : 'No vendor compliance issues were found.';
  } else if (intent.type === 'SHOW_EXECUTION_BLOCKERS') {
    const execution = getExecutionPackages();
    results = contracts
      .filter((contract) => {
        const pkg = execution.find((item) => item.contractId === contract.id);
        if (!pkg) return false;
        return pkg.status === 'draft' || pkg.status === 'sent';
      })
      .map((contract) => toSearchResult(contract, 'Execution package not finalized', 'Medium'));
    summary = results.length > 0 ? `${results.length} contracts appear to have execution blockers.` : 'No execution blockers were found.';
  } else if (intent.type === 'EXPLAIN_CONTRACT_RISK' && targetId) {
    riskExplanation = explainRisk(targetId);
    summary = `Risk explanation generated for ${riskExplanation.title}.`;
  } else if (intent.type === 'SUMMARIZE_CONTRACT' && targetId) {
    insights = [summarizeContract(targetId)];
    summary = insights[0].summary;
  } else if (intent.type === 'DRAFT_APPROVAL_NOTE' && targetId) {
    draftText = draftApprovalNote(targetId);
    summary = 'Draft approval note generated.';
  } else if (intent.type === 'DRAFT_RENEWAL_EMAIL' && targetId) {
    draftText = draftRenewalEmail(targetId);
    summary = 'Draft renewal notice email generated.';
  } else if (intent.type === 'SUGGEST_CLAUSE_FALLBACK') {
    const clause = includesAny(normalize(trimmed), ['limitation'])
      ? 'Limitation of Liability'
      : includesAny(normalize(trimmed), ['indemnity'])
      ? 'Indemnity'
      : 'Confidentiality';
    clauseRecommendation = suggestClauseFallback(clause, 'high');
    summary = `Fallback suggestion generated for ${clause}.`;
  } else if (intent.type === 'GENERAL_HELP') {
    results = searchContractsNaturalLanguage('high risk');
    summary = results.length > 0
      ? `Today’s priority includes ${results.length} high-risk contracts. Ask me for renewals, obligations, approvals, or vendor compliance details.`
      : 'Ask me about high-risk contracts, renewals, obligations, approvals, vendors, or execution blockers.';
  } else {
    return unknownResponse();
  }

  const response: CopilotResponse = {
    messageId: randomId('copilot_msg'),
    summary,
    confidence: results.length > 0 || insights || riskExplanation || draftText ? 'High' : 'Medium',
    intent,
    results,
    insights,
    riskExplanation,
    draftText,
    clauseRecommendation,
    actions: buildActions(results, targetId),
    citations: [
      { label: 'Contracts localStorage', source: 'contracts' },
      { label: 'Renewal and obligation fields', source: 'renewals' },
      { label: 'Workflow and approvals', source: 'approvals' }
    ],
    humanReviewReminder:
      'Review required by authorized legal/business users before action.'
  };

  return response;
};

const buildActions = (results: NaturalLanguageSearchResult[], targetId?: string): CopilotAction[] => {
  const base: CopilotAction[] = [
    { type: 'FILTER_REPOSITORY', label: 'Open Repository View' },
    { type: 'OPEN_RENEWALS', label: 'Open Renewals' },
    { type: 'OPEN_OBLIGATIONS', label: 'Open Obligations' },
    { type: 'OPEN_WORK_QUEUE', label: 'Open Work Queue' }
  ];

  if (targetId) {
    base.unshift({ type: 'OPEN_CONTRACT', label: 'Open Contract', contractId: targetId });
    base.unshift({ type: 'OPEN_WORKSPACE', label: 'Open Workspace', contractId: targetId });
  } else if (results[0]) {
    base.unshift({ type: 'OPEN_CONTRACT', label: 'Open Contract', contractId: results[0].contractId });
  }

  if (!hasPermission('reports.export')) {
    base.push({ type: 'EXPORT_RESULTS', label: 'Export Results', disabled: true, reason: 'Your role cannot export results.' });
  } else {
    base.push({ type: 'EXPORT_RESULTS', label: 'Export Results' });
  }

  return base;
};

export const getCopilotHealth = (): Record<string, unknown> => ({
  mode: 'rule-based-local',
  contractCount: safeContracts().length,
  feedbackEntries: readFeedback().length,
  status: 'healthy',
  timestamp: nowIso(),
  capabilities: ['search', 'summarize', 'risk-explanation', 'drafting', 'clause-fallback']
});

export const recordCopilotFeedback = (
  messageId: string,
  rating: 'helpful' | 'not_helpful',
  note?: string
): void => {
  const next = [{ messageId, rating, note, timestamp: nowIso() }, ...readFeedback()].slice(0, 400);
  writeFeedback(next);
};

// TODO: OpenAI API integration point for askCopilot orchestration.
// TODO: Azure OpenAI deployment routing and model failover.
// TODO: Ollama / private local model connector for on-prem inference.
// TODO: Retrieval augmented generation with vector search over contract corpus.
// TODO: Document embeddings for PDF/DOCX clause-level semantic lookup.
// TODO: Clause similarity search and negotiation delta recommendations.
// TODO: Contract ingestion pipeline for raw document parsing.
// TODO: Prompt safety filters, policy checks, and hallucination guards.
// TODO: Dedicated AI response audit logging with immutable trace IDs.
// TODO: Human-in-the-loop approval workflow for high-impact AI actions.
// TODO: Data privacy controls and redaction before model invocation.
// TODO: Tenant-specific AI boundary enforcement in multi-tenant deployments.
