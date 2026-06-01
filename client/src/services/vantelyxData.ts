import {
  type ActivityEventType,
  type ActivityLog,
  type ApprovalDecision,
  type ApprovalStep,
  type ClausePlaybookLabel,
  type ClauseReviewAction,
  type ClauseReviewItem,
  type ClauseSignal,
  type Contract,
  type ContractRequest,
  type ContractStatus,
  type Counterparty,
  type DashboardMetrics,
  type DocumentIntelligence,
  type Obligation,
  type ObligationStatus,
  type Renewal,
  type RenewalActionType,
  type RiskSignal,
} from '../types/clm';

const STORAGE_KEY = 'vantelyx_clm_contracts';

const CONTRACT_STATUSES: ContractStatus[] = [
  'intake',
  'drafting',
  'internal_review',
  'counterparty_review',
  'approved',
  'executed',
  'active',
  'renewal_pending',
  'expired',
  'terminated',
];

const nowIso = (): string => new Date().toISOString();

const randomId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const toDate = (value: string): Date => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const addDaysIso = (dateInput: string | Date, days: number): string => {
  const date = typeof dateInput === 'string' ? toDate(dateInput) : new Date(dateInput);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const addMonthsIso = (dateInput: string | Date, months: number): string => {
  const date = typeof dateInput === 'string' ? toDate(dateInput) : new Date(dateInput);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};

const hasLocalStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readContracts = (): Contract[] => {
  if (!hasLocalStorage()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Contract[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeContracts = (contracts: Contract[]): void => {
  if (!hasLocalStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
};

const createActivity = (
  event: ActivityEventType,
  message: string,
  actor = 'System',
  meta?: Omit<ActivityLog, 'id' | 'timestamp' | 'actor' | 'event' | 'message'>
): ActivityLog => ({
  id: randomId('act'),
  timestamp: nowIso(),
  actor,
  event,
  message,
  ...meta,
});

const escapeCsv = (value: string | number | boolean | undefined): string => {
  const raw = value === undefined ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
};

const toCsv = (headers: string[], rows: Array<Array<string | number | boolean | undefined>>): string => {
  const headerRow = headers.map(escapeCsv).join(',');
  const bodyRows = rows.map((row) => row.map(escapeCsv).join(','));
  return [headerRow, ...bodyRows].join('\n');
};

const inferCounterpartyType = (input: ContractRequest): Counterparty['type'] => {
  if (input.contractType === 'Vendor Agreement') return 'vendor';
  if (input.contractType === 'Customer Agreement') return 'customer';
  if (input.contractType === 'SOW') return 'partner';
  if (input.counterpartyName.toLowerCase().includes('gov') || input.counterpartyName.toLowerCase().includes('state')) {
    return 'government';
  }
  return 'subcontractor';
};

const inferCounterpartyBase = (input: ContractRequest): Pick<
  Counterparty,
  | 'type'
  | 'riskRating'
  | 'insuranceStatus'
  | 'complianceStatus'
  | 'sanctionsStatus'
  | 'documentCompleteness'
  | 'relationshipOwner'
> => {
  const riskRating: Counterparty['riskRating'] =
    input.counterpartyRegion === 'EU' ? 'medium' : input.estimatedValue > 500_000 ? 'high' : 'low';

  return {
    type: inferCounterpartyType(input),
    riskRating,
    insuranceStatus: input.contractType === 'Vendor Agreement' ? 'pending_review' : 'current',
    complianceStatus: input.counterpartyRegion === 'EU' ? 'watch' : 'compliant',
    sanctionsStatus: 'pending_screening',
    documentCompleteness: input.paymentTerms && input.jurisdiction ? 'complete' : 'partial',
    relationshipOwner: input.requesterName,
  };
};

const enrichContractCounterparty = (contract: Contract): Contract['counterparty'] => {
  const existing = contract.counterparty;
  const inferred = inferCounterpartyBase(contract.request);
  return {
    id: existing.id,
    name: existing.name,
    type: existing.type ?? inferred.type,
    riskRating: existing.riskRating ?? existing.riskLevel ?? inferred.riskRating,
    totalContractValue: existing.totalContractValue ?? contract.request.estimatedValue,
    activeContracts: existing.activeContracts ?? 0,
    expiredContracts: existing.expiredContracts ?? 0,
    pendingContracts: existing.pendingContracts ?? 0,
    insuranceStatus: existing.insuranceStatus ?? inferred.insuranceStatus,
    complianceStatus: existing.complianceStatus ?? inferred.complianceStatus,
    sanctionsStatus: existing.sanctionsStatus ?? inferred.sanctionsStatus,
    documentCompleteness: existing.documentCompleteness ?? inferred.documentCompleteness,
    relationshipOwner: existing.relationshipOwner ?? contract.request.requesterName ?? inferred.relationshipOwner,
    region: existing.region,
    industry: existing.industry,
    riskLevel: existing.riskLevel ?? inferred.riskRating,
    isStrategic: existing.isStrategic,
  };
};

const normalizeClauseName = (value: string): string => value.trim().toLowerCase();

const detectRiskSignals = (input: ContractRequest): RiskSignal[] => {
  const signals: RiskSignal[] = [];

  if (input.estimatedValue >= 1_000_000) {
    signals.push({
      name: 'High Contract Value',
      scoreImpact: 20,
      level: 'high',
      reason: 'Contract value exceeds $1M and needs tighter controls.',
    });
  } else if (input.estimatedValue >= 250_000) {
    signals.push({
      name: 'Material Contract Value',
      scoreImpact: 10,
      level: 'medium',
      reason: 'Contract value is materially significant.',
    });
  }

  if (!input.jurisdiction) {
    signals.push({
      name: 'Jurisdiction Missing',
      scoreImpact: 12,
      level: 'high',
      reason: 'No governing law was provided in intake details.',
    });
  }

  if (input.termMonths > 36) {
    signals.push({
      name: 'Long-Term Commitment',
      scoreImpact: 8,
      level: 'medium',
      reason: 'Term extends beyond 36 months.',
    });
  }

  if (input.contractType === 'Vendor Agreement' && !input.paymentTerms) {
    signals.push({
      name: 'Payment Terms Missing',
      scoreImpact: 9,
      level: 'medium',
      reason: 'Vendor contract has no clear payment terms.',
    });
  }

  return signals;
};

const detectClauseSignals = (input: ContractRequest): ClauseSignal[] => {
  const clauses: ClauseSignal[] = [
    {
      clause: 'Confidentiality',
      status: 'present',
      severity: 'low',
      message: 'Standard confidentiality language detected.',
    },
    {
      clause: 'Limitation of Liability',
      status: input.estimatedValue > 500_000 ? 'needs_review' : 'present',
      severity: input.estimatedValue > 500_000 ? 'medium' : 'low',
      message:
        input.estimatedValue > 500_000
          ? 'Liability cap should be reviewed for high-value engagement.'
          : 'Baseline liability cap appears acceptable.',
    },
  ];

  if (!input.jurisdiction) {
    clauses.push({
      clause: 'Governing Law',
      status: 'missing',
      severity: 'high',
      message: 'Missing governing law clause warning.',
    });
  } else {
    clauses.push({
      clause: 'Governing Law',
      status: 'present',
      severity: 'low',
      message: `Jurisdiction specified as ${input.jurisdiction}.`,
    });
  }

  if (!input.paymentTerms) {
    clauses.push({
      clause: 'Payment Terms',
      status: 'missing',
      severity: 'medium',
      message: 'Missing clause warning: payment terms are not defined.',
    });
  } else {
    clauses.push({
      clause: 'Payment Terms',
      status: 'present',
      severity: 'low',
      message: `Payment terms extracted: ${input.paymentTerms}.`,
    });
  }

  clauses.push({
    clause: 'Data Protection',
    status: input.counterpartyRegion === 'EU' ? 'needs_review' : 'present',
    severity: input.counterpartyRegion === 'EU' ? 'medium' : 'low',
    message:
      input.counterpartyRegion === 'EU'
        ? 'GDPR obligations likely apply and should be validated.'
        : 'No elevated data transfer concern detected.',
  });

  return clauses;
};

const createClauseReviewItems = (input: ContractRequest, signals: ClauseSignal[]): ClauseReviewItem[] => {
  const clauseStatusMap = new Map(signals.map((signal) => [normalizeClauseName(signal.clause), signal]));
  const hasSignal = (name: string): ClauseSignal | undefined =>
    clauseStatusMap.get(normalizeClauseName(name));

  const classify = (clauseName: string): { status: ClauseReviewItem['status']; label: ClausePlaybookLabel } => {
    const matched = hasSignal(clauseName);
    if (!matched) {
      return { status: 'missing', label: 'Blocker' };
    }
    if (matched.status === 'missing') {
      return { status: 'missing', label: 'Blocker' };
    }
    if (matched.status === 'non_standard') {
      return { status: 'risky', label: 'Non-Standard' };
    }
    if (matched.status === 'needs_review') {
      return { status: 'risky', label: 'Needs Review' };
    }
    return { status: 'acceptable', label: 'Standard' };
  };

  const makeClause = (
    clause: string,
    fallback: string,
    impact: string,
    defaultRisk: string
  ): ClauseReviewItem => {
    const classification = classify(clause);
    const matched = hasSignal(clause);
    return {
      id: randomId('clv'),
      clause,
      status: classification.status,
      playbookLabel: classification.label,
      aiRiskNote: matched?.message ?? defaultRisk,
      recommendedFallbackLanguage: fallback,
      businessImpact: impact,
      legalReviewRequired: classification.status === 'missing' || classification.status === 'risky',
    };
  };

  return [
    makeClause(
      'Confidentiality',
      'Each party will protect Confidential Information using reasonable safeguards and use it only for contractual purposes.',
      'Weak confidentiality can expose sensitive product, pricing, and customer information.',
      'Confidentiality terms were not clearly extracted from the source document.'
    ),
    makeClause(
      'Indemnification',
      'Counterparty indemnifies Vantelyx against third-party IP, privacy, and regulatory claims arising from performance.',
      'Indemnity gaps can shift litigation and regulatory costs to Vantelyx.',
      'Indemnification language appears incomplete or absent.'
    ),
    makeClause(
      'Limitation of Liability',
      'Liability is capped at 12 months of fees and excludes gross negligence, fraud, and confidentiality breaches.',
      'Uncapped or asymmetric liability can create disproportionate financial exposure.',
      'Liability cap requires legal normalization to playbook position.'
    ),
    makeClause(
      'Termination',
      'Either party may terminate for material breach after a 30-day cure period.',
      'Unclear termination rights can delay exit from non-performing relationships.',
      'Termination terms are ambiguous or not explicitly captured.'
    ),
    makeClause(
      'Renewal',
      'Renewal requires written mutual consent at least 90 days before expiration.',
      'Uncontrolled renewal can lock budget and resources beyond strategic horizon.',
      'Renewal controls are not explicit and may auto-extend commitments.'
    ),
    makeClause(
      'Payment Terms',
      'Invoices due Net 30 with disputed amounts carved out and right to withhold for non-performance.',
      'Unclear payment terms can increase collections risk and margin leakage.',
      'Payment obligations need tightening to avoid unfavorable cash terms.'
    ),
    makeClause(
      'Data Protection',
      'Parties will comply with applicable privacy laws and execute a DPA where personal data is processed.',
      'Insufficient data protection language can trigger privacy and compliance violations.',
      'Data protection obligations require privacy review before execution.'
    ),
    makeClause(
      'Governing Law',
      'Agreement governed by Delaware law with venue in mutually agreed courts.',
      'Missing governing law increases dispute complexity and enforcement uncertainty.',
      'Governing law clause is incomplete or missing.'
    ),
    makeClause(
      'Insurance',
      'Counterparty maintains general liability and cyber insurance with certificates on request.',
      'Insurance gaps reduce recoverability in incidents and service failures.',
      'Insurance coverage obligations not clearly identified.'
    ),
    makeClause(
      'Assignment',
      'No assignment without prior written consent except to an affiliate or successor by merger.',
      'Unrestricted assignment may transfer obligations to unsuitable third parties.',
      'Assignment restriction requires additional drafting safeguards.'
    ),
    makeClause(
      'Audit Rights',
      'Vantelyx may audit controls annually with reasonable notice and confidentiality protections.',
      'No audit rights limit oversight of security, billing, and compliance controls.',
      'Audit rights were not sufficiently captured in extracted terms.'
    ),
  ].map((item) => {
    if (item.clause === 'Renewal' && input.autoRenew) {
      return {
        ...item,
        aiRiskNote: 'Auto-renew language detected. Confirm notice and cancellation mechanics.',
        playbookLabel: item.status === 'acceptable' ? 'Needs Review' : item.playbookLabel,
        status: item.status === 'acceptable' ? 'risky' : item.status,
        legalReviewRequired: true,
      };
    }
    return item;
  });
};

const createObligations = (input: ContractRequest): Obligation[] => {
  const obligations: Obligation[] = [
    {
      id: randomId('obl'),
      title: 'Complete stakeholder kickoff',
      owner: 'Legal Ops',
      dueDate: addDaysIso(input.startDate, 7),
      status: 'open',
      priority: 'medium',
    },
    {
      id: randomId('obl'),
      title: 'Confirm insurance certificates',
      owner: 'Procurement',
      dueDate: addDaysIso(input.startDate, 14),
      status: 'open',
      priority: 'high',
    },
    {
      id: randomId('obl'),
      title: 'Validate billing schedule',
      owner: 'Finance',
      dueDate: addDaysIso(input.startDate, 21),
      status: 'open',
      priority: 'medium',
    },
  ];

  if (input.contractType !== 'NDA') {
    obligations.push({
      id: randomId('obl'),
      title: 'Deliver first performance report',
      owner: 'Business Owner',
      dueDate: addDaysIso(input.startDate, 45),
      status: 'open',
      priority: 'medium',
    });
  }

  if (input.counterpartyRegion === 'EU' || input.estimatedValue > 500_000) {
    obligations.push({
      id: randomId('obl'),
      title: 'Run compliance audit checkpoint',
      owner: 'Compliance',
      dueDate: addDaysIso(input.startDate, 60),
      status: 'open',
      priority: 'high',
    });
  }

  return obligations.slice(0, 5);
};

const createApprovalSteps = (input: ContractRequest): ApprovalStep[] => {
  const steps: ApprovalStep[] = [
    {
      id: randomId('appr'),
      role: 'requestor',
      approver: input.requesterName,
      decision: 'approved',
      updatedAt: nowIso(),
      note: 'Intake submitted and confirmed.',
    },
    {
      id: randomId('appr'),
      role: 'legal',
      approver: 'Legal Reviewer',
      decision: 'pending',
    },
  ];

  if (input.estimatedValue > 100_000) {
    steps.push({
      id: randomId('appr'),
      role: 'finance',
      approver: 'Finance Controller',
      decision: 'pending',
    });
  }

  if (input.counterpartyRegion !== 'US') {
    steps.push({
      id: randomId('appr'),
      role: 'security',
      approver: 'Security Officer',
      decision: 'pending',
    });
  }

  if (input.estimatedValue > 750_000) {
    steps.push({
      id: randomId('appr'),
      role: 'executive',
      approver: 'Executive Approver',
      decision: 'pending',
    });
  }

  return steps;
};

const createRenewal = (input: ContractRequest): Renewal => {
  const renewalDate = addMonthsIso(input.startDate, input.termMonths);
  const noticeDeadline = addDaysIso(renewalDate, -90);
  const daysUntilNoticeDeadline = Math.ceil((toDate(noticeDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const renewalRisk: Renewal['renewalRisk'] =
    input.estimatedValue > 750_000 || daysUntilNoticeDeadline < 30 ? 'high' : input.counterpartyRegion === 'EU' ? 'medium' : 'low';
  return {
    autoRenew: Boolean(input.autoRenew),
    renewalDate,
    noticeDeadline,
    daysUntilNoticeDeadline,
    renewalOwner: input.requesterName,
    recommendedAction:
      daysUntilNoticeDeadline <= 30
        ? 'Start renewal review immediately and confirm commercial position.'
        : input.autoRenew
        ? 'Validate notice intent before auto-renew trigger.'
        : 'Plan commercial renegotiation before notice window.',
    renewalRisk,
    commercialImpact:
      input.estimatedValue > 500_000
        ? 'High commercial exposure due to contract value and continuity dependency.'
        : 'Moderate commercial exposure with manageable continuity impact.',
    vendorPerformanceNote:
      input.contractType === 'Vendor Agreement'
        ? 'Performance tracking required before renewal decision.'
        : 'Monitor business outcomes against agreement scope.',
    actionHistory: [],
    status: 'on_track',
  };
};

const calculateRiskScore = (signals: RiskSignal[], clauses: ClauseSignal[]): number => {
  const signalPoints = signals.reduce((sum, signal) => sum + signal.scoreImpact, 0);
  const clausePoints = clauses.reduce((sum, clause) => {
    if (clause.status === 'missing') {
      return sum + 12;
    }
    if (clause.status === 'non_standard' || clause.status === 'needs_review') {
      return sum + 6;
    }
    return sum;
  }, 0);

  const score = 20 + signalPoints + clausePoints;
  return Math.max(1, Math.min(100, score));
};

const createDocumentIntelligence = (
  input: ContractRequest,
  clauses: ClauseSignal[],
  riskScore: number,
  renewal: Renewal
): DocumentIntelligence => {
  const hasClause = (name: string): boolean =>
    clauses.some((clause) => clause.clause.toLowerCase().includes(name.toLowerCase()) && clause.status !== 'missing');

  const confidentiality: 'present' | 'missing' = hasClause('Confidentiality') ? 'present' : 'missing';
  const limitation: 'present' | 'missing' = hasClause('Limitation of Liability') ? 'present' : 'missing';
  const indemnity: 'present' | 'missing' = input.estimatedValue >= 100_000 ? 'present' : 'missing';

  const documentType = input.contractType;
  const effectiveDate = input.startDate;
  const expirationDate = addMonthsIso(input.startDate, input.termMonths);
  const governingLaw = input.jurisdiction ?? 'Not explicitly identified';
  const paymentTerms = input.paymentTerms ?? 'Not found';
  const autoRenewLanguage = input.autoRenew
    ? 'Auto-renewal language detected with automatic extension provision.'
    : 'No explicit auto-renew language detected.';

  const confidence = {
    documentName: 0.96,
    documentType: 0.93,
    extractedParties: 0.91,
    effectiveDate: 0.89,
    expirationDate: 0.84,
    governingLaw: input.jurisdiction ? 0.88 : 0.54,
    paymentTerms: input.paymentTerms ? 0.9 : 0.52,
    terminationRights: 0.74,
    confidentiality: confidentiality === 'present' ? 0.92 : 0.58,
    indemnity: indemnity === 'present' ? 0.78 : 0.55,
    limitationOfLiability: limitation === 'present' ? 0.85 : 0.56,
    autoRenewLanguage: input.autoRenew ? 0.87 : 0.66,
    assignmentRestriction: 0.71,
    insuranceRequirement: input.contractType === 'Vendor Agreement' ? 0.83 : 0.62,
    auditRights: 0.68,
  };

  const lowConfidenceFields = Object.entries(confidence)
    .filter(([, value]) => value < 0.7)
    .map(([field]) => field);

  const criticalMissing = [
    confidentiality === 'missing' ? 'Confidentiality clause missing' : '',
    limitation === 'missing' ? 'Limitation of liability clause missing' : '',
    indemnity === 'missing' ? 'Indemnity clause missing' : '',
  ].filter(Boolean);

  const reviewReasons: string[] = [];
  if (riskScore >= 70) {
    reviewReasons.push('High contract risk score');
  }
  if (lowConfidenceFields.length > 0) {
    reviewReasons.push(`Low AI confidence in: ${lowConfidenceFields.join(', ')}`);
  }
  if (criticalMissing.length > 0) {
    reviewReasons.push(...criticalMissing);
  }
  if (input.autoRenew && !renewal.noticeDeadline) {
    reviewReasons.push('Auto-renew language detected without notice deadline');
  }

  return {
    documentName: `${input.title}.pdf`,
    documentType,
    extractedParties: ['Vantelyx, Inc.', input.counterpartyName],
    effectiveDate,
    expirationDate,
    governingLaw,
    paymentTerms,
    terminationRights:
      input.contractType === 'NDA'
        ? 'Either party may terminate with 30 days written notice.'
        : 'Termination rights include material breach cure period and convenience provisions.',
    confidentiality,
    indemnity,
    limitationOfLiability: limitation,
    autoRenewLanguage,
    assignmentRestriction: 'Assignment restricted without prior written consent except for affiliates.',
    insuranceRequirement:
      input.contractType === 'Vendor Agreement'
        ? 'General liability and cyber insurance required.'
        : 'Insurance obligations not explicitly identified.',
    auditRights:
      input.contractType === 'Vendor Agreement'
        ? 'Customer audit rights included for security and compliance.'
        : 'No explicit audit rights detected.',
    confidence,
    humanReviewNeeded: reviewReasons.length > 0,
    humanReviewReasons: reviewReasons,
  };
};

export const seedDemoData = (): Contract[] => {
  const existing = readContracts();
  if (existing.length > 0) {
    return existing;
  }

  const demoInputs: ContractRequest[] = [
    {
      requesterName: 'Avery Morgan',
      requesterEmail: 'avery.morgan@vantelyx.com',
      title: 'Cloud Hosting Renewal FY27',
      contractType: 'Vendor Agreement',
      counterpartyName: 'Northstar Cloud LLC',
      counterpartyRegion: 'US',
      estimatedValue: 650000,
      currency: 'USD',
      startDate: addDaysIso(nowIso(), -20),
      termMonths: 24,
      paymentTerms: 'Net 30',
      jurisdiction: 'Delaware',
      autoRenew: true,
      notes: 'Critical service provider for production workloads.',
    },
    {
      requesterName: 'Riley Chen',
      requesterEmail: 'riley.chen@vantelyx.com',
      title: 'EMEA Data Processing Addendum',
      contractType: 'SOW',
      counterpartyName: 'Bluebridge Analytics GmbH',
      counterpartyRegion: 'EU',
      estimatedValue: 220000,
      currency: 'EUR',
      startDate: addDaysIso(nowIso(), -5),
      termMonths: 12,
      paymentTerms: 'Net 45',
      autoRenew: false,
      notes: 'Supports expansion into EU enterprise segment.',
    },
    {
      requesterName: 'Jordan Patel',
      requesterEmail: 'jordan.patel@vantelyx.com',
      title: 'Mutual NDA for Strategic Partnership',
      contractType: 'NDA',
      counterpartyName: 'Orion Integrations Inc',
      counterpartyRegion: 'US',
      estimatedValue: 50000,
      currency: 'USD',
      startDate: nowIso(),
      termMonths: 18,
      jurisdiction: 'California',
      autoRenew: false,
      notes: 'Pre-sales diligence and roadmap collaboration.',
    },
  ];

  const seeded = demoInputs.map((input) => createContractFromIntake(input));

  writeContracts(seeded);
  return seeded;
};

export const getContracts = (): Contract[] => {
  const contracts = readContracts().map((contract) => ({
    ...contract,
    counterparty: enrichContractCounterparty(contract),
  }));
  return [...contracts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

export const getContractById = (id: string): Contract | undefined => {
  const contract = readContracts().find((item) => item.id === id);
  return contract ? { ...contract, counterparty: enrichContractCounterparty(contract) } : undefined;
};

export const createContractFromIntake = (input: ContractRequest): Contract => {
  const contracts = readContracts();
  const riskSignals = detectRiskSignals(input);
  const clauseSignals = detectClauseSignals(input);
  const clauseReviews = createClauseReviewItems(input, clauseSignals);
  const obligations = createObligations(input);
  const approvals = createApprovalSteps(input);
  const renewal = createRenewal(input);
  const createdAt = nowIso();
  const riskScore = calculateRiskScore(riskSignals, clauseSignals);
  const documentIntelligence = createDocumentIntelligence(input, clauseSignals, riskScore, renewal);
  const counterpartyBase = inferCounterpartyBase(input);

  const counterparty: Counterparty = {
    id: randomId('cp'),
    name: input.counterpartyName,
    type: counterpartyBase.type,
    riskRating: counterpartyBase.riskRating,
    totalContractValue: input.estimatedValue,
    activeContracts: 1,
    expiredContracts: 0,
    pendingContracts: 1,
    insuranceStatus: counterpartyBase.insuranceStatus,
    complianceStatus: counterpartyBase.complianceStatus,
    sanctionsStatus: counterpartyBase.sanctionsStatus,
    documentCompleteness: counterpartyBase.documentCompleteness,
    relationshipOwner: counterpartyBase.relationshipOwner,
    region: input.counterpartyRegion,
    industry: 'General',
    riskLevel: counterpartyBase.riskRating,
    isStrategic: input.estimatedValue > 300_000,
  };

  const contract: Contract = {
    id: randomId('ct'),
    request: input,
    counterparty,
    status: 'drafting',
    createdAt,
    updatedAt: createdAt,
    riskScore,
    riskSignals,
    clauseSignals,
    clauseReviews,
    obligations,
    approvals,
    renewal,
    documentIntelligence,
    activity: [
      createActivity('created', 'Contract created from intake with simulated AI extraction.', 'AI Intake Engine', {
        action: 'Intake Created',
        previousStatus: 'intake',
        newStatus: 'drafting',
        note: 'Initial extraction and workflow setup completed.',
        source: 'AI Intake',
        labels: riskScore >= 70 ? ['system generated', 'review required'] : ['system generated'],
      }),
    ],
  };

  contracts.push(contract);
  writeContracts(contracts);
  return contract;
};

export const updateClauseReviewAction = (
  contractId: string,
  clauseReviewId: string,
  action: ClauseReviewAction
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === contractId);
  if (index === -1) {
    return undefined;
  }

  const contract = contracts[index];
  const currentReviews = contract.clauseReviews ?? [];
  const reviewIndex = currentReviews.findIndex((review) => review.id === clauseReviewId);
  if (reviewIndex === -1) {
    return undefined;
  }

  const updatedReviews = [...currentReviews];
  const currentReview = updatedReviews[reviewIndex];
  let nextLabel = currentReview.playbookLabel;
  let nextLegalRequired = currentReview.legalReviewRequired;

  if (action === 'accept') {
    nextLabel = 'Standard';
    nextLegalRequired = false;
  } else if (action === 'flag_legal') {
    nextLabel = 'Needs Review';
    nextLegalRequired = true;
  } else if (action === 'request_revision') {
    nextLabel = 'Non-Standard';
    nextLegalRequired = true;
  }

  updatedReviews[reviewIndex] = {
    ...currentReview,
    playbookLabel: nextLabel,
    legalReviewRequired: nextLegalRequired,
    lastAction: action,
    lastActionAt: nowIso(),
  };

  const updated: Contract = {
    ...contract,
    clauseReviews: updatedReviews,
    updatedAt: nowIso(),
    activity: [
      ...contract.activity,
      createActivity(
        'comment',
        `Clause review action applied: ${currentReview.clause} -> ${action}.`
      ),
    ],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const updateRenewalAction = (
  contractId: string,
  action: RenewalActionType,
  note?: string
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === contractId);
  if (index === -1) {
    return undefined;
  }

  const contract = contracts[index];
  const renewal = contract.renewal;
  const actionEntry = {
    id: randomId('ren'),
    action,
    note:
      note ??
      (action === 'start_review'
        ? 'Renewal review initiated.'
        : action === 'notice_sent'
        ? 'Notice sent to counterparty.'
        : action === 'do_not_renew'
        ? 'Decision recorded: do not renew.'
        : action === 'renewed'
        ? 'Renewal completed.'
        : 'Renewal escalation raised.'),
    actor: 'Workspace User',
    timestamp: nowIso(),
  };

  const nextRenewal: Renewal = {
    ...renewal,
    actionHistory: [...(renewal.actionHistory ?? []), actionEntry],
    noticeSentAt: action === 'notice_sent' ? nowIso() : renewal.noticeSentAt,
    status:
      action === 'renewed'
        ? 'renewed'
        : action === 'do_not_renew'
        ? 'non_renewed'
        : renewal.daysUntilNoticeDeadline <= 0
        ? 'notice_due'
        : renewal.status,
    recommendedAction:
      action === 'start_review'
        ? 'Renewal review in progress. Complete legal/commercial assessment.'
        : action === 'notice_sent'
        ? 'Await counterparty response and negotiation outcomes.'
        : action === 'do_not_renew'
        ? 'Coordinate termination and transition plan.'
        : action === 'renewed'
        ? 'Track post-renewal obligations and performance.'
        : 'Escalated to leadership for urgent decision.',
  };

  const updated: Contract = {
    ...contract,
    renewal: nextRenewal,
    updatedAt: nowIso(),
    activity: [
      ...contract.activity,
      createActivity('comment', `Renewal action applied: ${action}. ${actionEntry.note}`, actionEntry.actor, {
        action: `Renewal ${action}`,
        previousStatus: renewal.status,
        newStatus: nextRenewal.status,
        note: actionEntry.note,
        source: 'Renewal',
        labels:
          action === 'renewed'
            ? ['completed', 'user action']
            : action === 'escalate'
            ? ['review required', 'user action']
            : ['user action'],
      }),
    ],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const getRenewalQueue = (): Contract[] => {
  return getContracts().map((contract) => {
    const daysUntilNoticeDeadline = Math.ceil((toDate(contract.renewal.noticeDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...contract,
      renewal: {
        ...contract.renewal,
        daysUntilNoticeDeadline,
      },
    };
  });
};

export const updateContractStatus = (
  id: string,
  status: ContractStatus,
  note?: string
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === id);
  if (index === -1) {
    return undefined;
  }

  const current = contracts[index];
  const updated: Contract = {
    ...current,
    status,
    updatedAt: nowIso(),
    activity: [
      ...current.activity,
      createActivity('status_changed', `Status changed to ${status}.${note ? ` ${note}` : ''}`, 'Workflow Engine', {
        action: 'Status Update',
        previousStatus: current.status,
        newStatus: status,
        note,
        source: 'Workflow',
        labels: ['system generated'],
      }),
    ],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const updateApprovalStep = (
  contractId: string,
  stepId: string,
  decision: ApprovalDecision,
  note?: string
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === contractId);
  if (index === -1) {
    return undefined;
  }

  const contract = contracts[index];
  const approvalIndex = contract.approvals.findIndex((step) => step.id === stepId);
  if (approvalIndex === -1) {
    return undefined;
  }

  const approvals = [...contract.approvals];
  approvals[approvalIndex] = {
    ...approvals[approvalIndex],
    decision,
    note,
    updatedAt: nowIso(),
  };

  const anyRejected = approvals.some((step) => step.decision === 'rejected');
  const allApproved = approvals.every((step) => step.decision === 'approved');

  const nextStatus: ContractStatus = anyRejected
    ? 'drafting'
    : allApproved
    ? 'approved'
    : 'internal_review';

  const updated: Contract = {
    ...contract,
    approvals,
    status: nextStatus,
    updatedAt: nowIso(),
    activity: [
      ...contract.activity,
      createActivity(
        'approval_updated',
        `Approval step ${stepId} updated to ${decision}.${note ? ` ${note}` : ''}`,
        'Workflow Engine',
        {
          action: 'Approval Decision',
          previousStatus: contract.status,
          newStatus: nextStatus,
          note,
          source: 'Workflow',
          labels: decision === 'approved' ? ['completed'] : ['review required'],
        }
      ),
    ],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const updateObligationStatus = (
  contractId: string,
  obligationId: string,
  status: ObligationStatus
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === contractId);
  if (index === -1) {
    return undefined;
  }

  const contract = contracts[index];
  const obligationIndex = contract.obligations.findIndex((obligation) => obligation.id === obligationId);
  if (obligationIndex === -1) {
    return undefined;
  }

  const obligations = [...contract.obligations];
  obligations[obligationIndex] = {
    ...obligations[obligationIndex],
    status,
  };

  const updated: Contract = {
    ...contract,
    obligations,
    updatedAt: nowIso(),
    activity: [
      ...contract.activity,
      createActivity('obligation_updated', `Obligation ${obligationId} marked as ${status}.`, 'Workflow Engine', {
        action: 'Obligation Update',
        previousStatus: contract.obligations[obligationIndex].status,
        newStatus: status,
        source: 'Obligation',
        labels: status === 'done' ? ['completed'] : ['review required'],
      }),
    ],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const addActivityLog = (
  contractId: string,
  event: Omit<ActivityLog, 'id' | 'timestamp'>
): Contract | undefined => {
  const contracts = readContracts();
  const index = contracts.findIndex((contract) => contract.id === contractId);
  if (index === -1) {
    return undefined;
  }

  const contract = contracts[index];
  const entry: ActivityLog = {
    id: randomId('act'),
    timestamp: nowIso(),
    actor: event.actor,
    event: event.event,
    message: event.message,
    action: event.action,
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    note: event.note,
    source: event.source ?? 'User Action',
    labels: event.labels ?? ['user action'],
  };

  const updated: Contract = {
    ...contract,
    updatedAt: nowIso(),
    activity: [...contract.activity, entry],
  };

  contracts[index] = updated;
  writeContracts(contracts);
  return updated;
};

export const getCounterpartyIntelligence = (): Counterparty[] => {
  const contracts = getContracts();
  const map = new Map<string, Counterparty>();

  contracts.forEach((contract) => {
    const key = contract.counterparty.name.toLowerCase();
    const existing = map.get(key);
    const isActive = contract.status === 'active' || contract.status === 'executed' || contract.status === 'approved';
    const isExpired = contract.status === 'expired' || contract.status === 'terminated';
    const isPending = contract.status === 'drafting' || contract.status === 'internal_review' || contract.status === 'counterparty_review' || contract.status === 'intake';
    const missingDocs = contract.clauseSignals.some((clause) => clause.status === 'missing');
    const highRisk = contract.riskScore >= 70;

    if (!existing) {
      map.set(key, {
        ...contract.counterparty,
        totalContractValue: contract.request.estimatedValue,
        activeContracts: isActive ? 1 : 0,
        expiredContracts: isExpired ? 1 : 0,
        pendingContracts: isPending ? 1 : 0,
        riskRating: highRisk ? 'high' : contract.counterparty.riskRating,
        riskLevel: highRisk ? 'high' : contract.counterparty.riskLevel,
        documentCompleteness: missingDocs ? 'partial' : contract.counterparty.documentCompleteness,
      });
      return;
    }

    const nextRisk: Counterparty['riskRating'] =
      existing.riskRating === 'critical' || contract.riskScore >= 85
        ? 'critical'
        : existing.riskRating === 'high' || highRisk
        ? 'high'
        : existing.riskRating === 'medium' || contract.riskScore >= 45
        ? 'medium'
        : 'low';

    map.set(key, {
      ...existing,
      totalContractValue: existing.totalContractValue + contract.request.estimatedValue,
      activeContracts: existing.activeContracts + (isActive ? 1 : 0),
      expiredContracts: existing.expiredContracts + (isExpired ? 1 : 0),
      pendingContracts: existing.pendingContracts + (isPending ? 1 : 0),
      insuranceStatus:
        existing.insuranceStatus === 'missing' || contract.counterparty.insuranceStatus === 'missing'
          ? 'missing'
          : existing.insuranceStatus === 'expired' || contract.counterparty.insuranceStatus === 'expired'
          ? 'expired'
          : existing.insuranceStatus === 'pending_review' || contract.counterparty.insuranceStatus === 'pending_review'
          ? 'pending_review'
          : 'current',
      complianceStatus:
        existing.complianceStatus === 'non_compliant' || contract.counterparty.complianceStatus === 'non_compliant'
          ? 'non_compliant'
          : existing.complianceStatus === 'watch' || contract.counterparty.complianceStatus === 'watch'
          ? 'watch'
          : existing.complianceStatus === 'pending_review' || contract.counterparty.complianceStatus === 'pending_review'
          ? 'pending_review'
          : 'compliant',
      sanctionsStatus:
        existing.sanctionsStatus === 'watchlist_hit' || contract.counterparty.sanctionsStatus === 'watchlist_hit'
          ? 'watchlist_hit'
          : existing.sanctionsStatus === 'pending_screening' || contract.counterparty.sanctionsStatus === 'pending_screening'
          ? 'pending_screening'
          : 'clear',
      documentCompleteness:
        existing.documentCompleteness === 'missing' || contract.counterparty.documentCompleteness === 'missing'
          ? 'missing'
          : missingDocs || existing.documentCompleteness === 'partial' || contract.counterparty.documentCompleteness === 'partial'
          ? 'partial'
          : 'complete',
      relationshipOwner: existing.relationshipOwner || contract.request.requesterName,
      riskRating: nextRisk,
      riskLevel: nextRisk,
    });
  });

  return [...map.values()].sort((a, b) => b.totalContractValue - a.totalContractValue);
};

export const getCounterpartyByName = (name: string): Counterparty | undefined => {
  return getCounterpartyIntelligence().find((counterparty) => counterparty.name.toLowerCase() === name.toLowerCase());
};

export const exportContractsCsv = (): string => {
  const contracts = getContracts();
  const headers = [
    'Contract ID',
    'Title',
    'Counterparty',
    'Type',
    'Status',
    'Risk Score',
    'Value',
    'Start Date',
    'Renewal Date',
    'Owner',
  ];
  const rows = contracts.map((contract) => [
    contract.id,
    contract.request.title,
    contract.counterparty.name,
    contract.request.contractType,
    contract.status,
    contract.riskScore,
    contract.request.estimatedValue,
    contract.request.startDate,
    contract.renewal.renewalDate,
    contract.request.requesterName,
  ]);
  return toCsv(headers, rows);
};

export const exportObligationsCsv = (): string => {
  const contracts = getContracts();
  const headers = ['Contract ID', 'Contract Title', 'Obligation ID', 'Title', 'Owner', 'Due Date', 'Status', 'Priority'];
  const rows: Array<Array<string | number>> = [];
  contracts.forEach((contract) => {
    contract.obligations.forEach((obligation) => {
      rows.push([
        contract.id,
        contract.request.title,
        obligation.id,
        obligation.title,
        obligation.owner,
        obligation.dueDate,
        obligation.status,
        obligation.priority,
      ]);
    });
  });
  return toCsv(headers, rows);
};

export const exportRenewalsCsv = (): string => {
  const contracts = getRenewalQueue();
  const headers = [
    'Contract ID',
    'Contract Title',
    'Renewal Date',
    'Notice Deadline',
    'Days Until Notice Deadline',
    'Auto Renew',
    'Renewal Owner',
    'Renewal Risk',
    'Recommended Action',
    'Commercial Impact',
    'Vendor Performance Note',
    'Renewal Status',
  ];
  const rows = contracts.map((contract) => [
    contract.id,
    contract.request.title,
    contract.renewal.renewalDate,
    contract.renewal.noticeDeadline,
    contract.renewal.daysUntilNoticeDeadline,
    contract.renewal.autoRenew,
    contract.renewal.renewalOwner,
    contract.renewal.renewalRisk,
    contract.renewal.recommendedAction,
    contract.renewal.commercialImpact,
    contract.renewal.vendorPerformanceNote,
    contract.renewal.status,
  ]);
  return toCsv(headers, rows);
};

export const exportAuditLogCsv = (): string => {
  const contracts = getContracts();
  const headers = [
    'Contract ID',
    'Contract Title',
    'Timestamp',
    'Actor',
    'Action',
    'Previous Status',
    'New Status',
    'Note',
    'Source',
    'Labels',
    'Message',
  ];
  const rows: Array<Array<string | number | boolean | undefined>> = [];
  contracts.forEach((contract) => {
    contract.activity.forEach((entry) => {
      rows.push([
        contract.id,
        contract.request.title,
        entry.timestamp,
        entry.actor,
        entry.action ?? entry.event,
        entry.previousStatus,
        entry.newStatus,
        entry.note,
        entry.source,
        entry.labels?.join('|'),
        entry.message,
      ]);
    });
  });
  return toCsv(headers, rows);
};

export const getDashboardMetrics = (): DashboardMetrics => {
  const contracts = readContracts();
  const byStatus = CONTRACT_STATUSES.reduce<Record<ContractStatus, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<ContractStatus, number>);

  let highRiskContracts = 0;
  let pendingApprovals = 0;
  let overdueObligations = 0;
  let renewalsNext90Days = 0;
  let missingClauseCount = 0;

  const now = new Date();
  const ninetyDays = addDaysIso(now, 90);

  contracts.forEach((contract) => {
    byStatus[contract.status] += 1;

    if (contract.riskScore >= 70) {
      highRiskContracts += 1;
    }

    if (contract.approvals.some((step) => step.decision === 'pending' || step.decision === 'changes_requested')) {
      pendingApprovals += 1;
    }

    missingClauseCount += contract.clauseSignals.filter((clause) => clause.status === 'missing').length;

    overdueObligations += contract.obligations.filter((obligation) => {
      if (obligation.status === 'overdue') {
        return true;
      }
      return obligation.status !== 'done' && toDate(obligation.dueDate) < now;
    }).length;

    const renewalDate = contract.renewal.renewalDate;
    if (renewalDate >= now.toISOString() && renewalDate <= ninetyDays) {
      renewalsNext90Days += 1;
    }
  });

  const averageRiskScore =
    contracts.length > 0
      ? Number((contracts.reduce((sum, contract) => sum + contract.riskScore, 0) / contracts.length).toFixed(1))
      : 0;

  return {
    totalContracts: contracts.length,
    byStatus,
    highRiskContracts,
    pendingApprovals,
    overdueObligations,
    renewalsNext90Days,
    missingClauseCount,
    averageRiskScore,
  };
};
