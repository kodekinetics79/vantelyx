using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Vantelyx.Api.Models;

namespace Vantelyx.Api.Auth;

public sealed record DevLoginRequest(string UserId);

// Auth spike: issues HS256 JWTs for a demo user so endpoints can be protected by a real
// bearer token and the current principal can be derived from claims.
// TODO(Auth): replace dev-login with OIDC/SAML (Entra ID, Okta, university Shibboleth).
//   Validate tokens against the IdP's JWKS, map external claims to internal roles, and
//   enforce tenant boundaries from the token's tenant/realm claim.
public sealed class JwtTokenService(IConfiguration config)
{
    public const string DevSigningKey = "vantelyx-dev-signing-key-change-me-please-0001";

    public static string SigningKey(IConfiguration config) =>
        config["Auth:SigningKey"] is { Length: >= 32 } configured ? configured : DevSigningKey;

    public static string Issuer(IConfiguration config) => config["Auth:Issuer"] ?? "vantelyx-clm";
    public static string Audience(IConfiguration config) => config["Auth:Audience"] ?? "vantelyx-clm-api";

    public string Issue(UserDto user, IEnumerable<string> permissions)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey(config)));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.FullName),
            new(ClaimTypes.Role, user.RoleName),
            new("roleId", user.RoleId),
            new("department", user.DepartmentName)
        };
        claims.AddRange(permissions.Select(permission => new Claim("perm", permission)));

        var token = new JwtSecurityToken(
            issuer: Issuer(config),
            audience: Audience(config),
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
