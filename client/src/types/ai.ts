import type { TaskPriority } from './workflowOps';

export type CopilotIntentType =
  | 'FIND_HIGH_RISK_CONTRACTS'
  | 'FIND_UPCOMING_RENEWALS'
  | 'FIND_PENDING_APPROVALS'
  | 'FIND_OVERDUE_OBLIGATIONS'
  | 'EXPLAIN_CONTRACT_RISK'
  | 'SUMMARIZE_CONTRACT'
  | 'DRAFT_APPROVAL_NOTE'
  | 'DRAFT_RENEWAL_EMAIL'
  | 'SUGGEST_CLAUSE_FALLBACK'
  | 'FIND_VENDOR_COMPLIANCE_ISSUES'
  | 'SHOW_EXECUTION_BLOCKERS'
  | 'GENERAL_HELP'
  | 'UNKNOWN';

export type CopilotActionType =
  | 'OPEN_CONTRACT'
  | 'FILTER_REPOSITORY'
  | 'CREATE_TASK'
  | 'DRAFT_EMAIL'
  | 'EXPORT_RESULTS'
  | 'OPEN_WORK_QUEUE'
  | 'OPEN_RENEWALS'
  | 'OPEN_OBLIGATIONS'
  | 'OPEN_VENDOR'
  | 'OPEN_WORKSPACE';

export type CopilotContextSource = 'contracts' | 'renewals' | 'obligations' | 'approvals' | 'execution' | 'vendors' | 'clauses' | 'security';

export type CopilotConfidence = 'High' | 'Medium' | 'Low';

export type CopilotCitation = {
  label: string;
  source: CopilotContextSource;
  contractId?: string;
  note?: string;
};

export type CopilotIntent = {
  type: CopilotIntentType;
  confidence: CopilotConfidence;
  entities?: Record<string, string>;
};

export type CopilotAction = {
  type: CopilotActionType;
  label: string;
  contractId?: string;
  payload?: Record<string, string>;
  disabled?: boolean;
  reason?: string;
};

export type SuggestedAction = {
  label: string;
  rationale: string;
  priority: TaskPriority;
  requiresApproval?: boolean;
};

export type RenewalInsight = {
  renewalDate?: string;
  noticeDeadline?: string;
  daysUntilNotice?: number;
  autoRenew?: boolean;
  risk: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
};

export type ObligationInsight = {
  totalOpen: number;
  overdue: number;
  dueThisWeek: number;
  recommendation: string;
};

export type VendorRiskInsight = {
  counterparty: string;
  complianceStatus: string;
  insuranceStatus: string;
  sanctionsStatus: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
};

export type ContractInsight = {
  contractId: string;
  title: string;
  summary: string;
  riskScore: number;
  missingClauses: string[];
  pendingApprovals: number;
  renewalInsight: RenewalInsight;
  obligationInsight: ObligationInsight;
  vendorRiskInsight: VendorRiskInsight;
  confidence: CopilotConfidence;
  humanReviewNeeded: boolean;
};

export type RiskExplanation = {
  contractId: string;
  title: string;
  riskScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  riskDrivers: string[];
  missingClauseWarnings: string[];
  confidence: CopilotConfidence;
  reviewReminder: string;
};

export type ClauseRecommendation = {
  clauseName: string;
  riskLevel: string;
  fallbackLanguage: string;
  rationale: string;
  confidence: CopilotConfidence;
};

export type NaturalLanguageSearchResult = {
  contractId: string;
  title: string;
  counterparty: string;
  status: string;
  riskScore: number;
  reason: string;
  confidence: CopilotConfidence;
};

export type CopilotPromptSuggestion = {
  label: string;
  prompt: string;
};

export type CopilotFeedback = {
  messageId: string;
  rating: 'helpful' | 'not_helpful';
  note?: string;
  timestamp: string;
};

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  intent?: CopilotIntent;
  response?: CopilotResponse;
};

export type CopilotResponse = {
  messageId: string;
  summary: string;
  confidence: CopilotConfidence;
  intent: CopilotIntent;
  results: NaturalLanguageSearchResult[];
  insights?: ContractInsight[];
  riskExplanation?: RiskExplanation;
  draftText?: string;
  clauseRecommendation?: ClauseRecommendation;
  actions: CopilotAction[];
  citations: CopilotCitation[];
  humanReviewReminder?: string;
};

export type CopilotSession = {
  id: string;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
};
