using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Vantelyx.Api.Auth;
using Vantelyx.Api.Data;
using Vantelyx.Api.Models;
using Vantelyx.Api.Persistence;
using Vantelyx.Api.Repositories;
using Vantelyx.Api.Services;

const string ApiVersion = "1.0.0";

var builder = WebApplication.CreateBuilder(args);

// CORS for Vite dev ports (frontend-only, API, and full-stack local modes).
var allowedOrigins = new[]
{
    "http://localhost:9701",
    "http://localhost:9702",
    "http://localhost:9703",
    "http://localhost:5173",
};
builder.Services.AddCors(options =>
{
    options.AddPolicy("dev", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// ── Persistence spike ───────────────────────────────────────────────────────
// Persistence:Provider = InMemory (default) | Sqlite | MySql
// Sqlite proves durability locally with no infra; MySql is the production path.
string ResolveConnectionString(string provider) =>
    provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)
        ? (builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=vantelyx_clm.db")
        : (builder.Configuration.GetConnectionString("DefaultConnection")
            ?? builder.Configuration.GetConnectionString("MySql")
            ?? string.Empty);

var provider = builder.Configuration["Persistence:Provider"] ?? "InMemory";
var usesDatabase = provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)
    || provider.Equals("MySql", StringComparison.OrdinalIgnoreCase);

builder.Services.AddSingleton<InMemoryStore>();

if (usesDatabase)
{
    var connectionString = ResolveConnectionString(provider);
    builder.Services.AddDbContextFactory<VantelyxDbContext>(options =>
    {
        if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            options.UseSqlite(connectionString);
        }
        else
        {
            options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
        }
    });
    builder.Services.AddSingleton<IClmRepository, DatabaseClmRepository>();
}
else
{
    builder.Services.AddSingleton<IClmRepository, InMemoryClmRepository>();
}

builder.Services.AddSingleton<ClmService>();

// ── Auth spike (opt-in) ─────────────────────────────────────────────────────
// Auth:Enabled = false keeps the existing demo open; true enforces JWT on writes.
var authEnabled = builder.Configuration.GetValue<bool>("Auth:Enabled");
builder.Services.AddSingleton<JwtTokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = JwtTokenService.Issuer(builder.Configuration),
            ValidateAudience = true,
            ValidAudience = JwtTokenService.Audience(builder.Configuration),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtTokenService.SigningKey(builder.Configuration))),
            ValidateLifetime = true
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseCors("dev");
app.UseAuthentication();
app.UseAuthorization();

var databaseMode = usesDatabase ? provider : "InMemory";

// Conditionally require a bearer token: only enforce when Auth:Enabled is true so the
// current frontend (which does not yet attach tokens) keeps working during the POC.
RouteHandlerBuilder Secure(RouteHandlerBuilder route) => authEnabled ? route.RequireAuthorization() : route;

app.MapGet("/", () => Results.Ok(new
{
    name = "Vantelyx CLM API",
    persistence = databaseMode,
    authEnabled,
    endpoints = new[]
    {
        "/health",
        "/api/contracts",
        "/api/health",
        "/api/auth/dev-login",
        "/api/security/users",
        "/api/security/roles",
        "/api/security/permissions",
        "/api/security/current-user",
        "/api/dashboard/metrics",
        "/api/work-items",
        "/api/notifications",
        "/api/integrations",
        "/api/execution-packages",
        "/api/exports/contracts",
        "/api/exports/obligations",
        "/api/exports/renewals",
        "/api/exports/audit-log"
    }
}));

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "vantelyx-clm-api", utc = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    databaseMode,
    apiVersion = ApiVersion,
    timestampUtc = DateTime.UtcNow,
    authEnabled
}));

// ── Auth: dev login (issues a JWT for a seeded demo user) ───────────────────
// TODO(Auth): replace with OIDC/SAML federation against the university IdP.
app.MapPost("/api/auth/dev-login", (DevLoginRequest request, ClmService service, JwtTokenService jwt) =>
{
    if (string.IsNullOrWhiteSpace(request.UserId))
    {
        return Results.BadRequest(ApiResponse.Fail("userId (id or email) is required."));
    }

    var user = service.GetUsers().FirstOrDefault(u =>
        u.Id == request.UserId || u.Email.Equals(request.UserId, StringComparison.OrdinalIgnoreCase));
    if (user is null)
    {
        return Results.NotFound(ApiResponse.Fail($"User {request.UserId} was not found."));
    }

    var role = service.GetRoles().FirstOrDefault(r => r.Id == user.RoleId);
    var token = jwt.Issue(user, role?.PermissionIds ?? new List<string>());
    return Results.Ok(ApiResponse.Ok(new { token, user }, "Bearer token issued."));
});

app.MapGet("/api/contracts", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetContracts())));

app.MapGet("/api/contracts/{id}", (string id, ClmService service) =>
{
    var contract = service.GetContractById(id);
    return contract is null
        ? Results.NotFound(ApiResponse.Fail($"Contract {id} was not found."))
        : Results.Ok(ApiResponse.Ok(contract));
});

Secure(app.MapPost("/api/contracts", (ContractRequestDto request, ClmService service) =>
{
    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.CounterpartyName))
    {
        return Results.BadRequest(ApiResponse.Fail("Title and counterpartyName are required."));
    }

    var created = service.CreateContract(request);
    return Results.Created($"/api/contracts/{created.Id}", ApiResponse.Ok(created));
}));

Secure(app.MapPatch("/api/contracts/{id}/status", (string id, StatusUpdateRequest request, ClmService service) =>
{
    var updated = service.UpdateContractStatus(id, request);
    return updated is null
        ? Results.NotFound(ApiResponse.Fail($"Contract {id} was not found."))
        : Results.Ok(ApiResponse.Ok(updated));
}));

Secure(app.MapPatch("/api/contracts/{id}/approvals/{stepId}", (string id, string stepId, ApprovalUpdateRequest request, ClmService service) =>
{
    var updated = service.UpdateApprovalStep(id, stepId, request);
    return updated is null
        ? Results.NotFound(ApiResponse.Fail($"Approval step {stepId} for contract {id} was not found."))
        : Results.Ok(ApiResponse.Ok(updated));
}));

Secure(app.MapPatch("/api/contracts/{id}/obligations/{obligationId}", (string id, string obligationId, ObligationUpdateRequest request, ClmService service) =>
{
    var updated = service.UpdateObligationStatus(id, obligationId, request);
    return updated is null
        ? Results.NotFound(ApiResponse.Fail($"Obligation {obligationId} for contract {id} was not found."))
        : Results.Ok(ApiResponse.Ok(updated));
}));

Secure(app.MapPost("/api/contracts/{id}/activity", (string id, AddActivityRequest request, ClmService service) =>
{
    var updated = service.AddActivity(id, request);
    return updated is null
        ? Results.NotFound(ApiResponse.Fail($"Contract {id} was not found."))
        : Results.Ok(ApiResponse.Ok(updated));
}));

// TODO(Security): add tenant boundary enforcement and row-level policy evaluation in middleware.
// TODO(Security): emit tamper-resistant access logs for authn/authz decisions.
app.MapGet("/api/security/users", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetUsers())));
app.MapGet("/api/security/roles", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetRoles())));
app.MapGet("/api/security/permissions", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetPermissions())));

// Current user prefers the authenticated principal (token sub claim); falls back to the
// demo current user when auth is disabled.
app.MapGet("/api/security/current-user", (HttpContext context, ClmService service) =>
{
    var subject = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
        ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var user = subject is not null
        ? service.GetUsers().FirstOrDefault(u => u.Id == subject) ?? service.GetCurrentUser()
        : service.GetCurrentUser();
    return user is null
        ? Results.NotFound(ApiResponse.Fail("No current user is available."))
        : Results.Ok(ApiResponse.Ok(user));
});

// Demo-only impersonation; superseded by /api/auth/dev-login when Auth:Enabled is true.
app.MapPost("/api/security/switch-user-demo", (SecuritySwitchUserRequest request, ClmService service) =>
{
    if (string.IsNullOrWhiteSpace(request.UserId))
    {
        return Results.BadRequest(ApiResponse.Fail("userId is required."));
    }

    var user = service.SwitchCurrentUser(request.UserId);
    return user is null
        ? Results.NotFound(ApiResponse.Fail($"User {request.UserId} was not found or inactive."))
        : Results.Ok(ApiResponse.Ok(user, "Current demo user switched."));
});

app.MapGet("/api/dashboard/metrics", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetDashboardMetrics())));

// Sprint 10: read-only operational + integration collections for the frontend adapter.
app.MapGet("/api/work-items", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetWorkItems())));
app.MapGet("/api/notifications", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetNotifications())));
app.MapGet("/api/integrations", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetIntegrations())));
app.MapGet("/api/execution-packages", (ClmService service) => Results.Ok(ApiResponse.Ok(service.GetExecutionPackages())));

app.MapGet("/api/exports/contracts", (ClmService service) =>
    Results.Text(service.ExportContractsCsv(), "text/csv"));

app.MapGet("/api/exports/obligations", (ClmService service) =>
    Results.Text(service.ExportObligationsCsv(), "text/csv"));

app.MapGet("/api/exports/renewals", (ClmService service) =>
    Results.Text(service.ExportRenewalsCsv(), "text/csv"));

app.MapGet("/api/exports/audit-log", (ClmService service) =>
    Results.Text(service.ExportAuditLogCsv(), "text/csv"));

app.Run();
