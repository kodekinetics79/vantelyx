using System.Text;
using Vantelyx.Api.Models;
using Vantelyx.Api.Repositories;

namespace Vantelyx.Api.Services;

public sealed class ClmService(IClmRepository repository)
{
    public IReadOnlyList<ContractDto> GetContracts() => repository.GetContracts();
    public ContractDto? GetContractById(string id) => repository.GetContractById(id);
    public ContractDto CreateContract(ContractRequestDto request) => repository.CreateContract(request);
    public ContractDto? UpdateContractStatus(string id, StatusUpdateRequest request) => repository.UpdateContractStatus(id, request);
    public ContractDto? UpdateApprovalStep(string contractId, string stepId, ApprovalUpdateRequest request) => repository.UpdateApprovalStep(contractId, stepId, request);
    public ContractDto? UpdateObligationStatus(string contractId, string obligationId, ObligationUpdateRequest request) => repository.UpdateObligationStatus(contractId, obligationId, request);
    public ContractDto? AddActivity(string contractId, AddActivityRequest request) => repository.AddActivity(contractId, request);
    public IReadOnlyList<UserDto> GetUsers() => repository.GetUsers();
    public IReadOnlyList<RoleDto> GetRoles() => repository.GetRoles();
    public IReadOnlyList<PermissionDto> GetPermissions() => repository.GetPermissions();
    public UserDto? GetCurrentUser() => repository.GetCurrentUser();
    public UserDto? SwitchCurrentUser(string userId) => repository.SwitchCurrentUser(userId);

    public DashboardMetricsDto GetDashboardMetrics()
    {
        var contracts = repository.GetContracts();
        var byStatus = contracts.GroupBy(c => c.Status).ToDictionary(g => g.Key, g => g.Count());
        var highRisk = contracts.Count(c => c.RiskScore >= 70);
        var pendingApprovals = contracts.Count(c => c.Approvals.Any(a => a.Decision == "pending" || a.Decision == "changes_requested"));
        var overdueObligations = contracts.Sum(c => c.Obligations.Count(o => o.Status != "done" && DateTime.TryParse(o.DueDate, out var d) && d < DateTime.UtcNow));
        var renewals90 = contracts.Count(c => DateTime.TryParse(c.Renewal.RenewalDate, out var d) && d >= DateTime.UtcNow && d <= DateTime.UtcNow.AddDays(90));
        var missingClauseCount = contracts.Sum(c => c.ClauseSignals.Count(cs => cs.Status == "missing"));
        var avgRisk = contracts.Count == 0 ? 0 : Math.Round((decimal)contracts.Average(c => c.RiskScore), 1);

        return new DashboardMetricsDto
        {
            TotalContracts = contracts.Count,
            ByStatus = byStatus,
            HighRiskContracts = highRisk,
            PendingApprovals = pendingApprovals,
            OverdueObligations = overdueObligations,
            RenewalsNext90Days = renewals90,
            MissingClauseCount = missingClauseCount,
            AverageRiskScore = avgRisk,
        };
    }

    public string ExportContractsCsv() => ToCsv(
        ["Contract ID", "Title", "Counterparty", "Type", "Status", "Risk Score", "Value", "Owner", "Renewal Date"],
        repository.GetContracts().Select(c => new object?[]
        {
            c.Id, c.Request.Title, c.Counterparty.Name, c.Request.ContractType, c.Status, c.RiskScore, c.Request.EstimatedValue, c.Request.RequesterName, c.Renewal.RenewalDate
        }));

    public string ExportObligationsCsv() => ToCsv(
        ["Contract ID", "Contract Title", "Obligation ID", "Title", "Owner", "Due Date", "Status", "Priority"],
        repository.GetContracts().SelectMany(c => c.Obligations.Select(o => new object?[]
        {
            c.Id, c.Request.Title, o.Id, o.Title, o.Owner, o.DueDate, o.Status, o.Priority
        })));

    public string ExportRenewalsCsv() => ToCsv(
        ["Contract ID", "Contract Title", "Renewal Date", "Notice Deadline", "Days Until Notice", "Auto Renew", "Owner", "Risk", "Recommended Action", "Status"],
        repository.GetContracts().Select(c => new object?[]
        {
            c.Id, c.Request.Title, c.Renewal.RenewalDate, c.Renewal.NoticeDeadline, c.Renewal.DaysUntilNoticeDeadline, c.Renewal.AutoRenew, c.Renewal.RenewalOwner, c.Renewal.RenewalRisk, c.Renewal.RecommendedAction, c.Renewal.Status
        }));

    public string ExportAuditLogCsv() => ToCsv(
        ["Contract ID", "Contract Title", "Timestamp", "Actor", "Action", "Previous Status", "New Status", "Note", "Source", "Labels", "Message"],
        repository.GetContracts().SelectMany(c => c.Activity.Select(a => new object?[]
        {
            c.Id, c.Request.Title, a.Timestamp, a.Actor, a.Action ?? a.Event, a.PreviousStatus, a.NewStatus, a.Note, a.Source, string.Join('|', a.Labels ?? new List<string>()), a.Message
        })));

    private static string ToCsv(IReadOnlyList<string> headers, IEnumerable<object?[]> rows)
    {
        static string Esc(object? value)
        {
            var raw = value?.ToString() ?? string.Empty;
            return $"\"{raw.Replace("\"", "\"\"")}\"";
        }

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', headers.Select(Esc)));
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(',', row.Select(Esc)));
        }
        return sb.ToString();
    }
}
