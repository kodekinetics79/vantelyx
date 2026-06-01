import { getExecutionPackages } from './executionService';
import { addActivityLog, getContracts } from './vantelyxData';
import { getCurrentUser } from './securityService';
import type {
  CalendarEvent,
  CalendarEventType,
  EscalationRule,
  Notification,
  NotificationSeverity,
  NotificationType,
  SLARule,
  SlaControlSummary,
  SlaMetrics,
  TaskPriority,
  TaskSource,
  WorkItem,
  WorkItemHistory,
  WorkItemSlaStatus,
  WorkItemStatus
} from '../types/workflowOps';

const WORK_ITEMS_KEY = 'vantelyx_work_items';
const NOTIFICATIONS_KEY = 'vantelyx_notifications';
const CALENDAR_EVENTS_KEY = 'vantelyx_calendar_events';
const SLA_RULES_KEY = 'vantelyx_sla_rules';
const ESCALATION_RULES_KEY = 'vantelyx_escalation_rules';

const hasStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;
const nowIso = (): string => new Date().toISOString();
const randomId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const read = <T>(key: string, fallback: T): T => {
  if (!hasStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = <T>(key: string, value: T): void => {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const addDaysIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const isOpenStatus = (status: WorkItemStatus): boolean =>
  status === 'open' || status === 'in_progress' || status === 'waiting' || status === 'snoozed' || status === 'escalated';

const isValidDate = (value: string | undefined): boolean => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const defaultSlaRules = (): SLARule[] => [
  { id: 'sla_approval', source: 'Approval', thresholdHours: 48, escalationThresholdHours: 72 },
  { id: 'sla_obligation', source: 'Obligation', thresholdHours: 72, escalationThresholdHours: 120 },
  { id: 'sla_renewal', source: 'Renewal', thresholdHours: 96, escalationThresholdHours: 144 },
  { id: 'sla_execution', source: 'Execution', thresholdHours: 48, escalationThresholdHours: 96 },
  { id: 'sla_clause', source: 'Clause Review', thresholdHours: 72, escalationThresholdHours: 120 },
  { id: 'sla_vendor', source: 'Vendor Compliance', thresholdHours: 96, escalationThresholdHours: 168 },
  { id: 'sla_admin', source: 'Admin Review', thresholdHours: 120, escalationThresholdHours: 240 },
  { id: 'sla_intake', source: 'AI Intake', thresholdHours: 24, escalationThresholdHours: 48 }
];

const defaultEscalationRules = (): EscalationRule[] => [
  { id: 'esc_approval', source: 'Approval', priority: 'high', escalationAssignee: 'Legal Admin', thresholdHours: 72 },
  { id: 'esc_execution', source: 'Execution', priority: 'critical', escalationAssignee: 'Executive Approver', thresholdHours: 96 },
  { id: 'esc_renewal', source: 'Renewal', priority: 'high', escalationAssignee: 'Contract Manager', thresholdHours: 144 }
];

const defaultAssignee = (source: TaskSource): string => {
  switch (source) {
    case 'Approval':
      return 'Legal Reviewer';
    case 'Obligation':
      return 'Operations Owner';
    case 'Renewal':
      return 'Renewal Owner';
    case 'Execution':
      return 'Execution Coordinator';
    case 'Clause Review':
      return 'Legal Counsel';
    case 'Vendor Compliance':
      return 'Procurement Reviewer';
    case 'Admin Review':
      return 'System Admin';
    default:
      return 'Workspace User';
  }
};

const historyEntry = (
  action: string,
  previousStatus: WorkItemStatus | undefined,
  newStatus: WorkItemStatus | undefined,
  note?: string
): WorkItemHistory => ({
  id: randomId('hist'),
  timestamp: nowIso(),
  actor: getCurrentUser().fullName || 'Workflow User',
  action,
  previousStatus,
  newStatus,
  note
});

const notificationTypeForSource = (source: TaskSource): NotificationType => {
  switch (source) {
    case 'Approval':
      return 'approval_assigned';
    case 'Obligation':
      return 'obligation_due_soon';
    case 'Renewal':
      return 'renewal_notice_deadline';
    case 'Execution':
      return 'execution_package_waiting';
    case 'Clause Review':
      return 'clause_review_required';
    case 'Vendor Compliance':
      return 'vendor_compliance_issue';
    default:
      return 'approval_assigned';
  }
};

const notificationSeverityForPriority = (priority: TaskPriority): NotificationSeverity => {
  if (priority === 'critical') return 'critical';
  if (priority === 'high') return 'warning';
  return 'info';
};

const createNotification = (
  type: NotificationType,
  source: TaskSource,
  priority: TaskPriority,
  title: string,
  message: string,
  workItemId?: string,
  contractId?: string,
  contractTitle?: string,
  counterparty?: string
): Notification => ({
  id: randomId('notif'),
  type,
  source,
  severity: notificationSeverityForPriority(priority),
  workItemId,
  contractId,
  contractTitle,
  counterparty,
  title,
  message,
  read: false,
  createdAt: nowIso()
});

const pushNotification = (notification: Notification): void => {
  const notifications = read<Notification[]>(NOTIFICATIONS_KEY, []);
  write(NOTIFICATIONS_KEY, [notification, ...notifications].slice(0, 250));
};

const addContractAudit = (contractId: string | undefined, message: string, note?: string): void => {
  if (!contractId) return;
  addActivityLog(contractId, {
    actor: getCurrentUser().fullName || 'Workflow User',
    event: 'comment',
    message,
    action: 'Task Workflow',
    note,
    source: 'Workflow',
    labels: ['user action']
  });
};

const dueHours = (dueDate: string): number => {
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return Number.POSITIVE_INFINITY;
  return (due - new Date().getTime()) / (1000 * 60 * 60);
};

export const getWorkItemSlaStatus = (item: WorkItem): WorkItemSlaStatus => {
  if (item.status === 'escalated' || !!item.escalatedAt) return 'escalated';
  if (item.status === 'completed' || item.status === 'cancelled') return 'on_track';
  const hours = dueHours(item.dueDate);
  if (!Number.isFinite(hours)) return 'due_soon';
  if (hours < -24) return 'breached';
  if (hours < 0) return 'overdue';
  const dueSoonThreshold = item.priority === 'critical' ? 12 : item.priority === 'high' ? 24 : 48;
  if (hours <= dueSoonThreshold) return 'due_soon';
  return 'on_track';
};

const makeGeneratedItem = (
  source: TaskSource,
  referenceId: string,
  title: string,
  priority: TaskPriority,
  dueDate: string,
  contractId?: string,
  contractTitle?: string,
  counterparty?: string,
  assignee?: string,
  note?: string
): WorkItem => ({
  id: randomId('wi'),
  source,
  referenceId,
  title,
  priority,
  dueDate: isValidDate(dueDate) ? dueDate : addDaysIso(3),
  contractId,
  contractTitle,
  counterparty,
  assignee: assignee?.trim() || defaultAssignee(source),
  status: 'open',
  createdAt: nowIso(),
  updatedAt: nowIso(),
  note,
  history: [historyEntry('Task created', undefined, 'open', note)]
});

const generateFromContracts = (): WorkItem[] => {
  const contracts = getContracts();
  const executionPackages = getExecutionPackages();
  const generated: WorkItem[] = [];

  contracts.forEach((contract) => {
    const base = {
      contractId: contract.id,
      contractTitle: contract.request.title,
      counterparty: contract.counterparty?.name || 'Unknown Counterparty'
    };

    contract.approvals
      .filter((step) => step.decision !== 'approved')
      .forEach((step) => {
        generated.push(
          makeGeneratedItem(
            'Approval',
            `approval_${contract.id}_${step.id}`,
            `Approval required: ${step.role}`,
            'high',
            addDaysIso(2),
            base.contractId,
            base.contractTitle,
            base.counterparty,
            step.approver,
            'Pending approval step requires action.'
          )
        );
      });

    contract.obligations
      .filter((obligation) => obligation.status !== 'done')
      .forEach((obligation) => {
        const overdue = isValidDate(obligation.dueDate) && new Date(obligation.dueDate).getTime() < Date.now();
        generated.push(
          makeGeneratedItem(
            'Obligation',
            `obligation_${contract.id}_${obligation.id}`,
            `Obligation: ${obligation.title}`,
            overdue ? 'high' : obligation.priority,
            obligation.dueDate,
            base.contractId,
            base.contractTitle,
            base.counterparty,
            obligation.owner,
            overdue ? 'Overdue obligation requires immediate follow-up.' : 'Open obligation requires tracking.'
          )
        );
      });

    if (contract.renewal.daysUntilNoticeDeadline <= 45) {
      const missed = contract.renewal.daysUntilNoticeDeadline < 0;
      generated.push(
        makeGeneratedItem(
          'Renewal',
          `renewal_${contract.id}`,
          missed ? 'Missed renewal notice deadline' : 'Renewal notice window approaching',
          missed ? 'critical' : contract.renewal.renewalRisk === 'critical' ? 'critical' : 'high',
          contract.renewal.noticeDeadline,
          base.contractId,
          base.contractTitle,
          base.counterparty,
          contract.renewal.renewalOwner,
          contract.renewal.recommendedAction
        )
      );
    }

    const riskyClause = (contract.clauseReviews || []).find(
      (item) => item.legalReviewRequired && (item.status === 'risky' || item.status === 'missing')
    );
    if (riskyClause) {
      generated.push(
        makeGeneratedItem(
          'Clause Review',
          `clause_${contract.id}_${riskyClause.id}`,
          `Clause review required: ${riskyClause.clause}`,
          'high',
          addDaysIso(3),
          base.contractId,
          base.contractTitle,
          base.counterparty,
          undefined,
          riskyClause.aiRiskNote
        )
      );
    }

    if (contract.counterparty && contract.counterparty.complianceStatus !== 'compliant') {
      generated.push(
        makeGeneratedItem(
          'Vendor Compliance',
          `vendor_${contract.id}_${contract.counterparty.id}`,
          `Vendor compliance review: ${contract.counterparty.name}`,
          'high',
          addDaysIso(7),
          base.contractId,
          base.contractTitle,
          base.counterparty,
          contract.counterparty.relationshipOwner,
          'Counterparty compliance is not marked compliant.'
        )
      );
    }

    if (contract.riskScore >= 85) {
      generated.push(
        makeGeneratedItem(
          'Admin Review',
          `admin_security_${contract.id}`,
          `Admin/security review: ${contract.request.title}`,
          'critical',
          addDaysIso(2),
          base.contractId,
          base.contractTitle,
          base.counterparty,
          'System Admin',
          'High-risk contract requires admin/security oversight.'
        )
      );
    }
  });

  executionPackages
    .filter((pkg) => pkg.status === 'draft' || pkg.status === 'sent')
    .forEach((pkg) => {
      const contract = contracts.find((item) => item.id === pkg.contractId);
      const missingSigner = pkg.signers.length === 0;
      if (!missingSigner && pkg.status !== 'sent') return;
      generated.push(
        makeGeneratedItem(
          'Execution',
          `execution_${pkg.contractId}_${pkg.id}`,
          missingSigner ? 'Execution blocker: add signer' : 'Execution package waiting for signature',
          'critical',
          pkg.sentAt || addDaysIso(5),
          pkg.contractId,
          contract?.request.title,
          contract?.counterparty?.name,
          defaultAssignee('Execution'),
          `Provider: ${pkg.provider}`
        )
      );
    });

  return generated;
};

const dedupeAndMergeGenerated = (existing: WorkItem[], generated: WorkItem[]): WorkItem[] => {
  const existingOpenRefs = new Set(existing.filter((item) => isOpenStatus(item.status)).map((item) => item.referenceId));
  const toAdd = generated.filter((item) => item.referenceId && !existingOpenRefs.has(item.referenceId));
  return [...existing, ...toAdd];
};

const ensureMinimumDemoData = (items: WorkItem[]): WorkItem[] => {
  if (items.length >= 12) return items;
  const filler: WorkItem[] = [
    makeGeneratedItem('AI Intake', 'demo_intake_1', 'Intake triage for incoming request', 'medium', addDaysIso(1), undefined, 'New Intake Request', 'N/A', 'Workspace User'),
    makeGeneratedItem('Approval', 'demo_approval_1', 'Department approval follow-up', 'high', addDaysIso(-1), undefined, 'Demo Approval', 'N/A', 'Legal Reviewer'),
    makeGeneratedItem('Obligation', 'demo_obligation_1', 'Quarterly reporting obligation', 'medium', addDaysIso(5), undefined, 'Demo Obligation', 'N/A', 'Operations Owner'),
    makeGeneratedItem('Renewal', 'demo_renewal_1', 'Renewal decision planning', 'high', addDaysIso(14), undefined, 'Demo Renewal', 'N/A', 'Renewal Owner'),
    makeGeneratedItem('Execution', 'demo_execution_1', 'Finalize signature package', 'critical', addDaysIso(2), undefined, 'Demo Execution', 'N/A', 'Execution Coordinator'),
    makeGeneratedItem('Vendor Compliance', 'demo_vendor_1', 'Vendor certificate follow-up', 'high', addDaysIso(21), undefined, 'Demo Vendor', 'N/A', 'Procurement Reviewer')
  ];
  const merged = dedupeAndMergeGenerated(items, filler);
  if (merged[0]) merged[0].status = 'completed';
  if (merged[1]) merged[1].status = 'escalated';
  return merged;
};

const generateNotificationsFromOpenTasks = (items: WorkItem[]): Notification[] => {
  const notifications: Notification[] = [];
  items.forEach((item) => {
    if (!isOpenStatus(item.status)) return;
    const sla = getWorkItemSlaStatus(item);
    if (item.source === 'Obligation' && (sla === 'due_soon' || sla === 'overdue' || sla === 'breached')) {
      notifications.push(
        createNotification(
          sla === 'due_soon' ? 'obligation_due_soon' : 'obligation_overdue',
          item.source,
          item.priority,
          sla === 'due_soon' ? 'Obligation due soon' : 'Obligation overdue',
          item.title,
          item.id,
          item.contractId,
          item.contractTitle,
          item.counterparty
        )
      );
    }
    if (item.source === 'Approval' && (sla === 'overdue' || sla === 'breached')) {
      notifications.push(
        createNotification('approval_overdue', item.source, item.priority, 'Approval overdue', item.title, item.id, item.contractId, item.contractTitle, item.counterparty)
      );
    }
    if (item.source === 'Renewal') {
      notifications.push(
        createNotification(
          item.title.toLowerCase().includes('missed') ? 'missed_renewal_notice' : 'renewal_notice_deadline',
          item.source,
          item.priority,
          'Renewal action required',
          item.title,
          item.id,
          item.contractId,
          item.contractTitle,
          item.counterparty
        )
      );
    }
    if (item.status === 'escalated') {
      notifications.push(
        createNotification('sla_escalation', item.source, item.priority, 'SLA escalation', item.title, item.id, item.contractId, item.contractTitle, item.counterparty)
      );
    }
  });
  return notifications;
};

const syncGeneratedData = (): void => {
  const existing = read<WorkItem[]>(WORK_ITEMS_KEY, []);
  const merged = ensureMinimumDemoData(dedupeAndMergeGenerated(existing, generateFromContracts()));
  write(WORK_ITEMS_KEY, merged);

  const existingNotifications = read<Notification[]>(NOTIFICATIONS_KEY, []);
  if (existingNotifications.length === 0) {
    const seeded = generateNotificationsFromOpenTasks(merged).slice(0, 12);
    write(NOTIFICATIONS_KEY, seeded.length > 0 ? seeded : [
      createNotification('approval_assigned', 'Approval', 'medium', 'Task Inbox Initialized', 'Workflow task engine is ready.')
    ]);
  }
};

export const seedTaskData = (): void => {
  if (read<SLARule[]>(SLA_RULES_KEY, []).length === 0) write(SLA_RULES_KEY, defaultSlaRules());
  if (read<EscalationRule[]>(ESCALATION_RULES_KEY, []).length === 0) write(ESCALATION_RULES_KEY, defaultEscalationRules());
  if (read<CalendarEvent[]>(CALENDAR_EVENTS_KEY, []).length === 0) write(CALENDAR_EVENTS_KEY, []);
  syncGeneratedData();
};

export const getWorkItems = (): WorkItem[] => {
  seedTaskData();
  syncGeneratedData();
  return read<WorkItem[]>(WORK_ITEMS_KEY, []).sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
};

export const getWorkItemById = (id: string): WorkItem | undefined => getWorkItems().find((item) => item.id === id);

export const createWorkItem = (
  input: Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'history'> & { status?: WorkItemStatus }
): WorkItem => {
  const workItems = getWorkItems();
  if (input.referenceId && workItems.some((item) => item.referenceId === input.referenceId && isOpenStatus(item.status))) {
    return workItems.find((item) => item.referenceId === input.referenceId && isOpenStatus(item.status)) as WorkItem;
  }

  const workItem: WorkItem = {
    ...input,
    dueDate: isValidDate(input.dueDate) ? input.dueDate : addDaysIso(3),
    assignee: input.assignee?.trim() || defaultAssignee(input.source),
    id: randomId('wi'),
    status: input.status ?? 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [historyEntry('Task created', undefined, input.status ?? 'open', input.note)]
  };
  write(WORK_ITEMS_KEY, [workItem, ...workItems]);

  const type = notificationTypeForSource(workItem.source);
  pushNotification(createNotification(type, workItem.source, workItem.priority, 'Work item created', workItem.title, workItem.id, workItem.contractId, workItem.contractTitle, workItem.counterparty));
  addContractAudit(workItem.contractId, 'Task created', workItem.title);
  return workItem;
};

export const updateWorkItemStatus = (id: string, status: WorkItemStatus, note?: string): WorkItem | undefined => {
  const workItems = getWorkItems();
  const idx = workItems.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  const previousStatus = workItems[idx].status;
  const updated: WorkItem = {
    ...workItems[idx],
    status,
    note: note ?? workItems[idx].note,
    updatedAt: nowIso(),
    history: [...(workItems[idx].history || []), historyEntry(`Status updated: ${status}`, previousStatus, status, note)]
  };
  workItems[idx] = updated;
  write(WORK_ITEMS_KEY, workItems);

  if (status === 'completed') {
    pushNotification(createNotification(notificationTypeForSource(updated.source), updated.source, updated.priority, 'Task completed', updated.title, updated.id, updated.contractId, updated.contractTitle, updated.counterparty));
    addContractAudit(updated.contractId, updated.source === 'Obligation' ? 'Obligation task completed' : 'Task completed', updated.title);
  }
  if (status === 'in_progress' || status === 'waiting' || status === 'cancelled' || status === 'snoozed') {
    addContractAudit(updated.contractId, `Task ${status.replace('_', ' ')}`, updated.title);
  }
  return updated;
};

export const assignWorkItem = (id: string, assignee: string): WorkItem | undefined => {
  const workItems = getWorkItems();
  const idx = workItems.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  const updated: WorkItem = {
    ...workItems[idx],
    assignee: assignee?.trim() || defaultAssignee(workItems[idx].source),
    updatedAt: nowIso(),
    history: [...(workItems[idx].history || []), historyEntry('Task reassigned', workItems[idx].status, workItems[idx].status, `Reassigned to ${assignee}`)]
  };
  workItems[idx] = updated;
  write(WORK_ITEMS_KEY, workItems);

  pushNotification(createNotification('approval_assigned', updated.source, updated.priority, 'Work item reassigned', `${updated.title} reassigned to ${updated.assignee}.`, id, updated.contractId, updated.contractTitle, updated.counterparty));
  addContractAudit(updated.contractId, 'Task reassigned', `${updated.title} -> ${updated.assignee}`);
  return updated;
};

export const escalateWorkItem = (id: string, reason: string): WorkItem | undefined => {
  const workItems = getWorkItems();
  const idx = workItems.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  const updated: WorkItem = {
    ...workItems[idx],
    status: 'escalated',
    escalationReason: reason,
    escalatedAt: nowIso(),
    updatedAt: nowIso(),
    history: [...(workItems[idx].history || []), historyEntry('Task escalated', workItems[idx].status, 'escalated', reason)]
  };
  workItems[idx] = updated;
  write(WORK_ITEMS_KEY, workItems);

  pushNotification(createNotification('sla_escalation', updated.source, updated.priority, 'Work item escalated', `${updated.title} escalated: ${reason}`, id, updated.contractId, updated.contractTitle, updated.counterparty));
  addContractAudit(updated.contractId, 'Task escalated', reason);
  return updated;
};

export const getNotifications = (): Notification[] => {
  seedTaskData();
  return read<Notification[]>(NOTIFICATIONS_KEY, []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const markNotificationRead = (id: string): Notification | undefined => {
  const notifications = getNotifications();
  const idx = notifications.findIndex((notification) => notification.id === id);
  if (idx === -1) return undefined;
  const updated: Notification = { ...notifications[idx], read: true };
  notifications[idx] = updated;
  write(NOTIFICATIONS_KEY, notifications);
  return updated;
};

export const markAllNotificationsRead = (): void => {
  const notifications = getNotifications().map((notification) => ({ ...notification, read: true }));
  write(NOTIFICATIONS_KEY, notifications);
};

export const getUnreadNotificationCount = (): number => getNotifications().filter((notification) => !notification.read).length;

export const createCalendarEvent = (input: Omit<CalendarEvent, 'id'>): CalendarEvent => {
  const events = getCalendarEvents();
  const event: CalendarEvent = {
    ...input,
    id: randomId('cal')
  };
  write(CALENDAR_EVENTS_KEY, [event, ...events]);
  return event;
};

export const getCalendarEvents = (): CalendarEvent[] => {
  seedTaskData();
  return read<CalendarEvent[]>(CALENDAR_EVENTS_KEY, []);
};

const eventStatusFromDate = (date: string): 'pending' | 'completed' | 'overdue' => {
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return 'pending';
  return target < new Date().getTime() ? 'overdue' : 'pending';
};

const createGeneratedEvent = (
  type: CalendarEventType,
  title: string,
  startAt: string,
  owner: string,
  priority: TaskPriority,
  contractId?: string,
  contractTitle?: string,
  counterparty?: string,
  workItemId?: string,
  note?: string
): CalendarEvent => ({
  id: randomId('cal_gen'),
  type,
  title,
  startAt,
  endAt: startAt,
  owner: owner || 'Unassigned',
  priority,
  contractId,
  contractTitle,
  counterparty,
  workItemId,
  note,
  status: eventStatusFromDate(startAt)
});

export const getOperationalCalendarEvents = (): CalendarEvent[] => {
  const contracts = getContracts();
  const workItems = getWorkItems();
  const executionPackages = getExecutionPackages();
  const generated: CalendarEvent[] = [];

  contracts.forEach((contract) => {
    const title = contract.request.title;
    const counterparty = contract.counterparty?.name;

    generated.push(createGeneratedEvent('renewal_notice_deadline', `Renewal Notice: ${title}`, contract.renewal.noticeDeadline, contract.renewal.renewalOwner || 'Renewal Owner', contract.renewal.renewalRisk === 'critical' ? 'critical' : 'high', contract.id, title, counterparty));
    generated.push(createGeneratedEvent('contract_expiration', `Contract Expiration: ${title}`, contract.renewal.renewalDate, contract.request.requesterName || 'Contract Owner', 'medium', contract.id, title, counterparty));

    contract.obligations.forEach((obligation) => {
      generated.push(createGeneratedEvent('obligation_due_date', `Obligation Due: ${obligation.title}`, obligation.dueDate, obligation.owner || 'Obligation Owner', obligation.priority, contract.id, title, counterparty, undefined, obligation.status));
    });

    contract.approvals.filter((step) => step.decision !== 'approved').forEach((step) => {
      generated.push(createGeneratedEvent('approval_sla_deadline', `Approval SLA: ${step.role} for ${title}`, addDaysIso(2), step.approver || 'Legal Reviewer', 'high', contract.id, title, counterparty));
    });

    if (contract.counterparty?.complianceStatus !== 'compliant') {
      generated.push(createGeneratedEvent('vendor_compliance_review_date', `Vendor Compliance Review: ${counterparty}`, addDaysIso(14), contract.counterparty.relationshipOwner || 'Procurement Reviewer', 'high', contract.id, title, counterparty));
    }
  });

  executionPackages.forEach((pkg) => {
    if (pkg.status === 'executed') return;
    const contract = contracts.find((c) => c.id === pkg.contractId);
    generated.push(createGeneratedEvent('execution_target_date', `Execution Target: ${contract?.request.title ?? pkg.contractId}`, pkg.sentAt || addDaysIso(5), pkg.signers[0]?.name || 'Execution Coordinator', 'critical', pkg.contractId, contract?.request.title, contract?.counterparty?.name, undefined, `Provider: ${pkg.provider}`));
  });

  workItems.forEach((item) => {
    if (!isOpenStatus(item.status)) return;
    if (item.source === 'Approval' || item.source === 'Obligation' || item.source === 'Renewal') {
      generated.push(createGeneratedEvent('approval_sla_deadline', `Task SLA: ${item.title}`, item.dueDate, item.assignee || 'Unassigned', item.priority, item.contractId, item.contractTitle, item.counterparty, item.id));
    }
  });

  const manual = getCalendarEvents();
  const all = [...generated, ...manual];
  return all.filter((event) => isValidDate(event.startAt)).sort((a, b) => (a.startAt > b.startAt ? 1 : -1));
};

export const getSlaMetrics = (): SlaMetrics => {
  const workItems = getWorkItems();
  const open = workItems.filter((item) => isOpenStatus(item.status));
  const overdue = open.filter((item) => {
    const sla = getWorkItemSlaStatus(item);
    return sla === 'overdue' || sla === 'breached';
  }).length;
  const breached = open.filter((item) => getWorkItemSlaStatus(item) === 'breached').length;
  const escalated = open.filter((item) => getWorkItemSlaStatus(item) === 'escalated').length;
  const dueIn7Days = open.filter((item) => {
    const hours = dueHours(item.dueDate);
    return Number.isFinite(hours) && hours >= 0 && hours <= 24 * 7;
  }).length;

  return {
    totalOpen: open.length,
    overdue,
    breached,
    escalated,
    dueIn7Days
  };
};

export const getSlaControlSummary = (): SlaControlSummary => {
  const contracts = getContracts();
  const workItems = getWorkItems();
  const executionPackages = getExecutionPackages();
  const now = new Date().getTime();

  const approvalSlaBreaches = workItems.filter((item) => item.source === 'Approval' && getWorkItemSlaStatus(item) === 'breached').length;

  const overdueObligations = contracts.reduce((sum, contract) => {
    return sum + contract.obligations.filter((obligation) => obligation.status !== 'done' && isValidDate(obligation.dueDate) && new Date(obligation.dueDate).getTime() < now).length;
  }, 0);

  const missedRenewalNotices = contracts.filter((contract) => contract.renewal.daysUntilNoticeDeadline < 0).length;

  const executionDelays = executionPackages.filter((pkg) => pkg.status !== 'executed' && pkg.sentAt && new Date(pkg.sentAt).getTime() < now - 1000 * 60 * 60 * 24 * 7).length;

  const escalatedWorkItems = workItems.filter((item) => item.status === 'escalated' || !!item.escalatedAt).length;

  return {
    approvalSlaBreaches,
    overdueObligations,
    missedRenewalNotices,
    executionDelays,
    escalatedWorkItems
  };
};
