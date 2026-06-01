using Microsoft.EntityFrameworkCore;

namespace Vantelyx.Api.Persistence;

// Relational persistence model mapped to database/init.sql. Used when
// Persistence:Provider is Sqlite (local/POC) or MySql (production).
public sealed class VantelyxDbContext(DbContextOptions<VantelyxDbContext> options) : DbContext(options)
{
    public DbSet<CounterpartyEntity> Counterparties => Set<CounterpartyEntity>();
    public DbSet<ContractEntity> Contracts => Set<ContractEntity>();
    public DbSet<ApprovalStepEntity> ApprovalSteps => Set<ApprovalStepEntity>();
    public DbSet<ObligationEntity> Obligations => Set<ObligationEntity>();
    public DbSet<RenewalEntity> Renewals => Set<RenewalEntity>();
    public DbSet<RenewalActionHistoryEntity> RenewalActionHistory => Set<RenewalActionHistoryEntity>();
    public DbSet<ActivityLogEntity> ActivityLogs => Set<ActivityLogEntity>();
    public DbSet<ClauseSignalEntity> ClauseSignals => Set<ClauseSignalEntity>();
    public DbSet<DocumentIntelligenceEntity> DocumentIntelligence => Set<DocumentIntelligenceEntity>();
    public DbSet<DocumentIntelligenceFieldEntity> DocumentIntelligenceFields => Set<DocumentIntelligenceFieldEntity>();

    public DbSet<DepartmentEntity> Departments => Set<DepartmentEntity>();
    public DbSet<PermissionEntity> Permissions => Set<PermissionEntity>();
    public DbSet<RoleEntity> Roles => Set<RoleEntity>();
    public DbSet<RolePermissionEntity> RolePermissions => Set<RolePermissionEntity>();
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<UserRoleEntity> UserRoles => Set<UserRoleEntity>();
    public DbSet<AccessPolicyEntity> AccessPolicies => Set<AccessPolicyEntity>();
    public DbSet<DelegationEntity> Delegations => Set<DelegationEntity>();
    public DbSet<ApprovalAuthorityEntity> ApprovalAuthorities => Set<ApprovalAuthorityEntity>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<CounterpartyEntity>(e => { e.ToTable("counterparties"); e.HasKey(x => x.Id); });

        b.Entity<ContractEntity>(e =>
        {
            e.ToTable("contracts");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Counterparty).WithMany().HasForeignKey(x => x.CounterpartyId);
            e.HasMany(x => x.Approvals).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Obligations).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.ClauseSignals).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.ActivityLogs).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.RenewalHistory).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Renewal).WithOne().HasForeignKey<RenewalEntity>(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.DocumentIntelligence).WithOne().HasForeignKey<DocumentIntelligenceEntity>(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ApprovalStepEntity>(e => { e.ToTable("approval_steps"); e.HasKey(x => x.Id); });
        b.Entity<ObligationEntity>(e => { e.ToTable("obligations"); e.HasKey(x => x.Id); });
        b.Entity<RenewalEntity>(e => { e.ToTable("renewals"); e.HasKey(x => x.ContractId); });
        b.Entity<RenewalActionHistoryEntity>(e => { e.ToTable("renewal_action_history"); e.HasKey(x => x.Id); });
        b.Entity<ActivityLogEntity>(e => { e.ToTable("activity_logs"); e.HasKey(x => x.Id); });
        b.Entity<ClauseSignalEntity>(e => { e.ToTable("clause_signals"); e.HasKey(x => x.Id); });
        b.Entity<DocumentIntelligenceEntity>(e =>
        {
            e.ToTable("document_intelligence");
            e.HasKey(x => x.ContractId);
            e.HasMany(x => x.Fields).WithOne().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<DocumentIntelligenceFieldEntity>(e =>
        {
            e.ToTable("document_intelligence_fields");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ContractId, x.FieldName }).IsUnique();
        });

        b.Entity<DepartmentEntity>(e => { e.ToTable("departments"); e.HasKey(x => x.Id); });
        b.Entity<PermissionEntity>(e => { e.ToTable("permissions"); e.HasKey(x => x.Id); });
        b.Entity<RoleEntity>(e =>
        {
            e.ToTable("roles");
            e.HasKey(x => x.Id);
            e.HasMany(x => x.RolePermissions).WithOne().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<RolePermissionEntity>(e => { e.ToTable("role_permissions"); e.HasKey(x => new { x.RoleId, x.PermissionId }); });
        b.Entity<UserEntity>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.HasMany(x => x.UserRoles).WithOne().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<UserRoleEntity>(e => { e.ToTable("user_roles"); e.HasKey(x => new { x.UserId, x.RoleId }); });
        b.Entity<AccessPolicyEntity>(e => { e.ToTable("access_policies"); e.HasKey(x => x.Id); });
        b.Entity<DelegationEntity>(e => { e.ToTable("delegations"); e.HasKey(x => x.Id); });
        b.Entity<ApprovalAuthorityEntity>(e => { e.ToTable("approval_authorities"); e.HasKey(x => x.Id); });
    }
}
