using Vantelyx.Api.Models;

namespace Vantelyx.Api.Data;

public sealed class InMemoryStore
{
    private int _sequence = 4;

    public List<ContractDto> Contracts { get; } = new();
    public List<DepartmentDto> Departments { get; } = new();
    public List<PermissionDto> Permissions { get; } = new();
    public List<RoleDto> Roles { get; } = new();
    public List<UserDto> Users { get; } = new();
    public List<AccessPolicyDto> AccessPolicies { get; } = new();
    public List<DelegationDto> Delegations { get; } = new();
    public List<ApprovalAuthorityDto> ApprovalAuthorities { get; } = new();
    public string CurrentUserId { get; set; } = "usr_admin";

    public InMemoryStore()
    {
        var now = DateTime.UtcNow;

        Departments.AddRange(new[]
        {
            new DepartmentDto { Id = "dept_legal", Name = "Legal" },
            new DepartmentDto { Id = "dept_technology", Name = "Technology" },
            new DepartmentDto { Id = "dept_finance", Name = "Finance" },
            new DepartmentDto { Id = "dept_sales", Name = "Sales" },
            new DepartmentDto { Id = "dept_procurement", Name = "Procurement" },
            new DepartmentDto { Id = "dept_executive", Name = "Executive" },
            new DepartmentDto { Id = "dept_compliance", Name = "Compliance" },
        });

        Permissions.AddRange(new[]
        {
            new PermissionDto { Id = "contracts.create", Name = "contracts.create", Description = "Create contracts from intake." },
            new PermissionDto { Id = "contracts.view_all", Name = "contracts.view_all", Description = "View all contracts across departments." },
            new PermissionDto { Id = "contracts.view_department", Name = "contracts.view_department", Description = "View contracts in assigned department." },
            new PermissionDto { Id = "contracts.edit", Name = "contracts.edit", Description = "Edit contract records." },
            new PermissionDto { Id = "contracts.delete", Name = "contracts.delete", Description = "Delete contract records." },
            new PermissionDto { Id = "contracts.submit_review", Name = "contracts.submit_review", Description = "Submit contracts for review." },
            new PermissionDto { Id = "contracts.approve", Name = "contracts.approve", Description = "Approve contracts in workflow." },
            new PermissionDto { Id = "contracts.execute", Name = "contracts.execute", Description = "Mark contracts as executed." },
            new PermissionDto { Id = "obligations.manage", Name = "obligations.manage", Description = "Manage obligations and completion state." },
            new PermissionDto { Id = "renewals.manage", Name = "renewals.manage", Description = "Manage renewal actions." },
            new PermissionDto { Id = "vendors.manage", Name = "vendors.manage", Description = "Manage counterparty records." },
            new PermissionDto { Id = "reports.export", Name = "reports.export", Description = "Export analytics and audit CSV data." },
            new PermissionDto { Id = "admin.manage_users", Name = "admin.manage_users", Description = "Manage users." },
            new PermissionDto { Id = "admin.manage_roles", Name = "admin.manage_roles", Description = "Manage roles and assignments." },
            new PermissionDto { Id = "admin.manage_policies", Name = "admin.manage_policies", Description = "Manage access policies." },
        });

        Roles.AddRange(new[]
        {
            new RoleDto { Id = "role_system_admin", Name = "System Admin", PermissionIds = Permissions.Select(p => p.Id).ToList() },
            new RoleDto { Id = "role_legal_admin", Name = "Legal Admin", PermissionIds = new() { "contracts.create", "contracts.view_all", "contracts.edit", "contracts.submit_review", "contracts.approve", "contracts.execute", "obligations.manage", "renewals.manage", "vendors.manage", "reports.export", "admin.manage_policies" } },
            new RoleDto { Id = "role_contract_manager", Name = "Contract Manager", PermissionIds = new() { "contracts.create", "contracts.view_all", "contracts.edit", "contracts.submit_review", "contracts.approve", "obligations.manage", "renewals.manage", "reports.export" } },
            new RoleDto { Id = "role_business_requester", Name = "Business Requester", PermissionIds = new() { "contracts.create", "contracts.view_department", "contracts.submit_review" } },
            new RoleDto { Id = "role_department_approver", Name = "Department Approver", PermissionIds = new() { "contracts.view_department", "contracts.approve" } },
            new RoleDto { Id = "role_finance_reviewer", Name = "Finance Reviewer", PermissionIds = new() { "contracts.view_all", "contracts.approve", "reports.export" } },
            new RoleDto { Id = "role_procurement_reviewer", Name = "Procurement Reviewer", PermissionIds = new() { "contracts.view_all", "contracts.approve", "vendors.manage", "renewals.manage" } },
            new RoleDto { Id = "role_executive_approver", Name = "Executive Approver", PermissionIds = new() { "contracts.view_all", "contracts.approve", "contracts.execute", "reports.export" } },
            new RoleDto { Id = "role_read_only_auditor", Name = "Read Only Auditor", PermissionIds = new() { "contracts.view_all", "reports.export" } },
        });

        Users.AddRange(new[]
        {
            new UserDto { Id = "usr_admin", FullName = "Alex Rivera", Email = "alex.rivera@vantelyx.com", DepartmentId = "dept_legal", DepartmentName = "Legal", RoleId = "role_system_admin", RoleName = "System Admin", Active = true },
            new UserDto { Id = "usr_legal", FullName = "Nina Patel", Email = "nina.patel@vantelyx.com", DepartmentId = "dept_legal", DepartmentName = "Legal", RoleId = "role_legal_admin", RoleName = "Legal Admin", Active = true },
            new UserDto { Id = "usr_mgr", FullName = "Avery Morgan", Email = "avery.morgan@vantelyx.com", DepartmentId = "dept_technology", DepartmentName = "Technology", RoleId = "role_contract_manager", RoleName = "Contract Manager", Active = true },
            new UserDto { Id = "usr_req", FullName = "Jordan Patel", Email = "jordan.patel@vantelyx.com", DepartmentId = "dept_sales", DepartmentName = "Sales", RoleId = "role_business_requester", RoleName = "Business Requester", Active = true },
            new UserDto { Id = "usr_fin", FullName = "Chris Lin", Email = "chris.lin@vantelyx.com", DepartmentId = "dept_finance", DepartmentName = "Finance", RoleId = "role_finance_reviewer", RoleName = "Finance Reviewer", Active = true },
            new UserDto { Id = "usr_exec", FullName = "Maya Chen", Email = "maya.chen@vantelyx.com", DepartmentId = "dept_executive", DepartmentName = "Executive", RoleId = "role_executive_approver", RoleName = "Executive Approver", Active = true },
            new UserDto { Id = "usr_audit", FullName = "Taylor Grant", Email = "taylor.grant@vantelyx.com", DepartmentId = "dept_compliance", DepartmentName = "Compliance", RoleId = "role_read_only_auditor", RoleName = "Read Only Auditor", Active = true },
        });

        AccessPolicies.AddRange(new[]
        {
            new AccessPolicyDto { Id = "pol_department_scope", Name = "Department Scope", Summary = "Department-scoped visibility for non-global viewers.", RequiredPermissionIds = new() { "contracts.view_department" } },
            new AccessPolicyDto { Id = "pol_approval_authority", Name = "Approval Authority", Summary = "Approval requires permission and value/risk authority.", RequiredPermissionIds = new() { "contracts.approve" } },
            new AccessPolicyDto { Id = "pol_admin_controls", Name = "Admin Controls", Summary = "Admin permissions govern user/role/policy management.", RequiredPermissionIds = new() { "admin.manage_users", "admin.manage_roles", "admin.manage_policies" } },
        });

        ApprovalAuthorities.AddRange(new[]
        {
            new ApprovalAuthorityDto { Id = "auth_legal_admin", RoleId = "role_legal_admin", MaxContractValue = 2000000m, CanApproveHighRisk = true, DepartmentIds = new() { "dept_legal", "dept_technology" } },
            new ApprovalAuthorityDto { Id = "auth_manager", RoleId = "role_contract_manager", MaxContractValue = 500000m, CanApproveHighRisk = false, DepartmentIds = new() { "dept_technology", "dept_procurement" } },
            new ApprovalAuthorityDto { Id = "auth_exec", RoleId = "role_executive_approver", MaxContractValue = 10000000m, CanApproveHighRisk = true, DepartmentIds = new() { "dept_executive", "dept_finance", "dept_legal" } },
        });

        // TODO(Security): Replace demo in-memory identities with Microsoft Entra ID / Azure AD SSO claims.
        // TODO(Security): Add SAML/OIDC federation support for external enterprise identity providers.
        // TODO(Security): Add SCIM user and group provisioning flow for automated lifecycle management.
        // TODO(Security): Enforce tenant isolation (single-tenant and multi-tenant boundary controls).
        // TODO(Security): Add row-level contract visibility enforcement tied to policy engine decisions.
        // TODO(Security): Emit immutable, audit-grade access logging for all security-sensitive actions.

        Contracts.Add(new ContractDto
        {
            Id = "ct_demo_001",
            Request = new ContractRequestDto
            {
                RequesterName = "Avery Morgan",
                RequesterEmail = "avery.morgan@vantelyx.com",
                Title = "Cloud Hosting Renewal FY27",
                ContractType = "Vendor Agreement",
                CounterpartyName = "Northstar Cloud LLC",
                CounterpartyRegion = "US",
                EstimatedValue = 650000,
                Currency = "USD",
                StartDate = now.AddDays(-20).ToString("O"),
                TermMonths = 24,
                PaymentTerms = "Net 30",
                Jurisdiction = "Delaware",
                AutoRenew = true,
                Department = "Technology",
                Priority = "high",
                Notes = "Critical service provider for production workloads."
            },
            Counterparty = new CounterpartyDto
            {
                Id = "cp_demo_001",
                Name = "Northstar Cloud LLC",
                Type = "vendor",
                RiskRating = "high",
                TotalContractValue = 650000,
                ActiveContracts = 2,
                ExpiredContracts = 0,
                PendingContracts = 1,
                InsuranceStatus = "pending_review",
                ComplianceStatus = "compliant",
                SanctionsStatus = "pending_screening",
                DocumentCompleteness = "partial",
                RelationshipOwner = "Avery Morgan",
                Region = "US",
                Industry = "Technology",
                RiskLevel = "high",
                IsStrategic = true,
            },
            Status = "internal_review",
            CreatedAt = now.AddDays(-20).ToString("O"),
            UpdatedAt = now.AddDays(-1).ToString("O"),
            RiskScore = 76,
            RiskSignals = new()
            {
                new RiskSignalDto { Name = "High Contract Value", ScoreImpact = 20, Level = "high", Reason = "Contract value exceeds high-risk threshold." }
            },
            ClauseSignals = new()
            {
                new ClauseSignalDto { Clause = "Confidentiality", Status = "present", Severity = "low", Message = "Standard confidentiality language detected." },
                new ClauseSignalDto { Clause = "Governing Law", Status = "present", Severity = "low", Message = "Delaware governing law identified." },
                new ClauseSignalDto { Clause = "Payment Terms", Status = "present", Severity = "low", Message = "Net 30 terms extracted." },
            },
            ClauseReviews = new(),
            Approvals = new()
            {
                new ApprovalStepDto { Id = "appr_001", Role = "legal", Approver = "Legal Reviewer", Decision = "pending" },
                new ApprovalStepDto { Id = "appr_002", Role = "finance", Approver = "Finance Controller", Decision = "pending" },
            },
            Obligations = new()
            {
                new ObligationDto { Id = "obl_001", Title = "Confirm insurance certificates", Owner = "Procurement", DueDate = now.AddDays(14).ToString("O"), Status = "open", Priority = "high" },
                new ObligationDto { Id = "obl_002", Title = "Validate billing schedule", Owner = "Finance", DueDate = now.AddDays(21).ToString("O"), Status = "open", Priority = "medium" }
            },
            Renewal = new RenewalDto
            {
                AutoRenew = true,
                RenewalDate = now.AddMonths(12).ToString("O"),
                NoticeDeadline = now.AddMonths(9).ToString("O"),
                DaysUntilNoticeDeadline = 270,
                RenewalOwner = "Avery Morgan",
                RecommendedAction = "Validate notice intent before auto-renew trigger.",
                RenewalRisk = "high",
                CommercialImpact = "High commercial exposure due to contract value.",
                VendorPerformanceNote = "Performance tracking required before renewal decision.",
                Status = "on_track",
                ActionHistory = new(),
            },
            DocumentIntelligence = new DocumentIntelligenceDto
            {
                DocumentName = "Cloud Hosting Renewal FY27.pdf",
                DocumentType = "Vendor Agreement",
                ExtractedParties = new() { "Vantelyx, Inc.", "Northstar Cloud LLC" },
                EffectiveDate = now.AddDays(-20).ToString("O"),
                ExpirationDate = now.AddMonths(24).ToString("O"),
                GoverningLaw = "Delaware",
                PaymentTerms = "Net 30",
                TerminationRights = "Termination for cause with 30-day cure period.",
                Confidentiality = "present",
                Indemnity = "present",
                LimitationOfLiability = "needs_review",
                AutoRenewLanguage = "Auto-renewal clause detected.",
                AssignmentRestriction = "Assignment restricted without consent.",
                InsuranceRequirement = "General liability and cyber coverage required.",
                AuditRights = "Audit rights included for security compliance.",
                Confidence = new Dictionary<string, decimal> { ["documentName"] = 0.96m, ["governingLaw"] = 0.89m },
                HumanReviewNeeded = true,
                HumanReviewReasons = new() { "High contract risk score", "Liability language needs review" },
            },
            Activity = new()
            {
                new ActivityLogDto
                {
                    Id = "act_001",
                    Timestamp = now.AddDays(-20).ToString("O"),
                    Actor = "AI Intake Engine",
                    Event = "created",
                    Message = "Contract created from intake with simulated AI extraction.",
                    Action = "Intake Created",
                    PreviousStatus = "intake",
                    NewStatus = "drafting",
                    Source = "AI Intake",
                    Labels = new() { "system generated", "review required" },
                    Note = "Initial extraction completed."
                }
            }
        });
    }

    public string NextContractId() => $"ct_{++_sequence:000000}";
}
