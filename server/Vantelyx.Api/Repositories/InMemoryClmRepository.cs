using Vantelyx.Api.Data;
using Vantelyx.Api.Models;

namespace Vantelyx.Api.Repositories;

public sealed class InMemoryClmRepository(InMemoryStore store) : IClmRepository
{
    // TODO(MySQL): replace in-memory reads/writes with EF Core + MySQL persistence.

    public IReadOnlyList<ContractDto> GetContracts() => store.Contracts.OrderByDescending(c => c.UpdatedAt).ToList();

    public ContractDto? GetContractById(string id) =>
        store.Contracts.FirstOrDefault(c => c.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

    public ContractDto CreateContract(ContractRequestDto request)
    {
        var now = DateTime.UtcNow;
        var contract = new ContractDto
        {
            Id = store.NextContractId(),
            Request = request,
            Counterparty = new CounterpartyDto
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = request.CounterpartyName,
                Type = request.ContractType == "Vendor Agreement" ? "vendor" : "partner",
                RiskRating = request.EstimatedValue > 500_000 ? "high" : "medium",
                TotalContractValue = request.EstimatedValue,
                ActiveContracts = 1,
                ExpiredContracts = 0,
                PendingContracts = 1,
                InsuranceStatus = "pending_review",
                ComplianceStatus = "pending_review",
                SanctionsStatus = "pending_screening",
                DocumentCompleteness = "partial",
                RelationshipOwner = request.RequesterName,
                Region = request.CounterpartyRegion,
                Industry = "General",
                RiskLevel = request.EstimatedValue > 500_000 ? "high" : "medium",
                IsStrategic = request.EstimatedValue > 300_000,
            },
            Status = "drafting",
            CreatedAt = now.ToString("O"),
            UpdatedAt = now.ToString("O"),
            RiskScore = request.EstimatedValue > 500_000 ? 72 : 45,
            RiskSignals = new(),
            ClauseSignals = new(),
            ClauseReviews = new(),
            Obligations = new(),
            Approvals = new()
            {
                new ApprovalStepDto { Id = Guid.NewGuid().ToString("N"), Role = "legal", Approver = "Legal Reviewer", Decision = "pending" }
            },
            Renewal = new RenewalDto
            {
                AutoRenew = request.AutoRenew ?? false,
                RenewalDate = DateTime.Parse(request.StartDate).AddMonths(Math.Max(request.TermMonths, 1)).ToString("O"),
                NoticeDeadline = DateTime.Parse(request.StartDate).AddMonths(Math.Max(request.TermMonths, 1) - 3).ToString("O"),
                DaysUntilNoticeDeadline = 90,
                RenewalOwner = request.RequesterName,
                RecommendedAction = "Start review before notice window.",
                RenewalRisk = request.EstimatedValue > 500_000 ? "high" : "medium",
                CommercialImpact = request.EstimatedValue > 500_000 ? "High value exposure." : "Moderate value exposure.",
                VendorPerformanceNote = "Track delivery outcomes before renewal.",
                Status = "on_track",
                ActionHistory = new(),
            },
            DocumentIntelligence = null,
            Activity = new()
            {
                new ActivityLogDto
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Timestamp = now.ToString("O"),
                    Actor = "AI Intake Engine",
                    Event = "created",
                    Message = "Contract created via API.",
                    Action = "Intake Created",
                    PreviousStatus = "intake",
                    NewStatus = "drafting",
                    Note = "Initial API intake record created.",
                    Source = "AI Intake",
                    Labels = new() { "system generated" },
                }
            }
        };

        store.Contracts.Add(contract);
        return contract;
    }

    public ContractDto? UpdateContractStatus(string id, StatusUpdateRequest request)
    {
        var contract = GetContractById(id);
        if (contract is null) return null;

        var previous = contract.Status;
        contract.Status = request.Status;
        contract.UpdatedAt = DateTime.UtcNow.ToString("O");
        contract.Activity.Insert(0, new ActivityLogDto
        {
            Id = Guid.NewGuid().ToString("N"),
            Timestamp = DateTime.UtcNow.ToString("O"),
            Actor = request.Actor ?? "Workflow Engine",
            Event = "status_changed",
            Message = $"Status changed to {request.Status}.",
            Action = "Status Update",
            PreviousStatus = previous,
            NewStatus = request.Status,
            Note = request.Note,
            Source = "Workflow",
            Labels = new() { "system generated" }
        });

        return contract;
    }

    public ContractDto? UpdateApprovalStep(string contractId, string stepId, ApprovalUpdateRequest request)
    {
        var contract = GetContractById(contractId);
        if (contract is null) return null;

        var step = contract.Approvals.FirstOrDefault(a => a.Id.Equals(stepId, StringComparison.OrdinalIgnoreCase));
        if (step is null) return null;

        var previous = step.Decision;
        step.Decision = request.Decision;
        step.Note = request.Note;
        step.UpdatedAt = DateTime.UtcNow.ToString("O");

        contract.UpdatedAt = DateTime.UtcNow.ToString("O");
        contract.Activity.Insert(0, new ActivityLogDto
        {
            Id = Guid.NewGuid().ToString("N"),
            Timestamp = DateTime.UtcNow.ToString("O"),
            Actor = request.Actor ?? "Workflow Engine",
            Event = "approval_updated",
            Message = $"Approval step {stepId} updated to {request.Decision}.",
            Action = "Approval Decision",
            PreviousStatus = previous,
            NewStatus = request.Decision,
            Note = request.Note,
            Source = "Workflow",
            Labels = new() { request.Decision == "approved" ? "completed" : "review required" }
        });

        return contract;
    }

    public ContractDto? UpdateObligationStatus(string contractId, string obligationId, ObligationUpdateRequest request)
    {
        var contract = GetContractById(contractId);
        if (contract is null) return null;

        var obligation = contract.Obligations.FirstOrDefault(o => o.Id.Equals(obligationId, StringComparison.OrdinalIgnoreCase));
        if (obligation is null) return null;

        var previous = obligation.Status;
        obligation.Status = request.Status;
        contract.UpdatedAt = DateTime.UtcNow.ToString("O");
        contract.Activity.Insert(0, new ActivityLogDto
        {
            Id = Guid.NewGuid().ToString("N"),
            Timestamp = DateTime.UtcNow.ToString("O"),
            Actor = request.Actor ?? "Workflow Engine",
            Event = "obligation_updated",
            Message = $"Obligation {obligationId} marked as {request.Status}.",
            Action = "Obligation Update",
            PreviousStatus = previous,
            NewStatus = request.Status,
            Source = "Obligation",
            Labels = new() { request.Status == "done" ? "completed" : "review required" }
        });

        return contract;
    }

    public ContractDto? AddActivity(string contractId, AddActivityRequest request)
    {
        var contract = GetContractById(contractId);
        if (contract is null) return null;

        contract.Activity.Insert(0, new ActivityLogDto
        {
            Id = Guid.NewGuid().ToString("N"),
            Timestamp = DateTime.UtcNow.ToString("O"),
            Actor = request.Actor,
            Event = request.Event,
            Message = request.Message,
            Action = request.Action,
            PreviousStatus = request.PreviousStatus,
            NewStatus = request.NewStatus,
            Note = request.Note,
            Source = request.Source ?? "User Action",
            Labels = request.Labels ?? new() { "user action" }
        });

        contract.UpdatedAt = DateTime.UtcNow.ToString("O");
        return contract;
    }

    public IReadOnlyList<UserDto> GetUsers() => store.Users.Where(u => u.Active).ToList();

    public IReadOnlyList<RoleDto> GetRoles() => store.Roles.ToList();

    public IReadOnlyList<PermissionDto> GetPermissions() => store.Permissions.ToList();

    public UserDto? GetCurrentUser() =>
        store.Users.FirstOrDefault(u => u.Id.Equals(store.CurrentUserId, StringComparison.OrdinalIgnoreCase) && u.Active);

    public UserDto? SwitchCurrentUser(string userId)
    {
        var user = store.Users.FirstOrDefault(u => u.Id.Equals(userId, StringComparison.OrdinalIgnoreCase) && u.Active);
        if (user is null) return null;
        store.CurrentUserId = user.Id;
        return user;
    }
}
