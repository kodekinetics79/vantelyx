using System.Text.Json;
using Vantelyx.Api.Models;

namespace Vantelyx.Api.Persistence;

// Maps the nested ContractDto aggregate to/from the relational entity graph.
public static class ContractMapping
{
    private static readonly JsonSerializerOptions Json = new();

    private static string Ser<T>(T value) => JsonSerializer.Serialize(value, Json);
    private static T Des<T>(string? raw, T fallback) =>
        string.IsNullOrWhiteSpace(raw) ? fallback : JsonSerializer.Deserialize<T>(raw!, Json) ?? fallback;

    public static CounterpartyEntity ToEntity(CounterpartyDto c) => new()
    {
        Id = c.Id, Name = c.Name, Type = c.Type, RiskRating = c.RiskRating,
        TotalContractValue = c.TotalContractValue, ActiveContracts = c.ActiveContracts,
        ExpiredContracts = c.ExpiredContracts, PendingContracts = c.PendingContracts,
        InsuranceStatus = c.InsuranceStatus, ComplianceStatus = c.ComplianceStatus,
        SanctionsStatus = c.SanctionsStatus, DocumentCompleteness = c.DocumentCompleteness,
        RelationshipOwner = c.RelationshipOwner, Region = c.Region, Industry = c.Industry,
        RiskLevel = c.RiskLevel, IsStrategic = c.IsStrategic
    };

    public static ContractEntity ToEntity(ContractDto c)
    {
        var r = c.Request;
        var entity = new ContractEntity
        {
            Id = c.Id, CounterpartyId = c.Counterparty.Id, Status = c.Status,
            CreatedAt = c.CreatedAt, UpdatedAt = c.UpdatedAt, RiskScore = c.RiskScore,
            RequesterName = r.RequesterName, RequesterEmail = r.RequesterEmail, Title = r.Title,
            ContractType = r.ContractType, CounterpartyName = r.CounterpartyName,
            CounterpartyRegion = r.CounterpartyRegion, EstimatedValue = r.EstimatedValue,
            Currency = r.Currency, StartDate = r.StartDate, TermMonths = r.TermMonths,
            PaymentTerms = r.PaymentTerms, Jurisdiction = r.Jurisdiction, AutoRenew = r.AutoRenew,
            Department = r.Department, Priority = r.Priority,
            TagsJson = r.Tags is null ? null : Ser(r.Tags),
            MetadataJson = r.Metadata is null ? null : Ser(r.Metadata),
            Notes = r.Notes,
            RiskSignalsJson = Ser(c.RiskSignals),
            ClauseReviewsJson = Ser(c.ClauseReviews),
            Approvals = c.Approvals.Select(a => new ApprovalStepEntity
            {
                Id = a.Id, ContractId = c.Id, Role = a.Role, Approver = a.Approver,
                Decision = a.Decision, UpdatedAt = a.UpdatedAt, Note = a.Note
            }).ToList(),
            Obligations = c.Obligations.Select(o => new ObligationEntity
            {
                Id = o.Id, ContractId = c.Id, Title = o.Title, Owner = o.Owner,
                DueDate = o.DueDate, Status = o.Status, Priority = o.Priority, Note = o.Note
            }).ToList(),
            ClauseSignals = c.ClauseSignals.Select(s => new ClauseSignalEntity
            {
                ContractId = c.Id, Clause = s.Clause, Status = s.Status, Severity = s.Severity, Message = s.Message
            }).ToList(),
            ActivityLogs = c.Activity.Select(a => new ActivityLogEntity
            {
                Id = a.Id, ContractId = c.Id, Timestamp = a.Timestamp, Actor = a.Actor, Event = a.Event,
                Message = a.Message, Action = a.Action, PreviousStatus = a.PreviousStatus,
                NewStatus = a.NewStatus, Note = a.Note, Source = a.Source,
                LabelsJson = a.Labels is null ? null : Ser(a.Labels)
            }).ToList(),
            RenewalHistory = c.Renewal.ActionHistory.Select(h => new RenewalActionHistoryEntity
            {
                Id = h.Id, ContractId = c.Id, Action = h.Action, Note = h.Note, Actor = h.Actor, Timestamp = h.Timestamp
            }).ToList(),
            Renewal = new RenewalEntity
            {
                ContractId = c.Id, AutoRenew = c.Renewal.AutoRenew, RenewalDate = c.Renewal.RenewalDate,
                NoticeDeadline = c.Renewal.NoticeDeadline, DaysUntilNoticeDeadline = c.Renewal.DaysUntilNoticeDeadline,
                RenewalOwner = c.Renewal.RenewalOwner, RecommendedAction = c.Renewal.RecommendedAction,
                RenewalRisk = c.Renewal.RenewalRisk, CommercialImpact = c.Renewal.CommercialImpact,
                VendorPerformanceNote = c.Renewal.VendorPerformanceNote, NoticeSentAt = c.Renewal.NoticeSentAt,
                Status = c.Renewal.Status
            }
        };

        if (c.DocumentIntelligence is { } di)
        {
            entity.DocumentIntelligence = new DocumentIntelligenceEntity
            {
                ContractId = c.Id, DocumentName = di.DocumentName, DocumentType = di.DocumentType,
                ExtractedPartiesJson = Ser(di.ExtractedParties), EffectiveDate = di.EffectiveDate,
                ExpirationDate = di.ExpirationDate, GoverningLaw = di.GoverningLaw, PaymentTerms = di.PaymentTerms,
                TerminationRights = di.TerminationRights, Confidentiality = di.Confidentiality, Indemnity = di.Indemnity,
                LimitationOfLiability = di.LimitationOfLiability, AutoRenewLanguage = di.AutoRenewLanguage,
                AssignmentRestriction = di.AssignmentRestriction, InsuranceRequirement = di.InsuranceRequirement,
                AuditRights = di.AuditRights, HumanReviewNeeded = di.HumanReviewNeeded,
                HumanReviewReasonsJson = Ser(di.HumanReviewReasons),
                Fields = di.Confidence.Select(kv => new DocumentIntelligenceFieldEntity
                {
                    ContractId = c.Id, FieldName = kv.Key, Confidence = kv.Value
                }).ToList()
            };
        }

        return entity;
    }

    public static ContractDto ToDto(ContractEntity e)
    {
        var counterparty = e.Counterparty is null
            ? new CounterpartyDto
            {
                Id = e.CounterpartyId, Name = e.CounterpartyName, Type = "vendor", RiskRating = "medium",
                InsuranceStatus = "pending_review", ComplianceStatus = "pending_review", SanctionsStatus = "clear",
                DocumentCompleteness = "partial", RelationshipOwner = e.RequesterName, Region = e.CounterpartyRegion,
                Industry = "General", RiskLevel = "medium"
            }
            : new CounterpartyDto
            {
                Id = e.Counterparty.Id, Name = e.Counterparty.Name, Type = e.Counterparty.Type,
                RiskRating = e.Counterparty.RiskRating, TotalContractValue = e.Counterparty.TotalContractValue,
                ActiveContracts = e.Counterparty.ActiveContracts, ExpiredContracts = e.Counterparty.ExpiredContracts,
                PendingContracts = e.Counterparty.PendingContracts, InsuranceStatus = e.Counterparty.InsuranceStatus,
                ComplianceStatus = e.Counterparty.ComplianceStatus, SanctionsStatus = e.Counterparty.SanctionsStatus,
                DocumentCompleteness = e.Counterparty.DocumentCompleteness, RelationshipOwner = e.Counterparty.RelationshipOwner,
                Region = e.Counterparty.Region ?? e.CounterpartyRegion, Industry = e.Counterparty.Industry ?? "General",
                RiskLevel = e.Counterparty.RiskLevel, IsStrategic = e.Counterparty.IsStrategic
            };

        return new ContractDto
        {
            Id = e.Id,
            Status = e.Status,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
            RiskScore = e.RiskScore,
            Counterparty = counterparty,
            Request = new ContractRequestDto
            {
                RequesterName = e.RequesterName, RequesterEmail = e.RequesterEmail, Title = e.Title,
                ContractType = e.ContractType, CounterpartyName = e.CounterpartyName,
                CounterpartyRegion = e.CounterpartyRegion, EstimatedValue = e.EstimatedValue, Currency = e.Currency,
                StartDate = e.StartDate, TermMonths = e.TermMonths, PaymentTerms = e.PaymentTerms,
                Jurisdiction = e.Jurisdiction, AutoRenew = e.AutoRenew, Department = e.Department, Priority = e.Priority,
                Tags = Des<List<string>?>(e.TagsJson, null),
                Metadata = Des<Dictionary<string, string>?>(e.MetadataJson, null),
                Notes = e.Notes
            },
            RiskSignals = Des(e.RiskSignalsJson, new List<RiskSignalDto>()),
            ClauseReviews = Des(e.ClauseReviewsJson, new List<ClauseReviewItemDto>()),
            ClauseSignals = e.ClauseSignals.Select(s => new ClauseSignalDto
            {
                Clause = s.Clause, Status = s.Status, Severity = s.Severity, Message = s.Message
            }).ToList(),
            Obligations = e.Obligations.Select(o => new ObligationDto
            {
                Id = o.Id, Title = o.Title, Owner = o.Owner, DueDate = o.DueDate, Status = o.Status,
                Priority = o.Priority, Note = o.Note
            }).ToList(),
            Approvals = e.Approvals.Select(a => new ApprovalStepDto
            {
                Id = a.Id, Role = a.Role, Approver = a.Approver, Decision = a.Decision, UpdatedAt = a.UpdatedAt, Note = a.Note
            }).ToList(),
            Activity = e.ActivityLogs.Select(a => new ActivityLogDto
            {
                Id = a.Id, Timestamp = a.Timestamp, Actor = a.Actor, Event = a.Event, Message = a.Message,
                Action = a.Action, PreviousStatus = a.PreviousStatus, NewStatus = a.NewStatus, Note = a.Note,
                Source = a.Source, Labels = Des<List<string>?>(a.LabelsJson, null)
            }).ToList(),
            Renewal = new RenewalDto
            {
                AutoRenew = e.Renewal?.AutoRenew ?? false,
                RenewalDate = e.Renewal?.RenewalDate ?? string.Empty,
                NoticeDeadline = e.Renewal?.NoticeDeadline ?? string.Empty,
                DaysUntilNoticeDeadline = e.Renewal?.DaysUntilNoticeDeadline ?? 0,
                RenewalOwner = e.Renewal?.RenewalOwner ?? string.Empty,
                RecommendedAction = e.Renewal?.RecommendedAction ?? string.Empty,
                RenewalRisk = e.Renewal?.RenewalRisk ?? "low",
                CommercialImpact = e.Renewal?.CommercialImpact ?? string.Empty,
                VendorPerformanceNote = e.Renewal?.VendorPerformanceNote ?? string.Empty,
                NoticeSentAt = e.Renewal?.NoticeSentAt,
                Status = e.Renewal?.Status ?? "monitoring",
                ActionHistory = e.RenewalHistory.Select(h => new RenewalActionHistoryDto
                {
                    Id = h.Id, Action = h.Action, Note = h.Note, Actor = h.Actor, Timestamp = h.Timestamp
                }).ToList()
            },
            DocumentIntelligence = e.DocumentIntelligence is null ? null : new DocumentIntelligenceDto
            {
                DocumentName = e.DocumentIntelligence.DocumentName, DocumentType = e.DocumentIntelligence.DocumentType,
                ExtractedParties = Des(e.DocumentIntelligence.ExtractedPartiesJson, new List<string>()),
                EffectiveDate = e.DocumentIntelligence.EffectiveDate, ExpirationDate = e.DocumentIntelligence.ExpirationDate,
                GoverningLaw = e.DocumentIntelligence.GoverningLaw, PaymentTerms = e.DocumentIntelligence.PaymentTerms,
                TerminationRights = e.DocumentIntelligence.TerminationRights, Confidentiality = e.DocumentIntelligence.Confidentiality,
                Indemnity = e.DocumentIntelligence.Indemnity, LimitationOfLiability = e.DocumentIntelligence.LimitationOfLiability,
                AutoRenewLanguage = e.DocumentIntelligence.AutoRenewLanguage, AssignmentRestriction = e.DocumentIntelligence.AssignmentRestriction,
                InsuranceRequirement = e.DocumentIntelligence.InsuranceRequirement, AuditRights = e.DocumentIntelligence.AuditRights,
                HumanReviewNeeded = e.DocumentIntelligence.HumanReviewNeeded,
                HumanReviewReasons = Des(e.DocumentIntelligence.HumanReviewReasonsJson, new List<string>()),
                Confidence = e.DocumentIntelligence.Fields.ToDictionary(f => f.FieldName, f => f.Confidence)
            }
        };
    }
}
