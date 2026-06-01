import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  addActivityLog,
  getCounterpartyByName,
  getContractById,
  updateClauseReviewAction,
  updateApprovalStep,
  updateContractStatus,
  updateObligationStatus,
  updateRenewalAction
} from '../services/vantelyxData';
import { canApproveContract, canEditContract, hasPermission } from '../services/securityService';
import { clmRepository } from '../services/clmRepository';
import {
  draftApprovalNote,
  explainRisk,
  generateNextBestActions,
  suggestClauseFallback,
  summarizeContract
} from '../services/aiCopilotService';
import type { ActivityLog, ClauseReviewAction, ClauseReviewItem, Contract, DocumentIntelligence } from '../types/clm';
import type { ExecutionPackage, SignatureAuditEvent } from '../types/execution';

type WorkspaceTab = 'Summary' | 'Clauses' | 'Approvals' | 'Obligations' | 'Renewals' | 'Execution' | 'Document Intelligence' | 'Activity';

type ContractWorkspaceProps = {
  contractId?: string;
};

const STORAGE_SELECTION_KEY = 'vantelyx_selected_contract_id';

const tabs: WorkspaceTab[] = ['Summary', 'Clauses', 'Approvals', 'Obligations', 'Renewals', 'Execution', 'Document Intelligence', 'Activity'];

const parseRouteContractId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const url = new URL(window.location.href);
  const searchId = url.searchParams.get('contractId') ?? url.searchParams.get('id');
  if (searchId) {
    return searchId;
  }

  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParts = hash.split('/').filter(Boolean);
  if (hashParts.length >= 2 && (hashParts[0] === 'workspace' || hashParts[0] === 'contracts')) {
    return hashParts[1];
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && (pathParts[pathParts.length - 2] === 'workspace' || pathParts[pathParts.length - 2] === 'contracts')) {
    return pathParts[pathParts.length - 1];
  }

  return undefined;
};

const getRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const statusTone: Record<string, string> = {
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

const riskTone: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  medium: 'bg-brand-50 text-brand-700 border-brand-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100'
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const prettyStatus = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getContractSource = (contract: Contract): 'AI Intake' | 'Template Draft' | 'Imported Contract' => {
  const metadataSource = contract.request.metadata?.source;
  if (metadataSource === 'AI Intake' || metadataSource === 'Template Draft' || metadataSource === 'Imported Contract') {
    return metadataSource;
  }
  return contract.source ?? 'AI Intake';
};

const getAuthoringContext = (
  contract: Contract
): { sourceTemplate: string; draftVersion: string; authoringStatus: string } => ({
  sourceTemplate: contract.authoring?.sourceTemplate ?? contract.request.metadata?.sourceTemplate ?? 'N/A',
  draftVersion: String(contract.authoring?.draftVersion ?? contract.request.metadata?.draftVersion ?? 'N/A'),
  authoringStatus: contract.authoring?.authoringStatus ?? contract.request.metadata?.authoringStatus ?? 'N/A'
});

const renewalRecommendation = (contract: Contract): string => {
  const now = new Date();
  const notice = new Date(contract.renewal.noticeDeadline);
  const renewal = new Date(contract.renewal.renewalDate);

  if (Number.isNaN(notice.getTime()) || Number.isNaN(renewal.getTime())) {
    return 'Validate renewal metadata before decisioning.';
  }

  if (notice <= now) {
    return 'Notice window is due or passed. Escalate to legal and owner immediately.';
  }

  const daysToNotice = Math.ceil((notice.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysToNotice <= 30) {
    return 'Renewal notice due within 30 days. Prepare recommendation pack now.';
  }

  if (contract.renewal.autoRenew) {
    return 'Auto-renew enabled. Review commercial performance before notice deadline.';
  }

  return 'Manual renewal expected. Start negotiation planning ahead of notice date.';
};

const buildDocumentIntelligenceFallback = (contract: Contract): DocumentIntelligence => {
  const findClause = (key: string): 'present' | 'missing' =>
    contract.clauseSignals.some((clause) => clause.clause.toLowerCase().includes(key.toLowerCase()) && clause.status !== 'missing')
      ? 'present'
      : 'missing';

  const confidentiality = findClause('confidentiality');
  const limitation = findClause('limitation');
  const indemnity: 'present' | 'missing' = contract.request.estimatedValue >= 100_000 ? 'present' : 'missing';

  const confidence = {
    documentName: 0.88,
    documentType: 0.9,
    extractedParties: 0.87,
    effectiveDate: 0.83,
    expirationDate: 0.8,
    governingLaw: contract.request.jurisdiction ? 0.86 : 0.55,
    paymentTerms: contract.request.paymentTerms ? 0.88 : 0.57,
    terminationRights: 0.71,
    confidentiality: confidentiality === 'present' ? 0.9 : 0.56,
    indemnity: indemnity === 'present' ? 0.76 : 0.54,
    limitationOfLiability: limitation === 'present' ? 0.84 : 0.55,
    autoRenewLanguage: contract.renewal.autoRenew ? 0.85 : 0.65,
    assignmentRestriction: 0.69,
    insuranceRequirement: contract.request.contractType === 'Vendor Agreement' ? 0.82 : 0.63,
    auditRights: 0.67
  };

  const lowConfidence = Object.entries(confidence).filter(([, v]) => v < 0.7).map(([k]) => k);
  const reasons: string[] = [];

  if (contract.riskScore >= 70) reasons.push('High contract risk score');
  if (lowConfidence.length > 0) reasons.push(`Low AI confidence in: ${lowConfidence.join(', ')}`);
  if (confidentiality === 'missing' || indemnity === 'missing' || limitation === 'missing') {
    reasons.push('Critical clause coverage is incomplete');
  }
  if (contract.renewal.autoRenew && !contract.renewal.noticeDeadline) {
    reasons.push('Auto-renew exists without notice deadline');
  }

  return {
    documentName: `${contract.request.title}.pdf`,
    documentType: contract.request.contractType,
    extractedParties: ['Vantelyx, Inc.', contract.counterparty.name],
    effectiveDate: contract.request.startDate,
    expirationDate: contract.renewal.renewalDate,
    governingLaw: contract.request.jurisdiction ?? 'Not explicitly identified',
    paymentTerms: contract.request.paymentTerms ?? 'Not found',
    terminationRights: 'Termination for cause and convenience language detected. Legal validation recommended.',
    confidentiality,
    indemnity,
    limitationOfLiability: limitation,
    autoRenewLanguage: contract.renewal.autoRenew ? 'Auto-renew language detected.' : 'No explicit auto-renew language detected.',
    assignmentRestriction: 'Assignment restricted without written consent.',
    insuranceRequirement:
      contract.request.contractType === 'Vendor Agreement'
        ? 'Insurance requirement detected for liability and cyber coverage.'
        : 'Insurance language not clearly identified.',
    auditRights:
      contract.request.contractType === 'Vendor Agreement'
        ? 'Audit rights detected for compliance verification.'
        : 'Audit rights not clearly identified.',
    confidence,
    humanReviewNeeded: reasons.length > 0,
    humanReviewReasons: reasons
  };
};

const confidenceTone = (value: number): string => {
  if (value < 0.7) return 'bg-red-500';
  if (value < 0.85) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const buildClauseReviewFallback = (contract: Contract): ClauseReviewItem[] => {
  const signalByName = new Map(contract.clauseSignals.map((signal) => [signal.clause.toLowerCase(), signal]));
  const clauses = [
    'Confidentiality',
    'Indemnification',
    'Limitation of Liability',
    'Termination',
    'Renewal',
    'Payment Terms',
    'Data Protection',
    'Governing Law',
    'Insurance',
    'Assignment',
    'Audit Rights'
  ];

  return clauses.map((name, idx) => {
    const signal =
      signalByName.get(name.toLowerCase()) ??
      [...signalByName.values()].find(
        (candidate) =>
          name.toLowerCase().includes(candidate.clause.toLowerCase()) ||
          candidate.clause.toLowerCase().includes(name.toLowerCase())
      );

    const status: ClauseReviewItem['status'] =
      !signal || signal.status === 'missing'
        ? 'missing'
        : signal.status === 'needs_review' || signal.status === 'non_standard'
        ? 'risky'
        : 'acceptable';

    const playbookLabel: ClauseReviewItem['playbookLabel'] =
      status === 'missing' ? 'Blocker' : status === 'risky' ? 'Needs Review' : 'Standard';

    return {
      id: `fallback_${idx}_${name.toLowerCase().replace(/\s+/g, '_')}`,
      clause: name,
      status,
      playbookLabel,
      aiRiskNote: signal?.message ?? 'Clause language not confidently extracted.',
      recommendedFallbackLanguage: `Use Vantelyx standard ${name.toLowerCase()} clause from legal playbook.`,
      businessImpact: 'Non-standard drafting can increase commercial and legal exposure.',
      legalReviewRequired: status !== 'acceptable'
    };
  });
};

export default function ContractWorkspace({ contractId }: ContractWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Summary');
  const [selectedId, setSelectedId] = useState<string | undefined>(contractId);
  const [contract, setContract] = useState<Contract | undefined>();
  const [message, setMessage] = useState<string>('');
  const [executionPackage, setExecutionPackage] = useState<ExecutionPackage | undefined>();
  const [executionAudit, setExecutionAudit] = useState<SignatureAuditEvent[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (contractId) {
      setSelectedId(contractId);
      return;
    }

    const fromRoute = parseRouteContractId();
    const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_SELECTION_KEY) ?? undefined : undefined;
    setSelectedId(fromRoute ?? fromStorage);
  }, [contractId]);

  useEffect(() => {
    if (!selectedId) {
      setContract(undefined);
      setExecutionPackage(undefined);
      setExecutionAudit([]);
      return;
    }

    const loaded = getContractById(selectedId);
    setContract(loaded);
    const pkg = clmRepository.getExecutionPackageByContractId(selectedId);
    setExecutionPackage(pkg);
    setExecutionAudit(pkg ? clmRepository.getExecutionAuditByPackage(pkg.id) : []);
  }, [selectedId, refreshTick]);

  const headerRisk = useMemo(() => (contract ? getRiskLevel(contract.riskScore) : 'low'), [contract]);
  const documentIntelligence = useMemo(
    () => (contract ? contract.documentIntelligence ?? buildDocumentIntelligenceFallback(contract) : undefined),
    [contract]
  );
  const clauseReviews = useMemo(
    () => (contract ? contract.clauseReviews ?? buildClauseReviewFallback(contract) : []),
    [contract]
  );
  const counterpartyIntelligence = useMemo(
    () => (contract ? getCounterpartyByName(contract.counterparty.name) : undefined),
    [contract]
  );
  const contractSource = useMemo(() => (contract ? getContractSource(contract) : 'AI Intake'), [contract]);
  const authoringContext = useMemo(
    () => (contract ? getAuthoringContext(contract) : { sourceTemplate: 'N/A', draftVersion: 'N/A', authoringStatus: 'N/A' }),
    [contract]
  );
  const canSubmitForReview = hasPermission('contracts.submit_review');
  const canExecute = hasPermission('contracts.execute');
  const canManageObligations = hasPermission('obligations.manage');
  const canManageRenewals = hasPermission('renewals.manage');
  const canApprove = contract ? canApproveContract(contract) : false;
  const canEdit = contract ? canEditContract(contract) : false;
  const hasPendingApprovals = !!contract?.approvals.some((step) => step.decision !== 'approved');
  const checklistReady = contract?.request.metadata?.executionChecklistReady === 'true' || authoringContext.authoringStatus === 'converted';
  const hasSigner = !!executionPackage && executionPackage.signers.length > 0;
  const highRiskUnresolved = clauseReviews.some(
    (clause) => clause.legalReviewRequired && (clause.status === 'risky' || clause.status === 'missing')
  );
  const executionBlockers = [
    ...(hasPendingApprovals ? ['Pending approvals'] : []),
    ...(!checklistReady ? ['Incomplete checklist'] : []),
    ...(!hasSigner ? ['Missing signer'] : []),
    ...(highRiskUnresolved ? ['High-risk clause unresolved'] : [])
  ];
  const executionReadyByStatus = contract ? contract.status === 'approved' || contract.status === 'counterparty_review' : false;
  const executionReady = executionReadyByStatus && executionBlockers.length === 0;
  const postExecutionObligationsActive = useMemo(() => {
    if (!contract) return false;
    if (contract.status !== 'executed' && !executionPackage?.executedAt) return false;
    return contract.obligations.length > 0 || !!contract.renewal;
  }, [contract, executionPackage]);
  const aiSummary = useMemo(() => (contract ? summarizeContract(contract.id) : undefined), [contract]);
  const aiRisk = useMemo(() => (contract ? explainRisk(contract.id) : undefined), [contract]);
  const aiActions = useMemo(() => (contract ? generateNextBestActions(contract.id) : []), [contract]);
  const aiApprovalNote = useMemo(() => (contract ? draftApprovalNote(contract.id) : ''), [contract]);
  const aiFallbackIndemnity = useMemo(() => suggestClauseFallback('Indemnity', contract ? getRiskLevel(contract.riskScore) : 'medium'), [contract]);
  const aiFallbackLiability = useMemo(
    () => suggestClauseFallback('Limitation of Liability', contract ? getRiskLevel(contract.riskScore) : 'medium'),
    [contract]
  );

  const denyMessage = () => {
    setMessage('Your current role does not have permission to perform this action.');
  };

  const reload = () => {
    if (!selectedId) return;
    setContract(getContractById(selectedId));
    setRefreshTick((value) => value + 1);
  };

  const createExecutionPackage = () => {
    if (!contract) return;
    const pkg = clmRepository.createExecutionPackage(contract.id);
    if (!pkg) {
      setMessage('Unable to create execution package.');
      return;
    }
    setMessage('Execution package created.');
    reload();
  };

  const sendForSignature = () => {
    if (!executionPackage) return;
    if (!executionReady) {
      setMessage('Execution blocked. Resolve blockers before sending.');
      return;
    }
    clmRepository.markExecutionPackageSent(executionPackage.id);
    setMessage('Execution package sent for signature.');
    reload();
  };

  const markExecutionComplete = () => {
    if (!executionPackage || !contract) return;
    if (!executionReady) {
      setMessage('Execution blocked. Resolve blockers before marking executed.');
      return;
    }
    clmRepository.markExecutionPackageExecuted(executionPackage.id);
    addActivityLog(contract.id, {
      actor: 'Workspace User',
      event: 'status_changed',
      message: 'Contract execution finalized from workspace.',
      action: 'Execution Control',
      previousStatus: contract.status,
      newStatus: 'executed',
      note: 'Execution tab action completed.',
      source: 'Workflow',
      labels: ['user action', 'completed']
    });
    setMessage('Contract marked executed and obligations/renewals remain active.');
    reload();
  };

  const archiveFinalVersion = () => {
    if (!executionPackage) return;
    clmRepository.archiveExecutionFinalContract(executionPackage.id);
    setMessage('Final contract version archived.');
    reload();
  };

  const applyStatusAction = (action: 'submit' | 'approve' | 'changes' | 'executed') => {
    if (!contract) return;
    if (action === 'submit' && !canSubmitForReview) return denyMessage();
    if ((action === 'approve' || action === 'changes') && !canApprove) return denyMessage();
    if (action === 'executed' && !canExecute) return denyMessage();

    if (action === 'submit') {
      updateContractStatus(contract.id, 'internal_review', 'Submitted for review from workspace action.');
      addActivityLog(contract.id, {
        actor: 'Workspace User',
        event: 'comment',
        message: 'Submitted contract for internal review.'
      });
      setMessage('Contract submitted for review.');
    }

    if (action === 'approve') {
      contract.approvals.forEach((step) => {
        if (step.decision === 'pending' || step.decision === 'changes_requested') {
          updateApprovalStep(contract.id, step.id, 'approved', 'Approved from contract workspace action.');
        }
      });
      updateContractStatus(contract.id, 'approved', 'Approved from workspace action.');
      addActivityLog(contract.id, {
        actor: 'Workspace User',
        event: 'comment',
        message: 'Contract approved and moved to approved status.'
      });
      setMessage('Contract approved.');
    }

    if (action === 'changes') {
      const pending = contract.approvals.find((step) => step.decision === 'pending') ?? contract.approvals[0];
      if (pending) {
        updateApprovalStep(contract.id, pending.id, 'changes_requested', 'Changes requested from workspace action.');
      }
      updateContractStatus(contract.id, 'drafting', 'Changes requested from workspace action.');
      addActivityLog(contract.id, {
        actor: 'Workspace User',
        event: 'comment',
        message: 'Requested changes and moved contract back to drafting.'
      });
      setMessage('Changes requested and contract moved to drafting.');
    }

    if (action === 'executed') {
      updateContractStatus(contract.id, 'executed', 'Marked executed from workspace action.');
      addActivityLog(contract.id, {
        actor: 'Workspace User',
        event: 'comment',
        message: 'Contract marked as executed.'
      });
      setMessage('Contract marked as executed.');
    }

    reload();
  };

  const markObligationCompleted = (obligationId: string) => {
    if (!contract) return;
    if (!canManageObligations) return denyMessage();
    updateObligationStatus(contract.id, obligationId, 'done');
    addActivityLog(contract.id, {
      actor: 'Workspace User',
      event: 'comment',
      message: `Marked obligation ${obligationId} as completed.`
    });
    setMessage('Obligation marked completed.');
    reload();
  };

  const setApprovalDecision = (stepId: string, decision: 'approved' | 'changes_requested') => {
    if (!contract) return;
    if (!canApprove) return denyMessage();
    updateApprovalStep(contract.id, stepId, decision, `Decision set to ${decision} from workspace.`);
    addActivityLog(contract.id, {
      actor: 'Workspace User',
      event: 'comment',
      message: `Approval step updated to ${decision}.`
    });
    setMessage(`Approval step updated: ${decision}.`);
    reload();
  };

  const runClauseAction = (clauseReviewId: string, action: ClauseReviewAction) => {
    if (!contract) return;
    if (!canEdit) return denyMessage();
    updateClauseReviewAction(contract.id, clauseReviewId, action);
    addActivityLog(contract.id, {
      actor: 'Workspace User',
      event: 'comment',
      message: `Clause action applied: ${clauseReviewId} -> ${action}.`
    });
    setMessage(`Clause action saved: ${action}.`);
    reload();
  };

  const runRenewalAction = (
    action: 'start_review' | 'notice_sent' | 'do_not_renew' | 'renewed' | 'escalate'
  ) => {
    if (!contract) return;
    if (!canManageRenewals) return denyMessage();
    updateRenewalAction(contract.id, action);
    setMessage(`Renewal action saved: ${action}.`);
    reload();
  };

  if (!contract) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Contract Workspace</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">No contract selected</h2>
        <p className="mt-3 text-sm text-slate-500">
          Select a contract from Repository to load details. The workspace reads contract id from route params or localStorage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Contract Workspace</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950">{contract.request.title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {contract.counterparty.name} · {contract.request.contractType} · {contract.request.requesterName}
            </p>
            <p className="mt-1 text-sm text-slate-500">Department: {contract.request.notes?.match(/Department:\s*(.*)/)?.[1] ?? 'Unspecified'}</p>
          </div>
          <div className="grid gap-2 text-sm">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
              Source: {contractSource}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone[contract.status]}`}>
              {prettyStatus(contract.status)}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskTone[headerRisk]}`}>
              Risk {contract.riskScore} ({headerRisk})
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Metric label="Value" value={formatMoney(contract.request.estimatedValue)} />
          <Metric label="Owner" value={contract.request.requesterName} />
          <Metric label="Counterparty" value={contract.counterparty.name} />
          <Metric label="Status" value={prettyStatus(contract.status)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton label="Submit for Review" onClick={() => applyStatusAction('submit')} tone="slate" disabled={!canSubmitForReview} />
          <ActionButton label="Approve" onClick={() => applyStatusAction('approve')} tone="green" disabled={!canApprove} />
          <ActionButton label="Request Changes" onClick={() => applyStatusAction('changes')} tone="amber" disabled={!canApprove} />
          <ActionButton label="Mark Executed" onClick={() => applyStatusAction('executed')} tone="brand" disabled={!canExecute} />
          <ActionButton label="Edit Contract" onClick={denyMessage} tone="slate" disabled={!canEdit} />
        </div>

        {message ? (
          <p
            className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${
              message.includes('does not have permission')
                ? 'bg-amber-50 text-amber-900'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                activeTab === tab ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {activeTab === 'Summary' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="AI Summary">
                <ul className="space-y-2 text-sm text-slate-700">
                  {contract.riskSignals.map((signal) => (
                    <li key={signal.name}>- {signal.name}: {signal.reason}</li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Commercial Snapshot">
                <p className="text-sm text-slate-700">Start Date: {formatDate(contract.request.startDate)}</p>
                <p className="mt-2 text-sm text-slate-700">Term: {contract.request.termMonths} months</p>
                <p className="mt-2 text-sm text-slate-700">Currency: {contract.request.currency}</p>
              </Panel>
              <Panel title="Lifecycle Source">
                <p className="text-sm text-slate-700">Source: <span className="font-bold">{contractSource}</span></p>
                <p className="mt-2 text-sm text-slate-700">Source Template: <span className="font-bold">{authoringContext.sourceTemplate}</span></p>
                <p className="mt-2 text-sm text-slate-700">Draft Version: <span className="font-bold">{authoringContext.draftVersion}</span></p>
                <p className="mt-2 text-sm text-slate-700">Authoring Status: <span className="font-bold">{authoringContext.authoringStatus}</span></p>
              </Panel>
              <Panel title="Execution Readiness">
                <p className="text-sm text-slate-700">
                  Final Contract Archive Status:{' '}
                  <span className="font-bold">
                    {executionPackage?.archiveId ? `Archived (${executionPackage.archiveId})` : 'Not archived'}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Executed Date: <span className="font-bold">{formatDate(executionPackage?.executedAt)}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Signature Provider: <span className="font-bold">{executionPackage?.provider ?? 'Internal Approval Only'}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Final Document Version:{' '}
                  <span className="font-bold">{executionPackage?.archiveId ? 'Final v1 (Archived)' : `Draft v${authoringContext.draftVersion}`}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Post-Execution Obligations: <span className="font-bold">{postExecutionObligationsActive ? 'Active' : 'Inactive'}</span>
                </p>
              </Panel>
              <Panel title="Counterparty Intelligence">
                <p className="text-sm text-slate-700">
                  Counterparty Risk:{' '}
                  <span className="font-bold">{prettyStatus((counterpartyIntelligence?.riskRating ?? contract.counterparty.riskRating).toString())}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Total Exposure:{' '}
                  <span className="font-bold">{formatMoney(counterpartyIntelligence?.totalContractValue ?? contract.request.estimatedValue)}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Active Contract Count:{' '}
                  <span className="font-bold">{counterpartyIntelligence?.activeContracts ?? 1}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Compliance Warnings:{' '}
                  <span className="font-bold">
                    {(counterpartyIntelligence?.complianceStatus ?? 'compliant') === 'compliant'
                      ? 'None'
                      : prettyStatus(counterpartyIntelligence?.complianceStatus ?? 'pending_review')}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Relationship Owner:{' '}
                  <span className="font-bold">{counterpartyIntelligence?.relationshipOwner ?? contract.request.requesterName}</span>
                </p>
              </Panel>
              <Panel title="AI Insights">
                {!aiSummary || !aiRisk ? (
                  <p className="text-sm text-slate-500">Your current role does not have access to this contract insight.</p>
                ) : (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><span className="font-semibold">Summary:</span> {aiSummary.summary}</p>
                    <p><span className="font-semibold">Risk Drivers:</span> {aiRisk.riskDrivers.join(' | ') || 'No high-confidence drivers found.'}</p>
                    <p><span className="font-semibold">Missing Clauses:</span> {aiSummary.missingClauses.join(', ') || 'None identified'}</p>
                    <p><span className="font-semibold">Renewal Risk:</span> {prettyStatus(aiSummary.renewalInsight.risk)}</p>
                    <p><span className="font-semibold">Obligation Risk:</span> Overdue {aiSummary.obligationInsight.overdue}, Due This Week {aiSummary.obligationInsight.dueThisWeek}</p>
                    <p><span className="font-semibold">Vendor Risk:</span> {prettyStatus(aiSummary.vendorRiskInsight.risk)} ({prettyStatus(aiSummary.vendorRiskInsight.complianceStatus)})</p>
                    <p><span className="font-semibold">Confidence:</span> {aiSummary.confidence}</p>
                    <p className="text-xs font-semibold text-amber-800">Review required by authorized legal/business users before action.</p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested Approval Note</p>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{aiApprovalNote}</pre>
                    </div>
                    <p><span className="font-semibold">Clause Fallback (Indemnity):</span> {aiFallbackIndemnity.fallbackLanguage}</p>
                    <p><span className="font-semibold">Clause Fallback (Liability):</span> {aiFallbackLiability.fallbackLanguage}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(aiSummary.summary);
                          setMessage('AI summary copied.');
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                      >
                        Copy Summary
                      </button>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(aiApprovalNote);
                          setMessage('Approval note copied.');
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                      >
                        Copy Approval Note
                      </button>
                      <button onClick={() => setActiveTab('Clauses')} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Open Clauses Tab</button>
                      <button onClick={() => setActiveTab('Renewals')} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Open Renewals Tab</button>
                      <button onClick={() => setActiveTab('Obligations')} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Open Obligations Tab</button>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {aiActions.map((action) => (
                        <li key={action.label}>- {action.label}: {action.rationale}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </div>
          ) : null}

          {activeTab === 'Clauses' ? (
            <div className="space-y-3">
              {clauseReviews.map((clause) => (
                <div key={clause.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900">{clause.clause}</p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                            clause.status === 'acceptable'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : clause.status === 'risky'
                              ? 'border-amber-100 bg-amber-50 text-amber-700'
                              : clause.status === 'missing'
                              ? 'border-red-100 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {prettyStatus(clause.status)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                            clause.playbookLabel === 'Standard'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : clause.playbookLabel === 'Needs Review'
                              ? 'border-amber-100 bg-amber-50 text-amber-700'
                              : clause.playbookLabel === 'Non-Standard'
                              ? 'border-violet-100 bg-violet-50 text-violet-700'
                              : 'border-red-100 bg-red-50 text-red-700'
                          }`}
                        >
                          {clause.playbookLabel}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                            clause.legalReviewRequired
                              ? 'border-red-100 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          Legal Review: {clause.legalReviewRequired ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">AI Risk Note:</span> {clause.aiRiskNote}
                      </p>
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">Fallback Language:</span>{' '}
                        {clause.recommendedFallbackLanguage}
                      </p>
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">Business Impact:</span> {clause.businessImpact}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runClauseAction(clause.id, 'accept')}
                        disabled={!canEdit}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => runClauseAction(clause.id, 'flag_legal')}
                        disabled={!canEdit}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Flag for Legal
                      </button>
                      <button
                        onClick={() => runClauseAction(clause.id, 'request_revision')}
                        disabled={!canEdit}
                        className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Request Revision
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Approvals' ? (
            <div className="space-y-3">
              {contract.approvals.map((step) => (
                <div key={step.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-slate-900">{prettyStatus(step.role)}</p>
                      <p className="text-sm text-slate-600">Approver: {step.approver}</p>
                      <p className="text-xs text-slate-500">Decision: {prettyStatus(step.decision)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApprovalDecision(step.id, 'approved')}
                        disabled={!canApprove}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setApprovalDecision(step.id, 'changes_requested')}
                        disabled={!canApprove}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Obligations' ? (
            <div className="space-y-3">
              {contract.obligations.map((obligation) => (
                <div key={obligation.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-slate-900">{obligation.title}</p>
                      <p className="text-sm text-slate-600">Owner: {obligation.owner}</p>
                      <p className="text-xs text-slate-500">Due: {formatDate(obligation.dueDate)} · Status: {prettyStatus(obligation.status)}</p>
                    </div>
                    <button
                      onClick={() => markObligationCompleted(obligation.id)}
                      disabled={obligation.status === 'done' || !canManageObligations}
                      className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {obligation.status === 'done' ? 'Completed' : 'Mark Completed'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Renewals' ? (
            <Panel title="Renewal Intelligence">
              <p className="text-sm text-slate-700">Renewal Date: {formatDate(contract.renewal.renewalDate)}</p>
              <p className="mt-2 text-sm text-slate-700">Notice Deadline: {formatDate(contract.renewal.noticeDeadline)}</p>
              <p className="mt-2 text-sm text-slate-700">Days Until Notice Deadline: {contract.renewal.daysUntilNoticeDeadline}</p>
              <p className="mt-2 text-sm text-slate-700">Auto-Renew: {contract.renewal.autoRenew ? 'Yes' : 'No'}</p>
              <p className="mt-2 text-sm text-slate-700">Renewal Owner: {contract.renewal.renewalOwner}</p>
              <p className="mt-2 text-sm text-slate-700">Renewal Risk: {prettyStatus(contract.renewal.renewalRisk)}</p>
              <p className="mt-2 text-sm text-slate-700">Commercial Impact: {contract.renewal.commercialImpact}</p>
              <p className="mt-2 text-sm text-slate-700">Vendor Performance: {contract.renewal.vendorPerformanceNote}</p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Recommendation: {renewalRecommendation(contract)}</p>
              <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                Control Recommendation: {contract.renewal.recommendedAction}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => runRenewalAction('start_review')} disabled={!canManageRenewals} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Start Renewal Review</button>
                <button onClick={() => runRenewalAction('notice_sent')} disabled={!canManageRenewals} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Mark Notice Sent</button>
                <button onClick={() => runRenewalAction('do_not_renew')} disabled={!canManageRenewals} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Mark Do Not Renew</button>
                <button onClick={() => runRenewalAction('renewed')} disabled={!canManageRenewals} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Mark Renewed</button>
                <button onClick={() => runRenewalAction('escalate')} disabled={!canManageRenewals} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Escalate</button>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Renewal Action History</p>
                {(contract.renewal.actionHistory ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No renewal actions yet.</p>
                ) : (
                  [...(contract.renewal.actionHistory ?? [])]
                    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
                    .map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{prettyStatus(entry.action)}</p>
                        <p className="text-xs text-slate-600">{entry.note}</p>
                        <p className="text-xs text-slate-500">{entry.actor} · {formatDate(entry.timestamp)}</p>
                      </div>
                    ))
                )}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'Execution' ? (
            <div className="space-y-4">
              <Panel title="Execution Control">
                <p className="text-sm text-slate-700">
                  Package Status:{' '}
                  <span className="font-bold">{executionPackage ? prettyStatus(executionPackage.status) : 'No package'}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Signature Provider:{' '}
                  <span className="font-bold">{executionPackage?.provider ?? 'Internal Approval Only'}</span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Signature Progress:{' '}
                  <span className="font-bold">
                    {executionPackage
                      ? `${executionPackage.signers.filter((signer) => signer.status === 'completed').length}/${executionPackage.signers.length}`
                      : '0/0'}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Final Archive Status:{' '}
                  <span className="font-bold">
                    {executionPackage?.archiveId ? `Archived (${executionPackage.archiveId})` : 'Not archived'}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={createExecutionPackage} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white">
                    Create Execution Package
                  </button>
                  <button
                    onClick={sendForSignature}
                    disabled={!executionPackage || !executionReady}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Send for Signature
                  </button>
                  <button
                    onClick={markExecutionComplete}
                    disabled={!executionPackage || !executionReady || !canExecute}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Mark Executed
                  </button>
                  <button
                    onClick={archiveFinalVersion}
                    disabled={!executionPackage || executionPackage.status !== 'executed'}
                    className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Archive Final Version
                  </button>
                </div>
              </Panel>

              {executionReady ? null : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="font-black text-amber-900">Execution Blockers</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    {executionBlockers.map((blocker) => (
                      <li key={blocker}>- {blocker}</li>
                    ))}
                    {!executionReadyByStatus ? <li>- Contract is not approved/ready for execution</li> : null}
                  </ul>
                </div>
              )}

              <Panel title="Signer Timeline">
                {!executionPackage || executionPackage.signers.length === 0 ? (
                  <p className="text-sm text-slate-500">No signers added to this execution package yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Signer Name</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Order</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Completed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...executionPackage.signers]
                          .sort((a, b) => a.order - b.order)
                          .map((signer) => (
                            <tr key={signer.id}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{signer.name}</td>
                              <td className="px-4 py-3">{signer.role}</td>
                              <td className="px-4 py-3">{signer.email}</td>
                              <td className="px-4 py-3">{signer.order}</td>
                              <td className="px-4 py-3">{prettyStatus(signer.status)}</td>
                              <td className="px-4 py-3">{formatDate(signer.completedAt)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Execution Audit Timeline">
                {executionAudit.length === 0 ? (
                  <p className="text-sm text-slate-500">No execution audit events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {executionAudit.map((event) => (
                      <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                        <p className="text-xs text-slate-600">{event.actor} · {new Date(event.timestamp).toLocaleString()}</p>
                        {event.note ? <p className="mt-1 text-xs text-slate-700">{event.note}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          ) : null}

          {activeTab === 'Activity' ? (
            <div className="space-y-3">
              {[...contract.activity]
                .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
                .map((entry: ActivityLog) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="font-black text-slate-900">{entry.action ?? prettyStatus(entry.event)}</p>
                        <p className="text-sm text-slate-700">{entry.message}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="rounded-full bg-slate-100 px-2 py-1">Actor: {entry.actor}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">Source: {entry.source ?? 'User Action'}</span>
                          {entry.previousStatus ? <span className="rounded-full bg-slate-100 px-2 py-1">Previous: {prettyStatus(entry.previousStatus)}</span> : null}
                          {entry.newStatus ? <span className="rounded-full bg-slate-100 px-2 py-1">New: {prettyStatus(entry.newStatus)}</span> : null}
                          {entry.note ? <span className="rounded-full bg-slate-100 px-2 py-1">Note: {entry.note}</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(entry.labels ?? []).map((label) => (
                            <span
                              key={`${entry.id}_${label}`}
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                                label === 'completed'
                                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                  : label === 'review required'
                                  ? 'border-amber-100 bg-amber-50 text-amber-700'
                                  : label === 'system generated'
                                  ? 'border-brand-100 bg-brand-50 text-brand-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : null}

          {activeTab === 'Document Intelligence' && documentIntelligence ? (
            <div className="space-y-4">
              {documentIntelligence.humanReviewNeeded ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="font-black text-red-900">Human Review Needed</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-800">
                    {documentIntelligence.humanReviewReasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-black text-emerald-900">No immediate human review blockers detected</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ExtractionCard label="Document Name" value={documentIntelligence.documentName} confidence={documentIntelligence.confidence.documentName} />
                <ExtractionCard label="Document Type" value={documentIntelligence.documentType} confidence={documentIntelligence.confidence.documentType} />
                <ExtractionCard label="Extracted Parties" value={documentIntelligence.extractedParties.join(' · ')} confidence={documentIntelligence.confidence.extractedParties} />
                <ExtractionCard label="Effective Date" value={formatDate(documentIntelligence.effectiveDate)} confidence={documentIntelligence.confidence.effectiveDate} />
                <ExtractionCard label="Expiration Date" value={formatDate(documentIntelligence.expirationDate)} confidence={documentIntelligence.confidence.expirationDate} />
                <ExtractionCard label="Governing Law" value={documentIntelligence.governingLaw} confidence={documentIntelligence.confidence.governingLaw} />
                <ExtractionCard label="Payment Terms" value={documentIntelligence.paymentTerms} confidence={documentIntelligence.confidence.paymentTerms} />
                <ExtractionCard label="Termination Rights" value={documentIntelligence.terminationRights} confidence={documentIntelligence.confidence.terminationRights} />
                <ExtractionCard label="Auto-Renew Language" value={documentIntelligence.autoRenewLanguage} confidence={documentIntelligence.confidence.autoRenewLanguage} />
                <ExtractionCard label="Assignment Restriction" value={documentIntelligence.assignmentRestriction} confidence={documentIntelligence.confidence.assignmentRestriction} />
                <ExtractionCard label="Insurance Requirement" value={documentIntelligence.insuranceRequirement} confidence={documentIntelligence.confidence.insuranceRequirement} />
                <ExtractionCard label="Audit Rights" value={documentIntelligence.auditRights} confidence={documentIntelligence.confidence.auditRights} />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-black text-slate-900">Critical Clause Status</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <ClausePill label="Confidentiality" status={documentIntelligence.confidentiality} confidence={documentIntelligence.confidence.confidentiality} />
                  <ClausePill label="Indemnity" status={documentIntelligence.indemnity} confidence={documentIntelligence.confidence.indemnity} />
                  <ClausePill label="Limitation of Liability" status={documentIntelligence.limitationOfLiability} confidence={documentIntelligence.confidence.limitationOfLiability} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone,
  disabled = false
}: {
  label: string;
  onClick: () => void;
  tone: 'slate' | 'green' | 'amber' | 'brand';
  disabled?: boolean;
}) {
  const tones = {
    slate: 'bg-slate-900 text-white',
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    brand: 'bg-brand-600 text-white'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${tones[tone]}`}>
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="font-black text-slate-900">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ExtractionCard({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>AI Confidence</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className={`h-2 rounded-full ${confidenceTone(confidence)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ClausePill({ label, status, confidence }: { label: string; status: 'present' | 'missing'; confidence: number }) {
  return (
    <div className={`rounded-lg border p-3 ${status === 'present' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <p className={`text-sm font-black ${status === 'present' ? 'text-emerald-900' : 'text-red-900'}`}>{label}</p>
      <p className={`mt-1 text-xs font-semibold uppercase ${status === 'present' ? 'text-emerald-700' : 'text-red-700'}`}>{status}</p>
      <p className={`mt-1 text-xs ${status === 'present' ? 'text-emerald-800' : 'text-red-800'}`}>Confidence {Math.round(confidence * 100)}%</p>
    </div>
  );
}
