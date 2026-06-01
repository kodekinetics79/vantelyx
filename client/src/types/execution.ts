export type SignatureProvider =
  | 'DocuSign'
  | 'Adobe Acrobat Sign'
  | 'PandaDoc'
  | 'Manual Upload'
  | 'Internal Approval Only';

export type Signer = {
  id: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: 'pending' | 'sent' | 'completed' | 'declined';
  completedAt?: string;
};

export type SignatureStep = {
  id: string;
  signerId: string;
  order: number;
  status: 'pending' | 'sent' | 'completed' | 'declined';
  note?: string;
  updatedAt: string;
};

export type ExecutionDocument = {
  id: string;
  packageId: string;
  name: string;
  type: 'main_contract' | 'exhibit' | 'attachment' | 'signature_certificate';
  status: 'draft' | 'sent' | 'signed' | 'archived';
  uri?: string;
  createdAt: string;
  updatedAt: string;
};

export type SignatureAuditEvent = {
  id: string;
  packageId: string;
  timestamp: string;
  actor: string;
  action: string;
  note?: string;
};

export type FinalContractArchive = {
  id: string;
  packageId: string;
  contractId: string;
  archivedAt: string;
  archiveLocation: string;
  documents: ExecutionDocument[];
};

export type ExecutionPackage = {
  id: string;
  contractId: string;
  provider: SignatureProvider;
  status: 'draft' | 'sent' | 'partially_signed' | 'executed' | 'archived';
  signers: Signer[];
  signatureSteps: SignatureStep[];
  documents: ExecutionDocument[];
  sentAt?: string;
  executedAt?: string;
  archiveId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionMetrics = {
  totalPackages: number;
  sentPackages: number;
  executedPackages: number;
  archivedPackages: number;
  pendingSigners: number;
  completedSigners: number;
  awaitingSignature: number;
  averageSignatureCycleDays: number;
  executionBlockers: number;
};
