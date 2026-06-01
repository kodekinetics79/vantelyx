import { type ReactNode, useMemo, useState } from 'react';
import {
  getAccessPolicies,
  getApprovalAuthorities,
  getCurrentUser,
  getRoles,
  getUsers,
  seedSecurityData,
  switchCurrentUser,
} from '../services/securityService';

export default function Admin() {
  const [refresh, setRefresh] = useState(0);

  useMemo(() => {
    seedSecurityData();
    return null;
  }, []);

  const currentUser = useMemo(() => getCurrentUser(), [refresh]);
  const users = useMemo(() => getUsers(), [refresh]);
  const roles = useMemo(() => getRoles(), [refresh]);
  const policies = useMemo(() => getAccessPolicies(), [refresh]);
  const authorities = useMemo(() => getApprovalAuthorities(), [refresh]);

  const switchUser = (userId: string) => {
    switchCurrentUser(userId);
    setRefresh((v) => v + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Admin & Security</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">RBAC and access policy control center</h2>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current Demo User</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            {currentUser.fullName} · {currentUser.department}
          </div>
          <select
            value={currentUser.id}
            onChange={(event) => switchUser(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total Users" value={String(users.length)} />
        <Metric label="Defined Roles" value={String(roles.length)} />
        <Metric label="Access Policies" value={String(policies.length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Users">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const role = roles.find((r) => r.id === user.roleId);
                  return (
                    <tr key={user.id}>
                      <td className="py-3 font-semibold text-slate-900">{user.fullName}</td>
                      <td className="py-3 text-slate-700">{user.department}</td>
                      <td className="py-3 text-slate-700">{role?.name ?? 'Unassigned'}</td>
                      <td className="py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${user.active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Roles and Permissions">
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="font-black text-slate-900">{role.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {role.permissions.map((permission) => (
                    <span key={`${role.id}_${permission}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Access Policy Summary">
          <div className="space-y-3">
            {policies.map((policy) => (
              <div key={policy.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="font-black text-slate-900">{policy.name}</p>
                <p className="mt-1 text-sm text-slate-700">{policy.summary}</p>
                <p className="mt-2 text-xs text-slate-500">Required: {policy.requiredPermissions.join(', ')}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Approval Authority Matrix">
          <div className="space-y-3">
            {authorities.map((auth) => {
              const role = roles.find((r) => r.id === auth.roleId);
              return (
                <div key={auth.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-black text-slate-900">{role?.name ?? auth.roleId}</p>
                  <p className="mt-1 text-sm text-slate-700">Max Value: ${auth.maxContractValue.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-700">High Risk Approval: {auth.canApproveHighRisk ? 'Yes' : 'No'}</p>
                  <p className="mt-1 text-xs text-slate-500">Departments: {auth.departments.join(', ')}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
