namespace Vantelyx.Api.Persistence;

// Relational entity model mirroring database/init.sql. Collection/dictionary fields that
// map to JSON columns in the schema (tags_json, metadata_json, labels_json, *_json) are
// stored as JSON strings here and (de)serialized by the mapper. Date fields are kept as
// ISO strings to round-trip the API's string-based DTO contract losslessly.
// TODO(Persistence): once date semantics are finalized, switch date columns to DateTime
//   and add EF migrations that reconcile column types with init.sql.

public sealed class CounterpartyEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string RiskRating { get; set; } = string.Empty;
    public decimal TotalContractValue { get; set; }
    public int ActiveContracts { get; set; }
    public int ExpiredContracts { get; set; }
    public int PendingContracts { get; set; }
    public string InsuranceStatus { get; set; } = string.Empty;
    public string ComplianceStatus { get; set; } = string.Empty;
    public string SanctionsStatus { get; set; } = string.Empty;
    public string DocumentCompleteness { get; set; } = string.Empty;
    public string RelationshipOwner { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string? Industry { get; set; }
    public string RiskLevel { get; set; } = string.Empty;
    public bool IsStrategic { get; set; }
}

public sealed class ContractEntity
{
    public string Id { get; set; } = string.Empty;
    public string CounterpartyId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public int RiskScore { get; set; }

    public string RequesterName { get; set; } = string.Empty;
    public string RequesterEmail { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string CounterpartyName { get; set; } = string.Empty;
    public string CounterpartyRegion { get; set; } = string.Empty;
    public decimal EstimatedValue { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public int TermMonths { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Jurisdiction { get; set; }
    public bool? AutoRenew { get; set; }
    public string? Department { get; set; }
    public string? Priority { get; set; }
    public string? TagsJson { get; set; }
    public string? MetadataJson { get; set; }
    public string? Notes { get; set; }

    // DTO collections without a dedicated table in init.sql: stored as JSON for now.
    public string? RiskSignalsJson { get; set; }
    public string? ClauseReviewsJson { get; set; }

    public CounterpartyEntity? Counterparty { get; set; }
    public List<ApprovalStepEntity> Approvals { get; set; } = new();
    public List<ObligationEntity> Obligations { get; set; } = new();
    public List<ClauseSignalEntity> ClauseSignals { get; set; } = new();
    public List<ActivityLogEntity> ActivityLogs { get; set; } = new();
    public List<RenewalActionHistoryEntity> RenewalHistory { get; set; } = new();
    public RenewalEntity? Renewal { get; set; }
    public DocumentIntelligenceEntity? DocumentIntelligence { get; set; }
}

public sealed class ApprovalStepEntity
{
    public string Id { get; set; } = string.Empty;
    public string ContractId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Approver { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? UpdatedAt { get; set; }
    public string? Note { get; set; }
}

public sealed class ObligationEntity
{
    public string Id { get; set; } = string.Empty;
    public string ContractId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string DueDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public sealed class RenewalEntity
{
    public string ContractId { get; set; } = string.Empty;
    public bool AutoRenew { get; set; }
    public string RenewalDate { get; set; } = string.Empty;
    public string NoticeDeadline { get; set; } = string.Empty;
    public int DaysUntilNoticeDeadline { get; set; }
    public string RenewalOwner { get; set; } = string.Empty;
    public string RecommendedAction { get; set; } = string.Empty;
    public string RenewalRisk { get; set; } = string.Empty;
    public string CommercialImpact { get; set; } = string.Empty;
    public string VendorPerformanceNote { get; set; } = string.Empty;
    public string? NoticeSentAt { get; set; }
    public string Status { get; set; } = string.Empty;
}

public sealed class RenewalActionHistoryEntity
{
    public string Id { get; set; } = string.Empty;
    public string ContractId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
}

public sealed class ActivityLogEntity
{
    public string Id { get; set; } = string.Empty;
    public string ContractId { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Event { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Action { get; set; }
    public string? PreviousStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? Note { get; set; }
    public string? Source { get; set; }
    public string? LabelsJson { get; set; }
}

public sealed class ClauseSignalEntity
{
    public long Id { get; set; }
    public string ContractId { get; set; } = string.Empty;
    public string Clause { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public sealed class DocumentIntelligenceEntity
{
    public string ContractId { get; set; } = string.Empty;
    public string DocumentName { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string ExtractedPartiesJson { get; set; } = "[]";
    public string EffectiveDate { get; set; } = string.Empty;
    public string ExpirationDate { get; set; } = string.Empty;
    public string GoverningLaw { get; set; } = string.Empty;
    public string PaymentTerms { get; set; } = string.Empty;
    public string TerminationRights { get; set; } = string.Empty;
    public string Confidentiality { get; set; } = string.Empty;
    public string Indemnity { get; set; } = string.Empty;
    public string LimitationOfLiability { get; set; } = string.Empty;
    public string AutoRenewLanguage { get; set; } = string.Empty;
    public string AssignmentRestriction { get; set; } = string.Empty;
    public string InsuranceRequirement { get; set; } = string.Empty;
    public string AuditRights { get; set; } = string.Empty;
    public bool HumanReviewNeeded { get; set; }
    public string HumanReviewReasonsJson { get; set; } = "[]";
    public List<DocumentIntelligenceFieldEntity> Fields { get; set; } = new();
}

public sealed class DocumentIntelligenceFieldEntity
{
    public long Id { get; set; }
    public string ContractId { get; set; } = string.Empty;
    public string FieldName { get; set; } = string.Empty;
    public string? FieldValue { get; set; }
    public decimal Confidence { get; set; }
}

// ── Identity / access-control ────────────────────────────────────────────────
public sealed class DepartmentEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public sealed class PermissionEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public sealed class RoleEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<RolePermissionEntity> RolePermissions { get; set; } = new();
}

public sealed class RolePermissionEntity
{
    public string RoleId { get; set; } = string.Empty;
    public string PermissionId { get; set; } = string.Empty;
}

public sealed class UserEntity
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DepartmentId { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public List<UserRoleEntity> UserRoles { get; set; } = new();
}

public sealed class UserRoleEntity
{
    public string UserId { get; set; } = string.Empty;
    public string RoleId { get; set; } = string.Empty;
}

public sealed class AccessPolicyEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string RequiredPermissionIdsJson { get; set; } = "[]";
}

public sealed class DelegationEntity
{
    public string Id { get; set; } = string.Empty;
    public string FromUserId { get; set; } = string.Empty;
    public string ToUserId { get; set; } = string.Empty;
    public string StartsAt { get; set; } = string.Empty;
    public string EndsAt { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public sealed class ApprovalAuthorityEntity
{
    public string Id { get; set; } = string.Empty;
    public string RoleId { get; set; } = string.Empty;
    public decimal MaxContractValue { get; set; }
    public bool CanApproveHighRisk { get; set; }
    public string DepartmentIdsJson { get; set; } = "[]";
}
