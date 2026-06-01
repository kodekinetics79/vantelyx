import { apiClient } from './apiClient';
import {
  canApproveContract,
  canEditContract,
  getVisibleContracts,
  hasPermission,
  seedSecurityData,
} from './securityService';
import {
  addActivityLog as addActivityLogLocal,
  createContractFromIntake as createContractFromIntakeLocal,
  exportAuditLogCsv as exportAuditLogCsvLocal,
  exportContractsCsv as exportContractsCsvLocal,
  exportObligationsCsv as exportObligationsCsvLocal,
  exportRenewalsCsv as exportRenewalsCsvLocal,
  getContractById as getContractByIdLocal,
  getContracts as getContractsLocal,
  getDashboardMetrics as getDashboardMetricsLocal,
  updateApprovalStep as updateApprovalStepLocal,
  updateContractStatus as updateContractStatusLocal,
  updateObligationStatus as updateObligationStatusLocal,
} from './vantelyxData';
import type {
  ActivityLog,
  ApprovalDecision,
  Contract,
  ContractRequest,
  ContractStatus,
  DashboardMetrics,
  ObligationStatus,
} from '../types/clm';
import { markTemplateDraftConverted } from './templateService';
import type { TemplateDraft } from '../types/authoring';
import {
  addSigner,
  archiveFinalContract,
  createExecutionPackage,
  exportExecutionPackagesCsv,
  getExecutionAuditEventsByPackage,
  getExecutionMetrics,
  getExecutionPackageByContractId,
  getExecutionPackages,
  markPackageExecuted,
  markPackageSent,
  markSignerCompleted,
  updateSignatureStep
} from './executionService';
import type { ExecutionPackage, FinalContractArchive, Signer, SignatureStep } from '../types/execution';
import type { SignatureAuditEvent } from '../types/execution';

export const clmRepository = {
  getContracts: async (): Promise<Contract[]> => {
    seedSecurityData();
    // TODO(.NET API): once backend contract shape is locked, remove envelope parsing fallback.
    const fallback = getContractsLocal();
    const response = await apiClient.get<{ data?: Contract[] }, Contract[]>('/api/contracts', fallback);
    const contracts = Array.isArray(response) ? response : response?.data ?? fallback;
    return getVisibleContracts(contracts);
  },

  getContractById: async (id: string): Promise<Contract | undefined> => {
    seedSecurityData();
    // TODO(.NET API): once backend contract shape is locked, remove envelope parsing fallback.
    const fallback = getContractByIdLocal(id);
    const response = await apiClient.get<{ data?: Contract }, Contract | undefined>(`/api/contracts/${id}`, fallback);
    const contract = !response
      ? fallback
      : 'id' in (response as Contract)
      ? (response as Contract)
      : (response as { data?: Contract }).data ?? fallback;
    if (!contract) return undefined;
    return getVisibleContracts([contract])[0];
  },

  createContractFromIntake: async (input: ContractRequest): Promise<Contract> => {
    seedSecurityData();
    if (!hasPermission('contracts.create')) {
      console.warn('[clmRepository] Missing permission contracts.create. Proceeding with local fallback for demo stability.');
    }
    // TODO(.NET API): replace payload mapping if backend request model diverges.
    const fallback = createContractFromIntakeLocal(input);
    const response = await apiClient.post<{ data?: Contract }, Contract>('/api/contracts', input, fallback);
    return 'id' in (response as Contract) ? (response as Contract) : (response as { data?: Contract }).data ?? fallback;
  },

  updateContractStatus: async (id: string, status: ContractStatus, note?: string): Promise<Contract | undefined> => {
    seedSecurityData();
    if (!hasPermission('contracts.edit') && !hasPermission('contracts.submit_review') && !hasPermission('contracts.execute')) {
      console.warn('[clmRepository] Missing permission to update contract status.');
      return undefined;
    }
    // TODO(.NET API): enrich payload with audit metadata once API requires actor/source.
    const fallback = updateContractStatusLocal(id, status, note);
    const response = await apiClient.patch<{ data?: Contract }, Contract | undefined>(
      `/api/contracts/${id}/status`,
      { status, note, actor: 'Frontend User' },
      fallback
    );
    if (!response) return fallback;
    return 'id' in (response as Contract) ? (response as Contract) : (response as { data?: Contract }).data ?? fallback;
  },

  updateApprovalStep: async (
    contractId: string,
    stepId: string,
    decision: ApprovalDecision,
    note?: string
  ): Promise<Contract | undefined> => {
    seedSecurityData();
    const existing = await clmRepository.getContractById(contractId);
    if (!existing || !canApproveContract(existing)) {
      console.warn('[clmRepository] Missing approval authority for contract.');
      return undefined;
    }
    // TODO(.NET API): enrich payload with audit metadata once API requires actor/source.
    const fallback = updateApprovalStepLocal(contractId, stepId, decision, note);
    const response = await apiClient.patch<{ data?: Contract }, Contract | undefined>(
      `/api/contracts/${contractId}/approvals/${stepId}`,
      { decision, note, actor: 'Frontend User' },
      fallback
    );
    if (!response) return fallback;
    return 'id' in (response as Contract) ? (response as Contract) : (response as { data?: Contract }).data ?? fallback;
  },

  updateObligationStatus: async (
    contractId: string,
    obligationId: string,
    status: ObligationStatus
  ): Promise<Contract | undefined> => {
    seedSecurityData();
    if (!hasPermission('obligations.manage')) {
      console.warn('[clmRepository] Missing permission obligations.manage.');
      return undefined;
    }
    // TODO(.NET API): enrich payload with audit metadata once API requires actor/source.
    const fallback = updateObligationStatusLocal(contractId, obligationId, status);
    const response = await apiClient.patch<{ data?: Contract }, Contract | undefined>(
      `/api/contracts/${contractId}/obligations/${obligationId}`,
      { status, actor: 'Frontend User' },
      fallback
    );
    if (!response) return fallback;
    return 'id' in (response as Contract) ? (response as Contract) : (response as { data?: Contract }).data ?? fallback;
  },

  addActivityLog: async (
    contractId: string,
    event: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<Contract | undefined> => {
    seedSecurityData();
    const existing = await clmRepository.getContractById(contractId);
    if (!existing || !canEditContract(existing)) {
      console.warn('[clmRepository] Missing permission to add activity for contract.');
      return undefined;
    }
    // TODO(.NET API): remove request shaping once backend activity DTO is finalized.
    const fallback = addActivityLogLocal(contractId, event);
    const response = await apiClient.post<{ data?: Contract }, Contract | undefined>(
      `/api/contracts/${contractId}/activity`,
      event,
      fallback
    );
    if (!response) return fallback;
    return 'id' in (response as Contract) ? (response as Contract) : (response as { data?: Contract }).data ?? fallback;
  },

  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    seedSecurityData();
    // TODO(.NET API): once backend metrics schema is fixed, remove envelope parsing fallback.
    const fallback = getDashboardMetricsLocal();
    const response = await apiClient.get<{ data?: DashboardMetrics }, DashboardMetrics>('/api/dashboard/metrics', fallback);
    return 'totalContracts' in (response as DashboardMetrics)
      ? (response as DashboardMetrics)
      : (response as { data?: DashboardMetrics }).data ?? fallback;
  },

  exportContractsCsv: async (): Promise<string> => {
    // TODO(.NET API): remove local fallback once exports are guaranteed server-side.
    return (await apiClient.getText('/api/exports/contracts', exportContractsCsvLocal())) as string;
  },

  exportObligationsCsv: async (): Promise<string> => {
    // TODO(.NET API): remove local fallback once exports are guaranteed server-side.
    return (await apiClient.getText('/api/exports/obligations', exportObligationsCsvLocal())) as string;
  },

  exportRenewalsCsv: async (): Promise<string> => {
    // TODO(.NET API): remove local fallback once exports are guaranteed server-side.
    return (await apiClient.getText('/api/exports/renewals', exportRenewalsCsvLocal())) as string;
  },

  exportAuditLogCsv: async (): Promise<string> => {
    // TODO(.NET API): remove local fallback once exports are guaranteed server-side.
    return (await apiClient.getText('/api/exports/audit-log', exportAuditLogCsvLocal())) as string;
  },

  convertDraftToContract: async (draft: TemplateDraft): Promise<Contract | null> => {
    const emailBase = draft.owner.trim().toLowerCase().replace(/\s+/g, '.');
    const clauseNames = draft.clauses.filter((clause) => clause.included).map((clause) => clause.clauseName);
    const highRiskClauses = draft.clauses
      .filter((clause) => clause.riskLevel === 'high' || clause.riskLevel === 'critical')
      .map((clause) => `${clause.clauseName} (${clause.riskLevel})`);

    const request: ContractRequest = {
      requesterName: draft.owner,
      requesterEmail: `${emailBase || 'workspace.user'}@vantelyx.com`,
      title: draft.title,
      contractType: draft.templateName.includes('NDA')
        ? 'NDA'
        : draft.templateName.includes('Master Services')
        ? 'MSA'
        : draft.templateName.includes('Vendor')
        ? 'Vendor Agreement'
        : draft.templateName.includes('Software')
        ? 'Customer Agreement'
        : 'SOW',
      counterpartyName: draft.counterparty,
      counterpartyRegion: 'US',
      estimatedValue: 150000,
      currency: 'USD',
      startDate: new Date().toISOString(),
      termMonths: 12,
      department: draft.department,
      priority: 'medium',
      tags: ['Template Draft', draft.templateName],
      metadata: {
        source: 'Template Draft',
        sourceTemplate: draft.templateName,
        draftVersion: String(draft.versionNumber),
        authoringStatus: draft.status
      },
      notes: [
        `Source: Template Draft`,
        `Source Template: ${draft.templateName}`,
        `Draft Version: ${draft.versionNumber}`,
        `Authoring Status: ${draft.status}`,
        `Included Clauses: ${clauseNames.join(', ') || 'None'}`,
        `Risk Notes: ${highRiskClauses.join(', ') || 'No high-risk clauses flagged'}`
      ].join('\n')
    };

    try {
      const created = await clmRepository.createContractFromIntake(request);
      await clmRepository.addActivityLog(created.id, {
        actor: draft.owner || 'Workspace User',
        event: 'created',
        message: 'Contract created from approved draft',
        action: 'Draft Conversion',
        previousStatus: 'draft',
        newStatus: created.status,
        note: `Converted from ${draft.templateName} v${draft.versionNumber}.`,
        source: 'User Action',
        labels: ['user action', 'completed']
      });
      markTemplateDraftConverted(draft.id);
      const refreshed = await clmRepository.getContractById(created.id);
      return refreshed ?? null;
    } catch {
      console.warn('[clmRepository] Failed to convert draft to contract.');
      return null;
    }
  },

  createExecutionPackage: (contractId: string): ExecutionPackage | null => createExecutionPackage(contractId),

  getExecutionPackages: (): ExecutionPackage[] => getExecutionPackages(),

  getExecutionPackageByContractId: (contractId: string): ExecutionPackage | undefined =>
    getExecutionPackageByContractId(contractId),

  addExecutionSigner: (packageId: string, signer: Omit<Signer, 'id' | 'status'>): ExecutionPackage | undefined =>
    addSigner(packageId, signer),

  updateExecutionSignatureStep: (
    packageId: string,
    stepId: string,
    status: SignatureStep['status'],
    note?: string
  ): ExecutionPackage | undefined => updateSignatureStep(packageId, stepId, status, note),

  markExecutionPackageSent: (packageId: string): ExecutionPackage | undefined => markPackageSent(packageId),

  markExecutionSignerCompleted: (packageId: string, signerId: string): ExecutionPackage | undefined =>
    markSignerCompleted(packageId, signerId),

  markExecutionPackageExecuted: (packageId: string): ExecutionPackage | undefined => markPackageExecuted(packageId),

  archiveExecutionFinalContract: (packageId: string): FinalContractArchive | undefined =>
    archiveFinalContract(packageId),

  getExecutionMetrics: () => getExecutionMetrics(),

  getExecutionAuditByPackage: (packageId: string): SignatureAuditEvent[] =>
    getExecutionAuditEventsByPackage(packageId),

  exportExecutionPackagesCsv: async (): Promise<string> => exportExecutionPackagesCsv()
};

export type ClmRepository = typeof clmRepository;
