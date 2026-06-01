import { useMemo, useState } from 'react';
import {
  assignWorkItem,
  escalateWorkItem,
  getSlaMetrics,
  getWorkItems,
  getWorkItemSlaStatus,
  seedTaskData,
  updateWorkItemStatus
} from '../services/taskService';
import { getCurrentUser, hasPermission } from '../services/securityService';
import type { TaskPriority, TaskSource, WorkItem, WorkItemSlaStatus } from '../types/workflowOps';

type QueueTab = 'my_tasks' | 'team_tasks' | 'overdue' | 'due_week' | 'escalated' | 'completed';

const tabLabel: Record<QueueTab, string> = {
  my_tasks: 'My Tasks',
  team_tasks: 'Team Tasks',
  overdue: 'Overdue',
  due_week: 'Due This Week',
  escalated: 'Escalated',
  completed: 'Completed'
};

const priorityTone: Record<TaskPriority, string> = {
  low: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-brand-100 bg-brand-50 text-brand-700',
  high: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-red-200 bg-red-100 text-red-800'
};

const statusTone: Record<string, string> = {
  open: 'border-slate-200 bg-slate-50 text-slate-700',
  in_progress: 'border-brand-100 bg-brand-50 text-brand-700',
  waiting: 'border-blue-100 bg-blue-50 text-blue-700',
  completed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  snoozed: 'border-violet-100 bg-violet-50 text-violet-700',
  escalated: 'border-red-100 bg-red-50 text-red-700'
};

const slaTone: Record<WorkItemSlaStatus, string> = {
  on_track: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  due_soon: 'border-amber-100 bg-amber-50 text-amber-700',
  overdue: 'border-orange-100 bg-orange-50 text-orange-700',
  breached: 'border-red-100 bg-red-50 text-red-700',
  escalated: 'border-red-200 bg-red-100 text-red-800'
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const isCompletedLike = (status: string): boolean => status === 'completed' || status === 'cancelled';

export default function WorkQueue() {
  useMemo(() => {
    seedTaskData();
    return null;
  }, []);

  const [refresh, setRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState<QueueTab>('my_tasks');
  const [message, setMessage] = useState('');
  const [reassignTo, setReassignTo] = useState('Legal Reviewer');
  const [sourceFilter, setSourceFilter] = useState<'all' | TaskSource>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState<'all' | WorkItemSlaStatus>('all');

  const currentUser = getCurrentUser();
  const canManageTeamTasks = hasPermission('contracts.approve') || hasPermission('admin.manage_users');
  const isAuditor = !hasPermission('contracts.edit') && hasPermission('contracts.view_all') && !hasPermission('contracts.approve');

  const workItems = useMemo(() => getWorkItems(), [refresh]);
  const slaMetrics = useMemo(() => getSlaMetrics(), [refresh]);

  const assignees = useMemo(() => {
    const values = Array.from(new Set(workItems.map((item) => item.assignee || 'Unassigned')));
    return values.sort();
  }, [workItems]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return workItems.filter((item) => {
      const dueTime = new Date(item.dueDate).getTime();
      const itemSla = getWorkItemSlaStatus(item);

      const tabMatch =
        (activeTab === 'my_tasks' && (item.assignee || '').toLowerCase() === (currentUser.fullName || '').toLowerCase() && !isCompletedLike(item.status)) ||
        (activeTab === 'team_tasks' && (item.assignee || '').toLowerCase() !== (currentUser.fullName || '').toLowerCase() && !isCompletedLike(item.status)) ||
        (activeTab === 'overdue' && !isCompletedLike(item.status) && (itemSla === 'overdue' || itemSla === 'breached')) ||
        (activeTab === 'due_week' && !isCompletedLike(item.status) && Number.isFinite(dueTime) && dueTime >= now && dueTime <= now + 1000 * 60 * 60 * 24 * 7) ||
        (activeTab === 'escalated' && itemSla === 'escalated') ||
        (activeTab === 'completed' && isCompletedLike(item.status));

      if (!tabMatch) return false;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'all' && (item.assignee || 'Unassigned') !== assigneeFilter) return false;
      if (slaFilter !== 'all' && itemSla !== slaFilter) return false;
      return true;
    });
  }, [activeTab, assigneeFilter, currentUser.fullName, priorityFilter, slaFilter, sourceFilter, workItems]);

  const canMutateTask = (item: WorkItem): boolean => {
    if (isAuditor) return false;
    const mine = (item.assignee || '').toLowerCase() === (currentUser.fullName || '').toLowerCase();
    return mine || canManageTeamTasks;
  };

  const mutate = (result: WorkItem | undefined, successMessage: string) => {
    if (!result) {
      setMessage('Action could not be completed.');
      return;
    }
    setMessage(successMessage);
    setRefresh((value) => value + 1);
  };

  const guard = (item: WorkItem, action: () => void) => {
    if (!canMutateTask(item)) {
      setMessage('Your current role does not have permission to perform this action.');
      return;
    }
    action();
  };

  const emptyMessage =
    activeTab === 'overdue'
      ? 'No overdue tasks. SLA timelines are currently under control.'
      : activeTab === 'escalated'
      ? 'No escalated tasks. No current escalation actions required.'
      : activeTab === 'completed'
      ? 'No completed tasks yet. Complete active work items to build your audit trail.'
      : 'No tasks matched your current filters. Try broadening source, assignee, or SLA filters.';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Workflow Operations</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Enterprise Work Queue / Task Inbox</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Open Tasks" value={String(slaMetrics.totalOpen)} />
        <SummaryCard label="Overdue Tasks" value={String(slaMetrics.overdue)} />
        <SummaryCard label="SLA Breaches" value={String(slaMetrics.breached)} />
        <SummaryCard label="Escalated Items" value={String(slaMetrics.escalated)} />
        <SummaryCard label="Due in 7 Days" value={String(slaMetrics.dueIn7Days)} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(tabLabel) as QueueTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {tabLabel[tab]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | TaskSource)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">By Source</option>
            <option value="AI Intake">AI Intake</option>
            <option value="Approval">Approval</option>
            <option value="Obligation">Obligation</option>
            <option value="Renewal">Renewal</option>
            <option value="Execution">Execution</option>
            <option value="Clause Review">Clause Review</option>
            <option value="Vendor Compliance">Vendor Compliance</option>
            <option value="Admin Review">Admin Review</option>
          </select>

          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'all' | TaskPriority)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">By Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">By Assignee</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>

          <select value={slaFilter} onChange={(event) => setSlaFilter(event.target.value as 'all' | WorkItemSlaStatus)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">By SLA Status</option>
            <option value="on_track">On Track</option>
            <option value="due_soon">Due Soon</option>
            <option value="overdue">Overdue</option>
            <option value="breached">Breached</option>
            <option value="escalated">Escalated</option>
          </select>

          <input value={reassignTo} onChange={(event) => setReassignTo(event.target.value)} placeholder="Reassign target" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1420px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Contract / Counterparty</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Escalation</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const itemSla = getWorkItemSlaStatus(item);
                const canMutate = canMutateTask(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.id}</p>
                    </td>
                    <td className="px-4 py-3">{item.source}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.contractTitle ?? item.contractId ?? 'N/A'}</p>
                      <p className="text-xs text-slate-500">{item.counterparty ?? 'N/A'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${priorityTone[item.priority]}`}>
                        {pretty(item.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDate(item.dueDate)}</td>
                    <td className="px-4 py-3">{item.assignee || 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone[item.status] || statusTone.open}`}>
                        {pretty(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${slaTone[itemSla]}`}>
                        {pretty(itemSla)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.escalatedAt ? 'Escalated' : 'Not Escalated'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button disabled={!canMutate} onClick={() => guard(item, () => mutate(updateWorkItemStatus(item.id, 'completed', 'Completed from Work Queue.'), 'Task marked complete.'))} className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Mark Complete</button>
                        <button disabled={!canMutate} onClick={() => guard(item, () => mutate(updateWorkItemStatus(item.id, 'in_progress', 'Started progress from Work Queue.'), 'Task moved to in progress.'))} className="rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Start Progress</button>
                        <button disabled={!canManageTeamTasks || isAuditor} onClick={() => guard(item, () => mutate(assignWorkItem(item.id, reassignTo), `Task reassigned to ${reassignTo}.`))} className="rounded-xl bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Reassign</button>
                        <button disabled={!canManageTeamTasks || isAuditor} onClick={() => guard(item, () => mutate(escalateWorkItem(item.id, 'Manual escalation from Work Queue.'), 'Task escalated.'))} className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Escalate</button>
                        <button disabled={!canMutate} onClick={() => guard(item, () => mutate(updateWorkItemStatus(item.id, 'snoozed', 'Snoozed from Work Queue.'), 'Task snoozed.'))} className="rounded-xl bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Snooze</button>
                        <button disabled={!canManageTeamTasks || isAuditor} onClick={() => guard(item, () => mutate(updateWorkItemStatus(item.id, 'cancelled', 'Cancelled from Work Queue.'), 'Task cancelled.'))} className="rounded-xl bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">Cancel</button>
                        <button
                          onClick={() => {
                            if (item.contractId) {
                              window.localStorage.setItem('vantelyx_selected_contract_id', item.contractId);
                            }
                            window.location.hash = '#workspace';
                          }}
                          className="rounded-xl bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white"
                        >
                          Open Contract
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
