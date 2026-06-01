import type { Contract } from '../types/clm';
import type {
  AccessPolicy,
  ApprovalAuthority,
  Delegation,
  Department,
  Permission,
  Role,
  SecuritySeed,
  User,
} from '../types/security';

const USERS_KEY = 'vantelyx_security_users';
const ROLES_KEY = 'vantelyx_security_roles';
const POLICIES_KEY = 'vantelyx_security_policies';
const DELEGATIONS_KEY = 'vantelyx_security_delegations';
const AUTHORITIES_KEY = 'vantelyx_security_authorities';
const CURRENT_USER_KEY = 'vantelyx_security_current_user';

const hasStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

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

const rolePermissions = (name: Role['name']): Permission[] => {
  switch (name) {
    case 'System Admin':
      return [
        'contracts.create','contracts.view_all','contracts.view_department','contracts.edit','contracts.delete','contracts.submit_review','contracts.approve','contracts.execute','obligations.manage','renewals.manage','vendors.manage','reports.export','admin.manage_users','admin.manage_roles','admin.manage_policies'
      ];
    case 'Legal Admin':
      return ['contracts.create','contracts.view_all','contracts.edit','contracts.submit_review','contracts.approve','contracts.execute','obligations.manage','renewals.manage','vendors.manage','reports.export','admin.manage_policies'];
    case 'Contract Manager':
      return ['contracts.create','contracts.view_all','contracts.edit','contracts.submit_review','contracts.approve','obligations.manage','renewals.manage','reports.export'];
    case 'Business Requester':
      return ['contracts.create','contracts.view_department','contracts.submit_review'];
    case 'Department Approver':
      return ['contracts.view_department','contracts.approve'];
    case 'Finance Reviewer':
      return ['contracts.view_all','contracts.approve','reports.export'];
    case 'Procurement Reviewer':
      return ['contracts.view_all','contracts.approve','vendors.manage','renewals.manage'];
    case 'Executive Approver':
      return ['contracts.view_all','contracts.approve','contracts.execute','reports.export'];
    case 'Read Only Auditor':
      return ['contracts.view_all','reports.export'];
    default:
      return [];
  }
};

const defaultSeed = (): SecuritySeed => {
  const roleNames: Role['name'][] = [
    'System Admin',
    'Legal Admin',
    'Contract Manager',
    'Business Requester',
    'Department Approver',
    'Finance Reviewer',
    'Procurement Reviewer',
    'Executive Approver',
    'Read Only Auditor',
  ];

  const roles: Role[] = roleNames.map((name) => ({
    id: `role_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    permissions: rolePermissions(name),
  }));

  const users: User[] = [
    { id: 'usr_admin', fullName: 'Alex Rivera', email: 'alex.rivera@vantelyx.com', department: 'Legal', roleId: 'role_system_admin', active: true },
    { id: 'usr_legal', fullName: 'Nina Patel', email: 'nina.patel@vantelyx.com', department: 'Legal', roleId: 'role_legal_admin', active: true },
    { id: 'usr_mgr', fullName: 'Avery Morgan', email: 'avery.morgan@vantelyx.com', department: 'Technology', roleId: 'role_contract_manager', active: true },
    { id: 'usr_req', fullName: 'Jordan Patel', email: 'jordan.patel@vantelyx.com', department: 'Sales', roleId: 'role_business_requester', active: true },
    { id: 'usr_fin', fullName: 'Chris Lin', email: 'chris.lin@vantelyx.com', department: 'Finance', roleId: 'role_finance_reviewer', active: true },
    { id: 'usr_exec', fullName: 'Maya Chen', email: 'maya.chen@vantelyx.com', department: 'Executive', roleId: 'role_executive_approver', active: true },
    { id: 'usr_audit', fullName: 'Taylor Grant', email: 'taylor.grant@vantelyx.com', department: 'Compliance', roleId: 'role_read_only_auditor', active: true },
  ];

  const policies: AccessPolicy[] = [
    { id: 'pol_department_scope', name: 'Department Scope', summary: 'Requesters can only view department contracts.', requiredPermissions: ['contracts.view_department'] },
    { id: 'pol_approval_authority', name: 'Approval Authority', summary: 'Approvals require contracts.approve and value authority.', requiredPermissions: ['contracts.approve'] },
    { id: 'pol_admin_controls', name: 'Admin Controls', summary: 'Only admin roles can modify users, roles, and policies.', requiredPermissions: ['admin.manage_users','admin.manage_roles','admin.manage_policies'] },
  ];

  const delegations: Delegation[] = [];

  const approvalAuthorities: ApprovalAuthority[] = [
    { id: 'auth_legal_admin', roleId: 'role_legal_admin', maxContractValue: 2000000, canApproveHighRisk: true, departments: ['General','Legal','Technology'] },
    { id: 'auth_manager', roleId: 'role_contract_manager', maxContractValue: 500000, canApproveHighRisk: false, departments: ['General','Technology','Operations'] },
    { id: 'auth_exec', roleId: 'role_executive_approver', maxContractValue: 10000000, canApproveHighRisk: true, departments: ['Executive','Finance','Legal','General'] },
  ];

  return {
    users,
    roles,
    policies,
    delegations,
    approvalAuthorities,
    currentUserId: 'usr_admin',
  };
};

export const seedSecurityData = (): SecuritySeed => {
  const seeded = defaultSeed();
  const users = read<User[]>(USERS_KEY, []);
  if (users.length > 0) {
    return {
      users,
      roles: read<Role[]>(ROLES_KEY, []),
      policies: read<AccessPolicy[]>(POLICIES_KEY, []),
      delegations: read<Delegation[]>(DELEGATIONS_KEY, []),
      approvalAuthorities: read<ApprovalAuthority[]>(AUTHORITIES_KEY, []),
      currentUserId: read<string>(CURRENT_USER_KEY, users[0]?.id ?? seeded.currentUserId),
    };
  }

  write(USERS_KEY, seeded.users);
  write(ROLES_KEY, seeded.roles);
  write(POLICIES_KEY, seeded.policies);
  write(DELEGATIONS_KEY, seeded.delegations);
  write(AUTHORITIES_KEY, seeded.approvalAuthorities);
  write(CURRENT_USER_KEY, seeded.currentUserId);
  return seeded;
};

export const getUsers = (): User[] => seedSecurityData().users;
export const getRoles = (): Role[] => seedSecurityData().roles;
export const getAccessPolicies = (): AccessPolicy[] => seedSecurityData().policies;
export const getApprovalAuthorities = (): ApprovalAuthority[] => seedSecurityData().approvalAuthorities;

export const getCurrentUser = (): User => {
  const seed = seedSecurityData();
  const currentId = read<string>(CURRENT_USER_KEY, seed.currentUserId);
  return seed.users.find((u) => u.id === currentId) ?? seed.users[0];
};

export const switchCurrentUser = (userId: string): User => {
  const seed = seedSecurityData();
  const target = seed.users.find((u) => u.id === userId) ?? seed.users[0];
  write(CURRENT_USER_KEY, target.id);
  return target;
};

const getCurrentRole = (): Role => {
  const seed = seedSecurityData();
  const user = getCurrentUser();
  return seed.roles.find((role) => role.id === user.roleId) ?? seed.roles[0];
};

export const hasPermission = (permission: Permission): boolean => getCurrentRole().permissions.includes(permission);

const getContractDepartment = (contract: Contract): Department => {
  const direct = contract.request.department;
  if (direct) return direct as Department;
  const parsed = contract.request.notes?.match(/Department:\s*([^\n]+)/i)?.[1]?.trim();
  return (parsed as Department) || 'General';
};

export const canViewContract = (contract: Contract): boolean => {
  if (hasPermission('contracts.view_all')) return true;
  if (!hasPermission('contracts.view_department')) return false;
  return getContractDepartment(contract) === getCurrentUser().department;
};

export const canApproveContract = (contract: Contract): boolean => {
  if (!hasPermission('contracts.approve')) return false;
  const role = getCurrentRole();
  const authority = getApprovalAuthorities().find((item) => item.roleId === role.id);
  if (!authority) return true;
  const department = getContractDepartment(contract);
  const inScope = authority.departments.includes('General') || authority.departments.includes(department);
  const riskOk = authority.canApproveHighRisk || contract.riskScore < 70;
  return inScope && contract.request.estimatedValue <= authority.maxContractValue && riskOk;
};

export const canEditContract = (contract: Contract): boolean => {
  if (hasPermission('contracts.edit')) return true;
  return hasPermission('contracts.create') && getCurrentUser().email === contract.request.requesterEmail;
};

export const getVisibleContracts = (contracts: Contract[]): Contract[] => contracts.filter((contract) => canViewContract(contract));

export const getContractAccessScopeLabel = (): 'All contracts' | 'Department contracts' | 'Assigned contracts' | 'Auditor view' => {
  const role = getCurrentRole();
  if (role.name === 'Read Only Auditor') {
    return 'Auditor view';
  }
  if (hasPermission('contracts.view_all')) {
    return 'All contracts';
  }
  if (hasPermission('contracts.view_department')) {
    return 'Department contracts';
  }
  return 'Assigned contracts';
};
