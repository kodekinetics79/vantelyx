import type { AuditEvent, Contract, Obligation, Vendor, WorkflowStep } from '../types/domain';

export const contracts: Contract[] = [
  {
    id: 'CLM-2026-001',
    title: 'Enterprise SaaS Subscription and Support Agreement',
    counterparty: 'Northstar Analytics LLC',
    owner: 'Aisha Malik',
    department: 'Technology',
    type: 'Software License',
    status: 'Legal Review',
    value: 428000,
    startDate: '2026-07-01',
    endDate: '2029-06-30',
    renewalDate: '2029-03-31',
    riskScore: 76,
    riskLevel: 'High',
    tags: ['AI Review', 'Data Processing', 'Auto-Renewal'],
    aiSummary:
      'High-value technology contract with data-processing obligations, non-standard limitation of liability, and a 90-day auto-renewal notice requirement.',
    nextAction: 'Legal to resolve limitation of liability and data retention language.',
    clauses: [
      { name: 'Limitation of Liability', status: 'Non-standard', risk: 'High', note: 'Cap is uncapped for confidentiality and data incidents.' },
      { name: 'Termination for Convenience', status: 'Needs Review', risk: 'Medium', note: 'Client termination window is missing.' },
      { name: 'Data Processing Addendum', status: 'Approved', risk: 'Low', note: 'DPA attached and matched to approved template.' }
    ],
    obligations: [
      { id: 'OB-001', contractId: 'CLM-2026-001', title: 'Complete security questionnaire', owner: 'Security', dueDate: '2026-06-21', status: 'In Progress', priority: 'High' },
      { id: 'OB-002', contractId: 'CLM-2026-001', title: 'Send renewal notice by deadline', owner: 'Procurement', dueDate: '2029-03-31', status: 'Open', priority: 'Medium' }
    ]
  },
  {
    id: 'CLM-2026-002',
    title: 'Facilities Maintenance Master Services Agreement',
    counterparty: 'BlueRidge Facility Services',
    owner: 'Marcus Reed',
    department: 'Operations',
    type: 'Master Services Agreement',
    status: 'Approval Pending',
    value: 1125000,
    startDate: '2026-08-01',
    endDate: '2028-07-31',
    renewalDate: '2028-04-30',
    riskScore: 58,
    riskLevel: 'Medium',
    tags: ['Insurance', 'SLA', 'Vendor Risk'],
    aiSummary:
      'Operations MSA with insurance certificates, SLA credits, and subcontractor controls. Commercial terms are close to playbook.',
    nextAction: 'CFO approval required due to contract value threshold.',
    clauses: [
      { name: 'Insurance Requirements', status: 'Approved', risk: 'Low', note: 'Limits meet internal policy.' },
      { name: 'Subcontractor Flow-down', status: 'Needs Review', risk: 'Medium', note: 'Flow-down wording is weaker than template.' },
      { name: 'Service Credits', status: 'Approved', risk: 'Low', note: 'SLA credit schedule included.' }
    ],
    obligations: [
      { id: 'OB-003', contractId: 'CLM-2026-002', title: 'Verify annual COI before work authorization', owner: 'Risk', dueDate: '2026-07-15', status: 'Open', priority: 'Medium' }
    ]
  },
  {
    id: 'CLM-2026-003',
    title: 'Mutual Confidentiality Agreement',
    counterparty: 'CivicPoint Systems',
    owner: 'Julia Chen',
    department: 'Sales',
    type: 'NDA',
    status: 'Executed',
    value: 0,
    startDate: '2026-05-10',
    endDate: '2029-05-09',
    renewalDate: '2029-02-08',
    riskScore: 22,
    riskLevel: 'Low',
    tags: ['Standard', 'Self-Service'],
    aiSummary: 'Standard mutual NDA generated from approved template and executed through e-signature.',
    nextAction: 'No action required.',
    clauses: [
      { name: 'Confidentiality Period', status: 'Approved', risk: 'Low', note: 'Three-year period accepted.' },
      { name: 'Residual Knowledge', status: 'Approved', risk: 'Low', note: 'No residual knowledge exception included.' }
    ],
    obligations: []
  },
  {
    id: 'CLM-2026-004',
    title: 'Grant Services Statement of Work',
    counterparty: 'Township Development Authority',
    owner: 'Omar Siddiqui',
    department: 'Public Sector',
    type: 'Statement of Work',
    status: 'Renewal Window',
    value: 289000,
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    renewalDate: '2026-06-30',
    riskScore: 84,
    riskLevel: 'Critical',
    tags: ['Public Sector', 'Deliverables', 'Renewal'],
    aiSummary:
      'Public-sector SOW entering renewal window with deliverable acceptance dependency and invoice holdback language.',
    nextAction: 'Account owner must confirm renewal intent and acceptance status before June 30.',
    clauses: [
      { name: 'Acceptance Criteria', status: 'Needs Review', risk: 'High', note: 'Acceptance deemed-delivered language is missing.' },
      { name: 'Invoice Holdback', status: 'Non-standard', risk: 'Critical', note: '15% holdback remains until final written acceptance.' },
      { name: 'Change Control', status: 'Approved', risk: 'Low', note: 'Formal change-order workflow included.' }
    ],
    obligations: [
      { id: 'OB-004', contractId: 'CLM-2026-004', title: 'Submit renewal recommendation memo', owner: 'Public Sector', dueDate: '2026-06-12', status: 'Open', priority: 'Critical' },
      { id: 'OB-005', contractId: 'CLM-2026-004', title: 'Confirm deliverable acceptance evidence', owner: 'PMO', dueDate: '2026-06-20', status: 'Open', priority: 'High' }
    ]
  }
];

export const workflowSteps: WorkflowStep[] = [
  { id: 'WF-001', contractId: 'CLM-2026-001', name: 'Business Intake', role: 'Requester', assignee: 'Aisha Malik', status: 'Approved', slaHours: 8 },
  { id: 'WF-002', contractId: 'CLM-2026-001', name: 'Legal Clause Review', role: 'Legal', assignee: 'Nina Patel', status: 'Active', slaHours: 48 },
  { id: 'WF-003', contractId: 'CLM-2026-001', name: 'Security Review', role: 'Security', assignee: 'Daniel Cho', status: 'Waiting', slaHours: 72 },
  { id: 'WF-004', contractId: 'CLM-2026-002', name: 'Finance Approval', role: 'Finance', assignee: 'CFO Queue', status: 'Active', slaHours: 24 },
  { id: 'WF-005', contractId: 'CLM-2026-004', name: 'Renewal Decision', role: 'Business Owner', assignee: 'Omar Siddiqui', status: 'Active', slaHours: 24 }
];

export const obligations: Obligation[] = contracts.flatMap(contract => contract.obligations);

export const vendors: Vendor[] = [
  { id: 'V-001', name: 'Northstar Analytics LLC', category: 'Technology', risk: 'High', activeContracts: 3, expiringSoon: 1, lastReview: '2026-04-20' },
  { id: 'V-002', name: 'BlueRidge Facility Services', category: 'Facilities', risk: 'Medium', activeContracts: 5, expiringSoon: 0, lastReview: '2026-03-15' },
  { id: 'V-003', name: 'CivicPoint Systems', category: 'Public Sector Partner', risk: 'Low', activeContracts: 1, expiringSoon: 0, lastReview: '2026-05-01' },
  { id: 'V-004', name: 'Township Development Authority', category: 'Government', risk: 'Critical', activeContracts: 2, expiringSoon: 2, lastReview: '2026-05-25' }
];

export const auditEvents: AuditEvent[] = [
  { id: 'A-001', timestamp: '2026-06-01T09:42:00', actor: 'Nina Patel', action: 'Clause flagged', object: 'CLM-2026-001', detail: 'Limitation of liability marked non-standard.' },
  { id: 'A-002', timestamp: '2026-06-01T09:30:00', actor: 'AI Review Agent', action: 'Risk scored', object: 'CLM-2026-004', detail: 'Renewal risk increased to Critical due to holdback and approaching notice deadline.' },
  { id: 'A-003', timestamp: '2026-06-01T08:55:00', actor: 'Marcus Reed', action: 'Approval requested', object: 'CLM-2026-002', detail: 'Routed to CFO based on $1M+ threshold.' },
  { id: 'A-004', timestamp: '2026-05-31T17:22:00', actor: 'Julia Chen', action: 'Contract executed', object: 'CLM-2026-003', detail: 'Mutual NDA completed via e-signature.' }
];

export const trendData = [
  { month: 'Jan', created: 18, executed: 11, cycle: 14 },
  { month: 'Feb', created: 24, executed: 16, cycle: 12 },
  { month: 'Mar', created: 28, executed: 20, cycle: 10 },
  { month: 'Apr', created: 31, executed: 24, cycle: 9 },
  { month: 'May', created: 39, executed: 31, cycle: 7 },
  { month: 'Jun', created: 42, executed: 34, cycle: 6 }
];

export const rfpCoverage = [
  { requirement: 'Central contract repository', coverage: 'Built', module: 'Repository', note: 'Searchable contracts, metadata, documents, status, owner, counterparty, value, dates.' },
  { requirement: 'Workflow and approval routing', coverage: 'Built', module: 'Workflow Studio', note: 'Role-based steps, SLA timers, threshold-based routing, audit-ready approvals.' },
  { requirement: 'Renewal and expiration management', coverage: 'Built', module: 'Renewals', note: 'Renewal windows, alerts, owners, critical-risk escalations.' },
  { requirement: 'Obligation tracking', coverage: 'Built', module: 'Obligation Center', note: 'Owner, due date, priority, status, contract link, overdue logic.' },
  { requirement: 'Clause library and templates', coverage: 'Planned backend-ready', module: 'Clause Intelligence', note: 'UI supports clause review; backend has models ready for extension.' },
  { requirement: 'Reporting and dashboards', coverage: 'Built', module: 'Analytics', note: 'Cycle time, risk exposure, value, expiring contracts, workflow bottlenecks.' },
  { requirement: 'Security and roles', coverage: 'Built blueprint', module: 'Admin', note: 'RBAC, audit trail, permission model, SSO-ready design.' },
  { requirement: 'AI extraction and redline support', coverage: 'Bonus', module: 'AI Intake', note: 'Mocked AI outputs; integration point ready for LLM/document parsing services.' }
];
