export type TaskSource =
  | 'AI Intake'
  | 'Approval'
  | 'Obligation'
  | 'Renewal'
  | 'Execution'
  | 'Clause Review'
  | 'Vendor Compliance'
  | 'Admin Review';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type WorkItemStatus =
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'snoozed'
  | 'escalated'
  | 'completed'
  | 'cancelled';

export type WorkItemSlaStatus = 'on_track' | 'due_soon' | 'overdue' | 'breached' | 'escalated';

export type WorkItemHistory = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  note?: string;
  previousStatus?: WorkItemStatus;
  newStatus?: WorkItemStatus;
};

export type WorkItem = {
  id: string;
  title: string;
  source: TaskSource;
  contractId?: string;
  contractTitle?: string;
  counterparty?: string;
  priority: TaskPriority;
  dueDate: string;
  assignee: string;
  status: WorkItemStatus;
  createdAt: string;
  updatedAt: string;
  note?: string;
  escalationReason?: string;
  escalatedAt?: string;
  snoozedUntil?: string;
  referenceId?: string;
  history?: WorkItemHistory[];
};

export type NotificationType =
  | 'approval_assigned'
  | 'approval_overdue'
  | 'obligation_due_soon'
  | 'obligation_overdue'
  | 'renewal_notice_deadline'
  | 'missed_renewal_notice'
  | 'execution_package_waiting'
  | 'clause_review_required'
  | 'vendor_compliance_issue'
  | 'sla_escalation';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type Notification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  source: TaskSource;
  workItemId?: string;
  contractId?: string;
  contractTitle?: string;
  counterparty?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type SLARule = {
  id: string;
  source: TaskSource;
  thresholdHours: number;
  escalationThresholdHours: number;
};

export type EscalationRule = {
  id: string;
  source: TaskSource;
  priority: TaskPriority;
  escalationAssignee: string;
  thresholdHours: number;
};

export type CalendarEventType =
  | 'renewal_notice_deadline'
  | 'contract_expiration'
  | 'obligation_due_date'
  | 'approval_sla_deadline'
  | 'execution_target_date'
  | 'vendor_compliance_review_date';

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  workItemId?: string;
  contractId?: string;
  contractTitle?: string;
  counterparty?: string;
  title: string;
  startAt: string;
  endAt: string;
  owner: string;
  priority: TaskPriority;
  status?: 'pending' | 'completed' | 'overdue';
  location?: string;
  note?: string;
};

export type SlaMetrics = {
  totalOpen: number;
  overdue: number;
  breached: number;
  escalated: number;
  dueIn7Days: number;
};

export type SlaControlSummary = {
  approvalSlaBreaches: number;
  overdueObligations: number;
  missedRenewalNotices: number;
  executionDelays: number;
  escalatedWorkItems: number;
};
