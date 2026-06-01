export type ContractStatus =
  | 'intake'
  | 'drafting'
  | 'internal_review'
  | 'counterparty_review'
  | 'approved'
  | 'executed'
  | 'active'
  | 'renewal_pending'
  | 'expired'
  | 'terminated';

export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type ApprovalRole = 'requestor' | 'legal' | 'security' | 'finance' | 'executive';

export type ObligationStatus = 'open' | 'in_progress' | 'done' | 'blocked' | 'overdue';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ClauseStatus = 'present' | 'missing' | 'non_standard' | 'needs_review';

export type RenewalStatus = 'on_track' | 'notice_due' | 'renewed' | 'non_renewed';
export type RenewalRisk = 'low' | 'medium' | 'high' | 'critical';
export type RenewalActionType =
  | 'start_review'
  | 'notice_sent'
  | 'do_not_renew'
  | 'renewed'
  | 'escalate';

export type ActivityEventType =
  | 'seeded'
  | 'created'
  | 'status_changed'
  | 'approval_updated'
  | 'obligation_updated'
  | 'comment';

export type ContractSource = 'AI Intake' | 'Template Draft' | 'Imported Contract';

export type Counterparty = {
  id: string;
  name: string;
  type: 'vendor' | 'customer' | 'partner' | 'government' | 'subcontractor';
  riskRating: RiskLevel;
  totalContractValue: number;
  activeContracts: number;
  expiredContracts: number;
  pendingContracts: number;
  insuranceStatus: 'current' | 'missing' | 'expired' | 'pending_review';
  complianceStatus: 'compliant' | 'watch' | 'non_compliant' | 'pending_review';
  sanctionsStatus: 'clear' | 'watchlist_hit' | 'pending_screening';
  documentCompleteness: 'complete' | 'partial' | 'missing';
  relationshipOwner: string;
  region: string;
  industry: string;
  riskLevel: RiskLevel;
  isStrategic: boolean;
};

export type ContractRequest = {
  requesterName: string;
  requesterEmail: string;
  title: string;
  contractType: 'MSA' | 'NDA' | 'SOW' | 'Order Form' | 'Vendor Agreement' | 'Customer Agreement';
  counterpartyName: string;
  counterpartyRegion: string;
  estimatedValue: number;
  currency: string;
  startDate: string;
  termMonths: number;
  paymentTerms?: string;
  jurisdiction?: string;
  autoRenew?: boolean;
  department?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  metadata?: Record<string, string>;
  notes?: string;
};

export type ApprovalStep = {
  id: string;
  role: ApprovalRole;
  approver: string;
  decision: ApprovalDecision;
  updatedAt?: string;
  note?: string;
};

export type Obligation = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: ObligationStatus;
  priority: RiskLevel;
  note?: string;
};

export type Renewal = {
  autoRenew: boolean;
  renewalDate: string;
  noticeDeadline: string;
  daysUntilNoticeDeadline: number;
  renewalOwner: string;
  recommendedAction: string;
  renewalRisk: RenewalRisk;
  commercialImpact: string;
  vendorPerformanceNote: string;
  noticeSentAt?: string;
  actionHistory?: Array<{
    id: string;
    action: RenewalActionType;
    note: string;
    actor: string;
    timestamp: string;
  }>;
  status: RenewalStatus;
};

export type RiskSignal = {
  name: string;
  scoreImpact: number;
  level: RiskLevel;
  reason: string;
};

export type ClauseSignal = {
  clause: string;
  status: ClauseStatus;
  severity: RiskLevel;
  message: string;
};

export type ClauseReviewStatus = 'present' | 'missing' | 'risky' | 'acceptable';
export type ClausePlaybookLabel = 'Standard' | 'Needs Review' | 'Non-Standard' | 'Blocker';
export type ClauseReviewAction = 'accept' | 'flag_legal' | 'request_revision';

export type ClauseReviewItem = {
  id: string;
  clause: string;
  status: ClauseReviewStatus;
  playbookLabel: ClausePlaybookLabel;
  aiRiskNote: string;
  recommendedFallbackLanguage: string;
  businessImpact: string;
  legalReviewRequired: boolean;
  lastAction?: ClauseReviewAction;
  lastActionAt?: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  actor: string;
  event: ActivityEventType;
  message: string;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  note?: string;
  source?: 'AI Intake' | 'User Action' | 'Workflow' | 'Renewal' | 'Obligation' | 'AI Copilot';
  labels?: Array<'system generated' | 'user action' | 'review required' | 'completed'>;
};

export type DocumentClausePresence = 'present' | 'missing';

export type DocumentIntelligence = {
  documentName: string;
  documentType: string;
  extractedParties: string[];
  effectiveDate: string;
  expirationDate: string;
  governingLaw: string;
  paymentTerms: string;
  terminationRights: string;
  confidentiality: DocumentClausePresence;
  indemnity: DocumentClausePresence;
  limitationOfLiability: DocumentClausePresence;
  autoRenewLanguage: string;
  assignmentRestriction: string;
  insuranceRequirement: string;
  auditRights: string;
  confidence: {
    documentName: number;
    documentType: number;
    extractedParties: number;
    effectiveDate: number;
    expirationDate: number;
    governingLaw: number;
    paymentTerms: number;
    terminationRights: number;
    confidentiality: number;
    indemnity: number;
    limitationOfLiability: number;
    autoRenewLanguage: number;
    assignmentRestriction: number;
    insuranceRequirement: number;
    auditRights: number;
  };
  humanReviewNeeded: boolean;
  humanReviewReasons: string[];
};

export type Contract = {
  id: string;
  request: ContractRequest;
  counterparty: Counterparty;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  riskScore: number;
  riskSignals: RiskSignal[];
  clauseSignals: ClauseSignal[];
  clauseReviews?: ClauseReviewItem[];
  obligations: Obligation[];
  approvals: ApprovalStep[];
  renewal: Renewal;
  documentIntelligence?: DocumentIntelligence;
  executionPackageId?: string;
  finalArchiveId?: string;
  source?: ContractSource;
  authoring?: {
    sourceTemplate?: string;
    draftVersion?: number;
    authoringStatus?: string;
  };
  activity: ActivityLog[];
};

export type DashboardMetrics = {
  totalContracts: number;
  byStatus: Record<ContractStatus, number>;
  highRiskContracts: number;
  pendingApprovals: number;
  overdueObligations: number;
  renewalsNext90Days: number;
  missingClauseCount: number;
  averageRiskScore: number;
};
