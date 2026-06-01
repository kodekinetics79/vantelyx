import { addActivityLog, getContractById, updateContractStatus } from './vantelyxData';
import type { ExecutionDocument, ExecutionMetrics, ExecutionPackage, FinalContractArchive, Signer, SignatureAuditEvent, SignatureProvider, SignatureStep } from '../types/execution';

const EXEC_PACKAGES_KEY = 'vantelyx_execution_packages';
const EXEC_ARCHIVES_KEY = 'vantelyx_execution_archives';
const EXEC_AUDIT_KEY = 'vantelyx_execution_audit';

const hasStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;
const nowIso = (): string => new Date().toISOString();
const randomId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const read = <T>(key: string, fallback: T): T => {
  if (!hasStorage()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = <T>(key: string, value: T): void => {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const addAuditEvent = (event: Omit<SignatureAuditEvent, 'id' | 'timestamp'>): SignatureAuditEvent => {
  const entry: SignatureAuditEvent = {
    id: randomId('exec_audit'),
    timestamp: nowIso(),
    ...event
  };
  const audit = read<SignatureAuditEvent[]>(EXEC_AUDIT_KEY, []);
  write(EXEC_AUDIT_KEY, [entry, ...audit]);
  return entry;
};

const buildDefaultDocument = (contractId: string, packageId: string): ExecutionDocument => ({
  id: randomId('exec_doc'),
  packageId,
  name: `${contractId}_signature_package.pdf`,
  type: 'main_contract',
  status: 'draft',
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const savePackages = (packages: ExecutionPackage[]): void => write(EXEC_PACKAGES_KEY, packages);
const getArchives = (): FinalContractArchive[] => read<FinalContractArchive[]>(EXEC_ARCHIVES_KEY, []);
const saveArchives = (archives: FinalContractArchive[]): void => write(EXEC_ARCHIVES_KEY, archives);

export const seedExecutionData = (): void => {
  const packages = read<ExecutionPackage[]>(EXEC_PACKAGES_KEY, []);
  if (packages.length === 0) {
    write(EXEC_PACKAGES_KEY, []);
  }
  const archives = read<FinalContractArchive[]>(EXEC_ARCHIVES_KEY, []);
  if (archives.length === 0) {
    write(EXEC_ARCHIVES_KEY, []);
  }
  const audit = read<SignatureAuditEvent[]>(EXEC_AUDIT_KEY, []);
  if (audit.length === 0) {
    write(EXEC_AUDIT_KEY, []);
  }
};

export const createExecutionPackage = (contractId: string): ExecutionPackage | null => {
  seedExecutionData();
  const contract = getContractById(contractId);
  if (!contract) return null;

  const existing = getExecutionPackageByContractId(contractId);
  if (existing) return existing;

  const pkgId = randomId('exec_pkg');
  const executionPackage: ExecutionPackage = {
    id: pkgId,
    contractId,
    provider: 'Internal Approval Only',
    status: 'draft',
    signers: [],
    signatureSteps: [],
    documents: [buildDefaultDocument(contractId, pkgId)],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const packages = getExecutionPackages();
  savePackages([executionPackage, ...packages]);
  addAuditEvent({ packageId: pkgId, actor: 'Execution Service', action: 'PACKAGE_CREATED', note: 'Execution package initialized.' });
  return executionPackage;
};

export const getExecutionPackages = (): ExecutionPackage[] => {
  seedExecutionData();
  return read<ExecutionPackage[]>(EXEC_PACKAGES_KEY, []);
};

export const getExecutionPackageByContractId = (contractId: string): ExecutionPackage | undefined =>
  getExecutionPackages().find((pkg) => pkg.contractId === contractId);

export const addSigner = (packageId: string, signer: Omit<Signer, 'id' | 'status'>): ExecutionPackage | undefined => {
  const packages = getExecutionPackages();
  const idx = packages.findIndex((pkg) => pkg.id === packageId);
  if (idx === -1) return undefined;

  const pkg = packages[idx];
  const nextSigner: Signer = { ...signer, id: randomId('exec_signer'), status: 'pending' };
  const nextStep: SignatureStep = {
    id: randomId('exec_step'),
    signerId: nextSigner.id,
    order: signer.order,
    status: 'pending',
    updatedAt: nowIso()
  };

  const updated: ExecutionPackage = {
    ...pkg,
    signers: [...pkg.signers, nextSigner].sort((a, b) => a.order - b.order),
    signatureSteps: [...pkg.signatureSteps, nextStep].sort((a, b) => a.order - b.order),
    updatedAt: nowIso()
  };
  packages[idx] = updated;
  savePackages(packages);
  addAuditEvent({ packageId, actor: 'Execution Service', action: 'SIGNER_ADDED', note: `${signer.name} added.` });
  return updated;
};

export const updateSignatureStep = (
  packageId: string,
  stepId: string,
  status: SignatureStep['status'],
  note?: string
): ExecutionPackage | undefined => {
  const packages = getExecutionPackages();
  const idx = packages.findIndex((pkg) => pkg.id === packageId);
  if (idx === -1) return undefined;
  const pkg = packages[idx];
  const stepIdx = pkg.signatureSteps.findIndex((step) => step.id === stepId);
  if (stepIdx === -1) return undefined;

  const signatureSteps = [...pkg.signatureSteps];
  signatureSteps[stepIdx] = { ...signatureSteps[stepIdx], status, note, updatedAt: nowIso() };

  const signers = pkg.signers.map((signer) =>
    signer.id === signatureSteps[stepIdx].signerId
      ? { ...signer, status: status === 'completed' ? 'completed' : status === 'sent' ? 'sent' : signer.status, completedAt: status === 'completed' ? nowIso() : signer.completedAt }
      : signer
  );

  const updated: ExecutionPackage = {
    ...pkg,
    signers,
    signatureSteps,
    status:
      signatureSteps.every((step) => step.status === 'completed')
        ? 'executed'
        : signatureSteps.some((step) => step.status === 'sent' || step.status === 'completed')
        ? 'partially_signed'
        : pkg.status,
    updatedAt: nowIso()
  };
  packages[idx] = updated;
  savePackages(packages);
  addAuditEvent({ packageId, actor: 'Execution Service', action: 'STEP_UPDATED', note: `${stepId} -> ${status}${note ? ` (${note})` : ''}` });
  return updated;
};

export const markPackageSent = (packageId: string): ExecutionPackage | undefined => {
  const packages = getExecutionPackages();
  const idx = packages.findIndex((pkg) => pkg.id === packageId);
  if (idx === -1) return undefined;
  const pkg = packages[idx];
  const sentAt = nowIso();
  const updated: ExecutionPackage = {
    ...pkg,
    status: 'sent',
    sentAt,
    signers: pkg.signers.map((signer) => (signer.status === 'pending' ? { ...signer, status: 'sent' } : signer)),
    signatureSteps: pkg.signatureSteps.map((step) => (step.status === 'pending' ? { ...step, status: 'sent', updatedAt: sentAt } : step)),
    documents: pkg.documents.map((doc) => ({ ...doc, status: 'sent', updatedAt: sentAt })),
    updatedAt: sentAt
  };
  packages[idx] = updated;
  savePackages(packages);
  addAuditEvent({ packageId, actor: 'Execution Service', action: 'PACKAGE_SENT', note: 'Signature package sent to signers.' });
  return updated;
};

export const markSignerCompleted = (packageId: string, signerId: string): ExecutionPackage | undefined => {
  const pkg = getExecutionPackages().find((item) => item.id === packageId);
  if (!pkg) return undefined;
  const step = pkg.signatureSteps.find((item) => item.signerId === signerId);
  if (!step) return undefined;
  return updateSignatureStep(packageId, step.id, 'completed', 'Signer completed signature.');
};

export const markPackageExecuted = (packageId: string): ExecutionPackage | undefined => {
  const packages = getExecutionPackages();
  const idx = packages.findIndex((pkg) => pkg.id === packageId);
  if (idx === -1) return undefined;
  const pkg = packages[idx];

  const executedAt = nowIso();
  const updated: ExecutionPackage = {
    ...pkg,
    status: 'executed',
    executedAt,
    signers: pkg.signers.map((signer) =>
      signer.status === 'completed' ? signer : { ...signer, status: 'completed', completedAt: signer.completedAt ?? executedAt }
    ),
    signatureSteps: pkg.signatureSteps.map((step) =>
      step.status === 'completed' ? step : { ...step, status: 'completed', updatedAt: executedAt, note: step.note ?? 'Completed by execution finalization.' }
    ),
    documents: pkg.documents.map((doc) => ({ ...doc, status: 'signed', updatedAt: executedAt })),
    updatedAt: executedAt
  };
  packages[idx] = updated;
  savePackages(packages);

  updateContractStatus(pkg.contractId, 'executed', 'Executed through local execution package.');
  addActivityLog(pkg.contractId, {
    actor: 'Execution Service',
    event: 'status_changed',
    message: 'Contract executed via signature package.',
    action: 'Execution Completed',
    previousStatus: 'approved',
    newStatus: 'executed',
    note: `Execution package ${packageId} completed.`,
    source: 'Workflow',
    labels: ['system generated', 'completed']
  });
  addActivityLog(pkg.contractId, {
    actor: 'Execution Service',
    event: 'comment',
    message: 'Obligations and renewals remain active post-execution.',
    action: 'Post-Execution Activation',
    note: 'Operational obligations and renewal controls continue after execution.',
    source: 'Workflow',
    labels: ['system generated']
  });
  addAuditEvent({ packageId, actor: 'Execution Service', action: 'PACKAGE_EXECUTED', note: 'Package marked executed and contract status updated.' });
  return updated;
};

export const archiveFinalContract = (packageId: string): FinalContractArchive | undefined => {
  const packages = getExecutionPackages();
  const idx = packages.findIndex((pkg) => pkg.id === packageId);
  if (idx === -1) return undefined;
  const pkg = packages[idx];
  const archive: FinalContractArchive = {
    id: randomId('exec_archive'),
    packageId,
    contractId: pkg.contractId,
    archivedAt: nowIso(),
    archiveLocation: `local://archives/${pkg.contractId}/${packageId}`,
    documents: pkg.documents.map((doc) => ({ ...doc, status: 'archived', updatedAt: nowIso() }))
  };

  const archives = getArchives();
  saveArchives([archive, ...archives.filter((item) => item.packageId !== packageId)]);

  const updated: ExecutionPackage = {
    ...pkg,
    status: 'archived',
    archiveId: archive.id,
    documents: archive.documents,
    updatedAt: nowIso()
  };
  packages[idx] = updated;
  savePackages(packages);

  addActivityLog(pkg.contractId, {
    actor: 'Execution Service',
    event: 'comment',
    message: 'Final contract archive created.',
    action: 'Archive Final Contract',
    note: archive.archiveLocation,
    source: 'Workflow',
    labels: ['system generated', 'completed']
  });

  addAuditEvent({ packageId, actor: 'Execution Service', action: 'PACKAGE_ARCHIVED', note: `Archive ${archive.id} created.` });
  return archive;
};

export const getExecutionMetrics = (): ExecutionMetrics => {
  const packages = getExecutionPackages();
  const awaitingSignature = packages.filter((pkg) => pkg.status === 'sent' || pkg.status === 'partially_signed').length;
  const executedWithCycle = packages.filter((pkg) => pkg.executedAt && pkg.sentAt);
  const averageSignatureCycleDays =
    executedWithCycle.length === 0
      ? 0
      : Number(
          (
            executedWithCycle.reduce((sum, pkg) => {
              const sent = new Date(pkg.sentAt ?? nowIso()).getTime();
              const executed = new Date(pkg.executedAt ?? nowIso()).getTime();
              return sum + Math.max(0, (executed - sent) / (1000 * 60 * 60 * 24));
            }, 0) / executedWithCycle.length
          ).toFixed(1)
        );
  const executionBlockers = packages.filter((pkg) => pkg.status === 'draft' && pkg.signers.length === 0).length;
  const pendingSigners = packages.reduce((sum, pkg) => sum + pkg.signers.filter((signer) => signer.status === 'pending' || signer.status === 'sent').length, 0);
  const completedSigners = packages.reduce((sum, pkg) => sum + pkg.signers.filter((signer) => signer.status === 'completed').length, 0);
  return {
    totalPackages: packages.length,
    sentPackages: packages.filter((pkg) => pkg.status === 'sent' || pkg.status === 'partially_signed').length,
    executedPackages: packages.filter((pkg) => pkg.status === 'executed').length,
    archivedPackages: packages.filter((pkg) => pkg.status === 'archived').length,
    pendingSigners,
    completedSigners,
    awaitingSignature,
    averageSignatureCycleDays,
    executionBlockers
  };
};

export const getSupportedSignatureProviders = (): SignatureProvider[] => [
  'DocuSign',
  'Adobe Acrobat Sign',
  'PandaDoc',
  'Manual Upload',
  'Internal Approval Only'
];

export const getExecutionAuditEvents = (): SignatureAuditEvent[] => {
  seedExecutionData();
  return read<SignatureAuditEvent[]>(EXEC_AUDIT_KEY, []);
};

export const getExecutionAuditEventsByPackage = (packageId: string): SignatureAuditEvent[] =>
  getExecutionAuditEvents().filter((event) => event.packageId === packageId);

export const exportExecutionPackagesCsv = (): string => {
  const rows = getExecutionPackages();
  const headers = [
    'package_id',
    'contract_id',
    'provider',
    'status',
    'signer_progress',
    'sent_at',
    'executed_at',
    'archive_id',
    'updated_at'
  ];
  const esc = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;
  const csvRows = rows.map((pkg) =>
    [
      pkg.id,
      pkg.contractId,
      pkg.provider,
      pkg.status,
      `${pkg.signers.filter((s) => s.status === 'completed').length}/${pkg.signers.length}`,
      pkg.sentAt ?? '',
      pkg.executedAt ?? '',
      pkg.archiveId ?? '',
      pkg.updatedAt
    ]
      .map(esc)
      .join(',')
  );
  return [headers.map(esc).join(','), ...csvRows].join('\n');
};
