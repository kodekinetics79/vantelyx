using Vantelyx.Api.Models;

namespace Vantelyx.Api.Repositories;

public interface IClmRepository
{
    IReadOnlyList<ContractDto> GetContracts();
    ContractDto? GetContractById(string id);
    ContractDto CreateContract(ContractRequestDto request);
    ContractDto? UpdateContractStatus(string id, StatusUpdateRequest request);
    ContractDto? UpdateApprovalStep(string contractId, string stepId, ApprovalUpdateRequest request);
    ContractDto? UpdateObligationStatus(string contractId, string obligationId, ObligationUpdateRequest request);
    ContractDto? AddActivity(string contractId, AddActivityRequest request);
    IReadOnlyList<UserDto> GetUsers();
    IReadOnlyList<RoleDto> GetRoles();
    IReadOnlyList<PermissionDto> GetPermissions();
    UserDto? GetCurrentUser();
    UserDto? SwitchCurrentUser(string userId);
}
