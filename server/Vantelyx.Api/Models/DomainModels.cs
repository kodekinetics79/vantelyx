namespace Vantelyx.Api.Models;

public record ApiResponse(bool Success, object? Data, string Message, IReadOnlyList<string> Errors)
{
    public static ApiResponse Ok(object? data, string message = "OK") => new(true, data, message, Array.Empty<string>());
    public static ApiResponse Fail(string error) => new(false, null, "Request failed", new[] { error });
}

public sealed class ContractDto
{
    public required string Id { get; init; }
    public required ContractRequestDto Request { get; set; }
    public required CounterpartyDto Counterparty { get; set; }
    public required string Status { get; set; }
    public required string CreatedAt { get; set; }
    public required string UpdatedAt { get; set; }
    public int RiskScore { get; set; }
    public List<RiskSignalDto> RiskSignals { get; set; } = new();
    public List<ClauseSignalDto> ClauseSignals { get; set; } = new();
    public List<ClauseReviewItemDto> ClauseReviews { get; set; } = new();
    public List<ObligationDto> Obligations { get; set; } = new();
    public List<ApprovalStepDto> Approvals { get; set; } = new();
    public required RenewalDto Renewal { get; set; }
    public DocumentIntelligenceDto? DocumentIntelligence { get; set; }
    public List<ActivityLogDto> Activity { get; set; } = new();
}

public sealed class ContractRequestDto
{
    public required string RequesterName { get; set; }
    public required string RequesterEmail { get; set; }
    public required string Title { get; set; }
    public required string ContractType { get; set; }
    public required string CounterpartyName { get; set; }
    public required string CounterpartyRegion { get; set; }
    public decimal EstimatedValue { get; set; }
    public required string Currency { get; set; }
    public required string StartDate { get; set; }
    public int TermMonths { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Jurisdiction { get; set; }
    public bool? AutoRenew { get; set; }
    public string? Department { get; set; }
    public string? Priority { get; set; }
    public List<string>? Tags { get; set; }
    public Dictionary<string, string>? Metadata { get; set; }
    public string? Notes { get; set; }
}

public sealed class CounterpartyDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; }
    public required string RiskRating { get; set; }
    public decimal TotalContractValue { get; set; }
    public int ActiveContracts { get; set; }
    public int ExpiredContracts { get; set; }
    public int PendingContracts { get; set; }
    public required string InsuranceStatus { get; set; }
    public required string ComplianceStatus { get; set; }
    public required string SanctionsStatus { get; set; }
    public required string DocumentCompleteness { get; set; }
    public required string RelationshipOwner { get; set; }
    public required string Region { get; set; }
    public required string Industry { get; set; }
    public required string RiskLevel { get; set; }
    public bool IsStrategic { get; set; }
}

public sealed class ApprovalStepDto
{
    public required string Id { get; set; }
    public required string Role { get; set; }
    public required string Approver { get; set; }
    public required string Decision { get; set; }
    public string? UpdatedAt { get; set; }
    public string? Note { get; set; }
}

public sealed class ObligationDto
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public required string Owner { get; set; }
    public required string DueDate { get; set; }
    public required string Status { get; set; }
    public required string Priority { get; set; }
    public string? Note { get; set; }
}

public sealed class RenewalActionHistoryDto
{
    public required string Id { get; set; }
    public required string Action { get; set; }
    public required string Note { get; set; }
    public required string Actor { get; set; }
    public required string Timestamp { get; set; }
}

public sealed class RenewalDto
{
    public bool AutoRenew { get; set; }
    public required string RenewalDate { get; set; }
    public required string NoticeDeadline { get; set; }
    public int DaysUntilNoticeDeadline { get; set; }
    public required string RenewalOwner { get; set; }
    public required string RecommendedAction { get; set; }
    public required string RenewalRisk { get; set; }
    public required string CommercialImpact { get; set; }
    public required string VendorPerformanceNote { get; set; }
    public string? NoticeSentAt { get; set; }
    public List<RenewalActionHistoryDto> ActionHistory { get; set; } = new();
    public required string Status { get; set; }
}

public sealed class RiskSignalDto
{
    public required string Name { get; set; }
    public int ScoreImpact { get; set; }
    public required string Level { get; set; }
    public required string Reason { get; set; }
}

public sealed class ClauseSignalDto
{
    public required string Clause { get; set; }
    public required string Status { get; set; }
    public required string Severity { get; set; }
    public required string Message { get; set; }
}

public sealed class ClauseReviewItemDto
{
    public required string Id { get; set; }
    public required string Clause { get; set; }
    public required string Status { get; set; }
    public required string PlaybookLabel { get; set; }
    public required string AiRiskNote { get; set; }
    public required string RecommendedFallbackLanguage { get; set; }
    public required string BusinessImpact { get; set; }
    public bool LegalReviewRequired { get; set; }
    public string? LastAction { get; set; }
    public string? LastActionAt { get; set; }
}

public sealed class ActivityLogDto
{
    public required string Id { get; set; }
    public required string Timestamp { get; set; }
    public required string Actor { get; set; }
    public required string Event { get; set; }
    public required string Message { get; set; }
    public string? Action { get; set; }
    public string? PreviousStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? Note { get; set; }
    public string? Source { get; set; }
    public List<string>? Labels { get; set; }
}

public sealed class DocumentIntelligenceDto
{
    public required string DocumentName { get; set; }
    public required string DocumentType { get; set; }
    public List<string> ExtractedParties { get; set; } = new();
    public required string EffectiveDate { get; set; }
    public required string ExpirationDate { get; set; }
    public required string GoverningLaw { get; set; }
    public required string PaymentTerms { get; set; }
    public required string TerminationRights { get; set; }
    public required string Confidentiality { get; set; }
    public required string Indemnity { get; set; }
    public required string LimitationOfLiability { get; set; }
    public required string AutoRenewLanguage { get; set; }
    public required string AssignmentRestriction { get; set; }
    public required string InsuranceRequirement { get; set; }
    public required string AuditRights { get; set; }
    public Dictionary<string, decimal> Confidence { get; set; } = new();
    public bool HumanReviewNeeded { get; set; }
    public List<string> HumanReviewReasons { get; set; } = new();
}

public sealed class StatusUpdateRequest
{
    public required string Status { get; set; }
    public string? Note { get; set; }
    public string? Actor { get; set; }
}

public sealed class ApprovalUpdateRequest
{
    public required string Decision { get; set; }
    public string? Note { get; set; }
    public string? Actor { get; set; }
}

public sealed class ObligationUpdateRequest
{
    public required string Status { get; set; }
    public string? Actor { get; set; }
}

public sealed class AddActivityRequest
{
    public required string Actor { get; set; }
    public required string Event { get; set; }
    public required string Message { get; set; }
    public string? Action { get; set; }
    public string? PreviousStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? Note { get; set; }
    public string? Source { get; set; }
    public List<string>? Labels { get; set; }
}

public sealed class DashboardMetricsDto
{
    public int TotalContracts { get; set; }
    public Dictionary<string, int> ByStatus { get; set; } = new();
    public int HighRiskContracts { get; set; }
    public int PendingApprovals { get; set; }
    public int OverdueObligations { get; set; }
    public int RenewalsNext90Days { get; set; }
    public int MissingClauseCount { get; set; }
    public decimal AverageRiskScore { get; set; }
}

public sealed class UserDto
{
    public required string Id { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string DepartmentId { get; set; }
    public required string DepartmentName { get; set; }
    public required string RoleId { get; set; }
    public required string RoleName { get; set; }
    public bool Active { get; set; }
}

public sealed class RoleDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public List<string> PermissionIds { get; set; } = new();
}

public sealed class PermissionDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
}

public sealed class DepartmentDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
}

public sealed class AccessPolicyDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Summary { get; set; }
    public List<string> RequiredPermissionIds { get; set; } = new();
}

public sealed class DelegationDto
{
    public required string Id { get; set; }
    public required string FromUserId { get; set; }
    public required string ToUserId { get; set; }
    public required string StartsAtUtc { get; set; }
    public required string EndsAtUtc { get; set; }
    public required string Status { get; set; }
}

public sealed class ApprovalAuthorityDto
{
    public required string Id { get; set; }
    public required string RoleId { get; set; }
    public decimal MaxContractValue { get; set; }
    public bool CanApproveHighRisk { get; set; }
    public List<string> DepartmentIds { get; set; } = new();
}

public sealed class SecuritySwitchUserRequest
{
    public required string UserId { get; set; }
}
