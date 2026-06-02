// Sprint 9 — Integrations Hub types.
// All connectors are simulated/demo-safe. No real external calls, no real secrets.

export type IntegrationCategory =
  | 'Document Storage'
  | 'E-Signature'
  | 'Collaboration'
  | 'Email & Calendar'
  | 'CRM'
  | 'ERP / Procurement'
  | 'Identity & SSO'
  | 'Analytics'
  | 'Webhooks / API';

export type IntegrationStatus =
  | 'Not Configured'
  | 'Available'
  | 'Connected'
  | 'Disabled'
  | 'Syncing'
  | 'Warning'
  | 'Error'
  | 'Demo Mode';

export type IntegrationHealth =
  | 'Healthy'
  | 'Needs Attention'
  | 'Failed'
  | 'Not Tested'
  | 'Demo Only';

export type SyncJobStatus =
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type SyncDirection = 'Import' | 'Export' | 'Bidirectional';

export type IntegrationEventType =
  | 'connector_enabled'
  | 'connector_disabled'
  | 'connection_tested'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'sync_cancelled'
  | 'webhook_received'
  | 'webhook_failed'
  | 'webhook_retry'
  | 'import_source_selected'
  | 'esign_provider_selected'
  | 'status_updated'
  | 'permission_denied';

export type WebhookEventStatus = 'Received' | 'Processed' | 'Failed' | 'Retrying';

export type IntegrationProvider = {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  description: string;
  docsUrl?: string;
};

export type IntegrationCapability = {
  id: string;
  label: string;
  supported: boolean;
};

export type IntegrationSetupRequirement = {
  id: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  note?: string;
};

export type IntegrationCredentialPlaceholder = {
  field: string;
  label: string;
  placeholder: string;
  // Demo-safe: never holds a real secret value.
  secret: boolean;
};

export type IntegrationMapping = {
  id: string;
  sourceField: string;
  targetField: string;
  note?: string;
};

export type IntegrationError = {
  code: string;
  message: string;
  occurredAt: string;
};

export type IntegrationConnector = {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  description: string;
  status: IntegrationStatus;
  health: IntegrationHealth;
  enabled: boolean;
  demoMode: boolean;
  supportsImport: boolean;
  supportsExport: boolean;
  isImportSource: boolean;
  isESignProvider: boolean;
  capabilities: IntegrationCapability[];
  setupRequirements: IntegrationSetupRequirement[];
  credentialPlaceholders: IntegrationCredentialPlaceholder[];
  mappings: IntegrationMapping[];
  lastTestedAt?: string;
  lastSyncedAt?: string;
  lastError?: IntegrationError;
  note?: string;
  docsUrl?: string;
};

export type SyncJob = {
  id: string;
  connectorId: string;
  connectorName: string;
  direction: SyncDirection;
  status: SyncJobStatus;
  recordsProcessed: number;
  startedAt: string;
  completedAt?: string;
  message?: string;
};

export type WebhookEvent = {
  id: string;
  connectorId: string;
  connectorName: string;
  eventName: string;
  status: WebhookEventStatus;
  attempts: number;
  receivedAt: string;
  message?: string;
};

export type IntegrationEvent = {
  id: string;
  type: IntegrationEventType;
  connectorId?: string;
  connectorName?: string;
  actor: string;
  message: string;
  timestamp: string;
  source: 'Integrations Hub';
};

export type IntegrationAuditEntry = IntegrationEvent;

export type IntegrationHealthSummary = {
  total: number;
  connected: number;
  needsAttention: number;
  failed: number;
  demoMode: number;
  disabled: number;
  notConfigured: number;
};

export type IntegrationMetrics = {
  totalConnectors: number;
  connectedConnectors: number;
  needsAttention: number;
  demoModeConnectors: number;
  syncJobsToday: number;
  failedSyncJobs: number;
  failedWebhooks: number;
  lastSuccessfulSyncAt?: string;
};

export type CreateSyncJobInput = {
  connectorId: string;
  direction?: SyncDirection;
  note?: string;
};
