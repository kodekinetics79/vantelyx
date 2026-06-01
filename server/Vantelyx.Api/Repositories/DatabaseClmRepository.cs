using Microsoft.EntityFrameworkCore;
using Vantelyx.Api.Data;
using Vantelyx.Api.Models;
using Vantelyx.Api.Persistence;

namespace Vantelyx.Api.Repositories;

// Relational persistence behind the IClmRepository seam. Business/mutation logic is reused
// from InMemoryClmRepository over an in-memory working set; the working set is hydrated
// from the database on startup and mirrored back on every write, so contract data survives
// restart. Identity/reference data is seeded once from InMemoryStore.
// Singleton-safe via IDbContextFactory (short-lived context per operation).
public sealed class DatabaseClmRepository : IClmRepository
{
    private readonly IDbContextFactory<VantelyxDbContext> _factory;
    private readonly InMemoryStore _working;
    private readonly InMemoryClmRepository _inner;
    private readonly object _gate = new();

    public DatabaseClmRepository(IDbContextFactory<VantelyxDbContext> factory, InMemoryStore seed)
    {
        _factory = factory;
        _working = seed;
        _inner = new InMemoryClmRepository(_working);
        Hydrate();
    }

    private void Hydrate()
    {
        using var db = _factory.CreateDbContext();
        db.Database.EnsureCreated();

        if (!db.Contracts.Any())
        {
            SeedIdentity(db);
            PersistContracts();          // first run: persist the seeded demo contracts
            return;
        }

        var contracts = LoadContracts(db);
        _working.Contracts.Clear();
        _working.Contracts.AddRange(contracts);
    }

    private static List<ContractDto> LoadContracts(VantelyxDbContext db) =>
        db.Contracts
            .Include(c => c.Counterparty)
            .Include(c => c.Approvals)
            .Include(c => c.Obligations)
            .Include(c => c.ClauseSignals)
            .Include(c => c.ActivityLogs)
            .Include(c => c.RenewalHistory)
            .Include(c => c.Renewal)
            .Include(c => c.DocumentIntelligence!).ThenInclude(d => d.Fields)
            .AsNoTracking()
            .AsEnumerable()
            .Select(ContractMapping.ToDto)
            .ToList();

    private void PersistContracts()
    {
        using var db = _factory.CreateDbContext();
        // Small POC dataset: rewrite the aggregate wholesale to keep mapping simple and correct.
        db.Contracts.RemoveRange(db.Contracts);
        db.Counterparties.RemoveRange(db.Counterparties);
        db.SaveChanges();

        var counterparties = _working.Contracts
            .GroupBy(c => c.Counterparty.Id)
            .Select(g => ContractMapping.ToEntity(g.First().Counterparty));
        db.Counterparties.AddRange(counterparties);

        db.Contracts.AddRange(_working.Contracts.Select(ContractMapping.ToEntity));
        db.SaveChanges();
    }

    private void SeedIdentity(VantelyxDbContext db)
    {
        if (db.Users.Any()) return;

        db.Departments.AddRange(_working.Departments.Select(d => new DepartmentEntity { Id = d.Id, Name = d.Name }));
        db.Permissions.AddRange(_working.Permissions.Select(p => new PermissionEntity { Id = p.Id, Name = p.Name, Description = p.Description }));
        foreach (var role in _working.Roles)
        {
            db.Roles.Add(new RoleEntity
            {
                Id = role.Id, Name = role.Name,
                RolePermissions = role.PermissionIds.Select(pid => new RolePermissionEntity { RoleId = role.Id, PermissionId = pid }).ToList()
            });
        }
        foreach (var user in _working.Users)
        {
            db.Users.Add(new UserEntity
            {
                Id = user.Id, FullName = user.FullName, Email = user.Email, DepartmentId = user.DepartmentId, Active = user.Active,
                UserRoles = new List<UserRoleEntity> { new() { UserId = user.Id, RoleId = user.RoleId } }
            });
        }
        db.AccessPolicies.AddRange(_working.AccessPolicies.Select(p => new AccessPolicyEntity
        {
            Id = p.Id, Name = p.Name, Summary = p.Summary,
            RequiredPermissionIdsJson = System.Text.Json.JsonSerializer.Serialize(p.RequiredPermissionIds)
        }));
        db.Delegations.AddRange(_working.Delegations.Select(d => new DelegationEntity
        {
            Id = d.Id, FromUserId = d.FromUserId, ToUserId = d.ToUserId, StartsAt = d.StartsAtUtc, EndsAt = d.EndsAtUtc, Status = d.Status
        }));
        db.ApprovalAuthorities.AddRange(_working.ApprovalAuthorities.Select(a => new ApprovalAuthorityEntity
        {
            Id = a.Id, RoleId = a.RoleId, MaxContractValue = a.MaxContractValue, CanApproveHighRisk = a.CanApproveHighRisk,
            DepartmentIdsJson = System.Text.Json.JsonSerializer.Serialize(a.DepartmentIds)
        }));
        db.SaveChanges();
    }

    // Reads + identity delegate to the in-memory working set (hydrated from DB).
    public IReadOnlyList<ContractDto> GetContracts() => _inner.GetContracts();
    public ContractDto? GetContractById(string id) => _inner.GetContractById(id);
    public IReadOnlyList<UserDto> GetUsers() => _inner.GetUsers();
    public IReadOnlyList<RoleDto> GetRoles() => _inner.GetRoles();
    public IReadOnlyList<PermissionDto> GetPermissions() => _inner.GetPermissions();
    public UserDto? GetCurrentUser() => _inner.GetCurrentUser();
    public UserDto? SwitchCurrentUser(string userId) => _inner.SwitchCurrentUser(userId);

    // Writes mutate the working set, then flush to the relational store.
    public ContractDto CreateContract(ContractRequestDto request) => Mutate(() => _inner.CreateContract(request))!;
    public ContractDto? UpdateContractStatus(string id, StatusUpdateRequest request) => Mutate(() => _inner.UpdateContractStatus(id, request));
    public ContractDto? UpdateApprovalStep(string contractId, string stepId, ApprovalUpdateRequest request) => Mutate(() => _inner.UpdateApprovalStep(contractId, stepId, request));
    public ContractDto? UpdateObligationStatus(string contractId, string obligationId, ObligationUpdateRequest request) => Mutate(() => _inner.UpdateObligationStatus(contractId, obligationId, request));
    public ContractDto? AddActivity(string contractId, AddActivityRequest request) => Mutate(() => _inner.AddActivity(contractId, request));

    private ContractDto? Mutate(Func<ContractDto?> action)
    {
        lock (_gate)
        {
            var result = action();
            PersistContracts();
            return result;
        }
    }
}
