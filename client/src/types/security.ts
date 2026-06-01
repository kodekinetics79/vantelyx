import type { Contract } from './clm';

export type Permission =
  | 'contracts.create'
  | 'contracts.view_all'
  | 'contracts.view_department'
  | 'contracts.edit'
  | 'contracts.delete'
  | 'contracts.submit_review'
  | 'contracts.approve'
  | 'contracts.execute'
  | 'obligations.manage'
  | 'renewals.manage'
  | 'vendors.manage'
  | 'reports.export'
  | 'admin.manage_users'
  | 'admin.manage_roles'
  | 'admin.manage_policies';

export type Department =
  | 'Legal'
  | 'Finance'
  | 'Procurement'
  | 'Sales'
  | 'Technology'
  | 'Operations'
  | 'Executive'
  | 'Compliance'
  | 'Public Sector'
  | 'General';

export type Role = {
  id: string;
  name:
    | 'System Admin'
    | 'Legal Admin'
    | 'Contract Manager'
    | 'Business Requester'
    | 'Department Approver'
    | 'Finance Reviewer'
    | 'Procurement Reviewer'
    | 'Executive Approver'
    | 'Read Only Auditor';
  permissions: Permission[];
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  department: Department;
  roleId: string;
  active: boolean;
};

export type AccessPolicy = {
  id: string;
  name: string;
  summary: string;
  requiredPermissions: Permission[];
};

export type Delegation = {
  id: string;
  fromUserId: string;
  toUserId: string;
  scope: Permission[];
  startDate: string;
  endDate: string;
  active: boolean;
};

export type ApprovalAuthority = {
  id: string;
  roleId: string;
  maxContractValue: number;
  canApproveHighRisk: boolean;
  departments: Department[];
};

export type SecuritySeed = {
  users: User[];
  roles: Role[];
  policies: AccessPolicy[];
  delegations: Delegation[];
  approvalAuthorities: ApprovalAuthority[];
  currentUserId: string;
};

export type ContractGuard = {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  contract: Contract;
};
