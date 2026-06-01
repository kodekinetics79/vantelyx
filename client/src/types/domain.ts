export type ContractStatus =
  | 'Drafting'
  | 'Legal Review'
  | 'Finance Review'
  | 'Counterparty Review'
  | 'Approval Pending'
  | 'Executed'
  | 'Renewal Window'
  | 'Expired'
  | 'Terminated';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type ContractType =
  | 'Master Services Agreement'
  | 'NDA'
  | 'Statement of Work'
  | 'Lease'
  | 'Software License'
  | 'Purchase Agreement'
  | 'Grant Agreement'
  | 'Employment Agreement';

export type Contract = {
  id: string;
  title: string;
  counterparty: string;
  owner: string;
  department: string;
  type: ContractType;
  status: ContractStatus;
  value: number;
  startDate: string;
  endDate: string;
  renewalDate: string;
  riskScore: number;
  riskLevel: RiskLevel;
  tags: string[];
  aiSummary: string;
  nextAction: string;
  clauses: ClauseInsight[];
  obligations: Obligation[];
};

export type ClauseInsight = {
  name: string;
  status: 'Approved' | 'Needs Review' | 'Missing' | 'Non-standard';
  risk: RiskLevel;
  note: string;
};

export type Obligation = {
  id: string;
  contractId: string;
  title: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  priority: RiskLevel;
};

export type WorkflowStep = {
  id: string;
  contractId: string;
  name: string;
  role: string;
  assignee: string;
  status: 'Waiting' | 'Active' | 'Approved' | 'Rejected' | 'Skipped';
  slaHours: number;
};

export type Vendor = {
  id: string;
  name: string;
  category: string;
  risk: RiskLevel;
  activeContracts: number;
  expiringSoon: number;
  lastReview: string;
};

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
};
