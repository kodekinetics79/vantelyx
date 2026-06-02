// Sprint 9 — Integrations Hub service (localStorage-backed, demo-safe).
// IMPORTANT: every connector here is simulated. No external systems are contacted,
// no OAuth flows run, and no real secrets are stored. Credential fields are placeholders.
//
// TODO(Integrations): real implementations to add behind these seams later:
// - OAuth 2.0 authorization-code + token refresh flows
// - Microsoft Graph API (SharePoint / OneDrive / Teams / Outlook)
// - SharePoint document library import + change tracking
// - Teams notification posting on workflow events
// - Outlook email ingestion for contract intake
// - DocuSign eSignature REST API (envelopes, recipients, webhooks)
// - Adobe Acrobat Sign API
// - Salesforce REST/Bulk API (opportunity-to-contract sync)
// - Microsoft Dynamics 365 API
// - SAP Ariba procurement API
// - NetSuite SuiteTalk / REST API
// - SAML 2.0 / OIDC federation for SSO
// - SCIM 2.0 user/group provisioning
// - Webhook signature verification (HMAC) and replay protection
// - Secrets manager integration (no plaintext credentials)
// - Tenant-specific connector configuration + isolation
// - Background workers for long-running syncs
// - Retry queues with exponential backoff
// - Rate-limit handling / throttling per provider
// - Connector health monitoring + alerting

import type {
  CreateSyncJobInput,
  IntegrationConnector,
  IntegrationEvent,
  IntegrationEventType,
  IntegrationHealth,
  IntegrationHealthSummary,
  IntegrationMetrics,
  IntegrationStatus,
  SyncDirection,
  SyncJob,
  WebhookEvent,
} from '../types/integrations';

const CONNECTORS_KEY = 'vantelyx_integration_connectors';
const SYNC_JOBS_KEY = 'vantelyx_integration_sync_jobs';
const EVENTS_KEY = 'vantelyx_integration_events';
const WEBHOOKS_KEY = 'vantelyx_integration_webhooks';

const hasStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage failures (private mode / quota) */
  }
};

const nowIso = (): string => new Date().toISOString();
const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number): string => new Date(Date.now() - h * 3_600_000).toISOString();
const genId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const isToday = (iso?: string): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const deriveHealth = (status: IntegrationStatus): IntegrationHealth => {
  switch (status) {
    case 'Connected':
      return 'Healthy';
    case 'Warning':
      return 'Needs Attention';
    case 'Error':
      return 'Failed';
    case 'Demo Mode':
      return 'Demo Only';
    default:
      return 'Not Tested';
  }
};

const credentialsForCategory = (category: IntegrationConnector['category']): IntegrationConnector['credentialPlaceholders'] => {
  switch (category) {
    case 'Identity & SSO':
      return [
        { field: 'tenantId', label: 'Tenant / Directory ID', placeholder: 'demo-tenant-id', secret: false },
        { field: 'clientSecret', label: 'Client Secret', placeholder: '•••••• (demo, not stored)', secret: true },
      ];
    case 'Webhooks / API':
      return [
        { field: 'endpoint', label: 'Endpoint URL', placeholder: 'https://demo.local/webhooks', secret: false },
        { field: 'signingSecret', label: 'Signing Secret', placeholder: '•••••• (demo, not stored)', secret: true },
      ];
    default:
      return [
        { field: 'clientId', label: 'Client ID', placeholder: 'demo-client-id', secret: false },
        { field: 'clientSecret', label: 'Client Secret', placeholder: '•••••• (demo, not stored)', secret: true },
      ];
  }
};

const defaultCapabilities = (
  category: IntegrationConnector['category'],
  supportsImport: boolean,
  supportsExport: boolean
): IntegrationConnector['capabilities'] => [
  { id: 'cap_import', label: 'Import documents/records', supported: supportsImport },
  { id: 'cap_export', label: 'Export documents/records', supported: supportsExport },
  { id: 'cap_webhooks', label: 'Webhook events', supported: category === 'Webhooks / API' || category === 'E-Signature' },
  { id: 'cap_sso', label: 'SSO / identity', supported: category === 'Identity & SSO' },
];

const defaultSetup = (status: IntegrationStatus): IntegrationConnector['setupRequirements'] => {
  const configured = status === 'Connected' || status === 'Warning' || status === 'Syncing';
  return [
    { id: 'req_auth', label: 'Authorize via OAuth 2.0', required: true, satisfied: configured, note: 'Demo placeholder — no real OAuth performed.' },
    { id: 'req_scope', label: 'Grant read/write scopes', required: true, satisfied: configured },
    { id: 'req_map', label: 'Configure field mapping', required: false, satisfied: status === 'Connected' },
  ];
};

type ConnectorSeed = {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationConnector['category'];
  description: string;
  status: IntegrationStatus;
  supportsImport?: boolean;
  supportsExport?: boolean;
  isImportSource?: boolean;
  isESignProvider?: boolean;
  lastSyncedAt?: string;
  lastTestedAt?: string;
  lastErrorMessage?: string;
  note?: string;
};

const buildConnector = (seed: ConnectorSeed): IntegrationConnector => {
  const supportsImport = seed.supportsImport ?? true;
  const supportsExport = seed.supportsExport ?? false;
  return {
    id: seed.id,
    name: seed.name,
    vendor: seed.vendor,
    category: seed.category,
    description: seed.description,
    status: seed.status,
    health: deriveHealth(seed.status),
    enabled: seed.status === 'Connected' || seed.status === 'Syncing' || seed.status === 'Warning',
    demoMode: seed.status === 'Demo Mode',
    supportsImport,
    supportsExport,
    isImportSource: seed.isImportSource ?? false,
    isESignProvider: seed.isESignProvider ?? false,
    capabilities: defaultCapabilities(seed.category, supportsImport, supportsExport),
    setupRequirements: defaultSetup(seed.status),
    credentialPlaceholders: credentialsForCategory(seed.category),
    mappings: [],
    lastTestedAt: seed.lastTestedAt,
    lastSyncedAt: seed.lastSyncedAt,
    lastError: seed.lastErrorMessage
      ? { code: 'DEMO_ERROR', message: seed.lastErrorMessage, occurredAt: hoursAgo(3) }
      : undefined,
    note: seed.note,
  };
};

const connectorCatalog = (): IntegrationConnector[] => {
  const seeds: ConnectorSeed[] = [
    // Document Storage
    { id: 'conn_sharepoint', name: 'Microsoft SharePoint', vendor: 'Microsoft', category: 'Document Storage', description: 'Document libraries and contract repositories.', status: 'Connected', isImportSource: true, supportsExport: true, lastSyncedAt: minutesAgo(35), lastTestedAt: hoursAgo(2), note: 'Primary document storage connector.' },
    { id: 'conn_onedrive', name: 'Microsoft OneDrive', vendor: 'Microsoft', category: 'Document Storage', description: 'Personal and shared file storage.', status: 'Connected', isImportSource: true, lastSyncedAt: hoursAgo(6) },
    { id: 'conn_gdrive', name: 'Google Drive', vendor: 'Google', category: 'Document Storage', description: 'Cloud document storage and import.', status: 'Available', isImportSource: true },
    { id: 'conn_box', name: 'Box', vendor: 'Box', category: 'Document Storage', description: 'Enterprise content management.', status: 'Warning', isImportSource: true, note: 'Token nearing expiry — re-authorize soon.' },
    { id: 'conn_dropbox', name: 'Dropbox', vendor: 'Dropbox', category: 'Document Storage', description: 'File hosting and sharing.', status: 'Demo Mode', isImportSource: true },

    // E-Signature
    { id: 'conn_docusign', name: 'DocuSign', vendor: 'DocuSign', category: 'E-Signature', description: 'Electronic signature envelopes and recipients.', status: 'Error', isESignProvider: true, supportsExport: true, lastTestedAt: hoursAgo(3), lastErrorMessage: 'Connection test failed: invalid integration key (demo).' },
    { id: 'conn_adobesign', name: 'Adobe Acrobat Sign', vendor: 'Adobe', category: 'E-Signature', description: 'Adobe electronic signature workflows.', status: 'Available', isESignProvider: true },
    { id: 'conn_pandadoc', name: 'PandaDoc', vendor: 'PandaDoc', category: 'E-Signature', description: 'Document and e-signature automation.', status: 'Demo Mode', isESignProvider: true },
    { id: 'conn_manualupload', name: 'Manual Upload', vendor: 'Vantelyx', category: 'E-Signature', description: 'Upload a signed PDF manually — always available.', status: 'Connected', isESignProvider: true, note: 'Always available fallback signing method.' },

    // Collaboration
    { id: 'conn_teams', name: 'Microsoft Teams', vendor: 'Microsoft', category: 'Collaboration', description: 'Channel notifications and approvals.', status: 'Connected', note: 'Notification placeholder connected.' },
    { id: 'conn_slack', name: 'Slack', vendor: 'Slack', category: 'Collaboration', description: 'Workspace notifications and alerts.', status: 'Warning', note: 'Channel mapping incomplete.' },

    // Email & Calendar
    { id: 'conn_outlook', name: 'Microsoft Outlook', vendor: 'Microsoft', category: 'Email & Calendar', description: 'Email ingestion and calendar events.', status: 'Connected', isImportSource: true, lastSyncedAt: hoursAgo(12) },
    { id: 'conn_gmail', name: 'Gmail', vendor: 'Google', category: 'Email & Calendar', description: 'Email ingestion for contract intake.', status: 'Not Configured', isImportSource: true },
    { id: 'conn_gcal', name: 'Google Calendar', vendor: 'Google', category: 'Email & Calendar', description: 'Renewal and obligation calendar sync.', status: 'Demo Mode' },

    // CRM
    { id: 'conn_salesforce', name: 'Salesforce', vendor: 'Salesforce', category: 'CRM', description: 'Opportunity-to-contract sync.', status: 'Warning', isImportSource: true, note: 'Credentials need review — re-enter client secret.' },
    { id: 'conn_hubspot', name: 'HubSpot', vendor: 'HubSpot', category: 'CRM', description: 'CRM deals and company records.', status: 'Available' },
    { id: 'conn_dyn365sales', name: 'Microsoft Dynamics 365 Sales', vendor: 'Microsoft', category: 'CRM', description: 'Sales pipeline and account sync.', status: 'Not Configured', isImportSource: true },

    // ERP / Procurement
    { id: 'conn_dyn365fin', name: 'Microsoft Dynamics 365 Finance', vendor: 'Microsoft', category: 'ERP / Procurement', description: 'Finance and vendor master data.', status: 'Available' },
    { id: 'conn_ariba', name: 'SAP Ariba', vendor: 'SAP', category: 'ERP / Procurement', description: 'Procurement and supplier management.', status: 'Disabled', note: 'Connector disabled by administrator.' },
    { id: 'conn_netsuite', name: 'NetSuite', vendor: 'Oracle', category: 'ERP / Procurement', description: 'ERP records and financials.', status: 'Error', lastTestedAt: hoursAgo(5), lastErrorMessage: 'Sync failed: endpoint unreachable (demo).' },
    { id: 'conn_oracleproc', name: 'Oracle Procurement', vendor: 'Oracle', category: 'ERP / Procurement', description: 'Procurement cloud integration.', status: 'Not Configured' },
    { id: 'conn_quickbooks', name: 'QuickBooks', vendor: 'Intuit', category: 'ERP / Procurement', description: 'Accounting and billing sync.', status: 'Demo Mode' },

    // Identity & SSO
    { id: 'conn_entra', name: 'Microsoft Entra ID / Azure AD', vendor: 'Microsoft', category: 'Identity & SSO', description: 'SSO and directory federation.', status: 'Connected', supportsImport: false, note: 'SSO placeholder connected.' },
    { id: 'conn_okta', name: 'Okta', vendor: 'Okta', category: 'Identity & SSO', description: 'Identity provider and SSO.', status: 'Not Configured', supportsImport: false },
    { id: 'conn_gworkspace', name: 'Google Workspace', vendor: 'Google', category: 'Identity & SSO', description: 'Workspace identity and SSO.', status: 'Available', supportsImport: false },
    { id: 'conn_saml', name: 'SAML 2.0', vendor: 'Standard', category: 'Identity & SSO', description: 'Generic SAML federation.', status: 'Available', supportsImport: false },
    { id: 'conn_scim', name: 'SCIM Provisioning', vendor: 'Standard', category: 'Identity & SSO', description: 'Automated user/group provisioning.', status: 'Not Configured', supportsImport: false },

    // Analytics
    { id: 'conn_powerbi', name: 'Power BI', vendor: 'Microsoft', category: 'Analytics', description: 'Contract analytics dashboards.', status: 'Warning', supportsExport: true, note: 'Dataset refresh failing intermittently.' },
    { id: 'conn_tableau', name: 'Tableau', vendor: 'Salesforce', category: 'Analytics', description: 'Visual analytics and reporting.', status: 'Available', supportsExport: true },
    { id: 'conn_snowflake', name: 'Snowflake', vendor: 'Snowflake', category: 'Analytics', description: 'Data warehouse export.', status: 'Demo Mode', supportsExport: true },

    // Webhooks / API
    { id: 'conn_restapi', name: 'REST API', vendor: 'Vantelyx', category: 'Webhooks / API', description: 'Programmatic access to contract data.', status: 'Connected', supportsExport: true },
    { id: 'conn_webhooks', name: 'Webhooks', vendor: 'Vantelyx', category: 'Webhooks / API', description: 'Outbound event notifications.', status: 'Connected', supportsExport: true, note: 'One recent delivery failed — see webhook events.' },
    { id: 'conn_zapier', name: 'Zapier', vendor: 'Zapier', category: 'Webhooks / API', description: 'No-code automation workflows.', status: 'Available' },
    { id: 'conn_make', name: 'Make', vendor: 'Make', category: 'Webhooks / API', description: 'Visual automation scenarios.', status: 'Not Configured' },
  ];
  return seeds.map(buildConnector);
};

const seedSyncJobs = (): SyncJob[] => [
  { id: 'sync_sp_1', connectorId: 'conn_sharepoint', connectorName: 'Microsoft SharePoint', direction: 'Import', status: 'Completed', recordsProcessed: 42, startedAt: minutesAgo(40), completedAt: minutesAgo(35), message: 'Imported 42 documents from contract library.' },
  { id: 'sync_od_1', connectorId: 'conn_onedrive', connectorName: 'Microsoft OneDrive', direction: 'Import', status: 'Completed', recordsProcessed: 8, startedAt: hoursAgo(6), completedAt: hoursAgo(6), message: 'Imported 8 files.' },
  { id: 'sync_sf_1', connectorId: 'conn_salesforce', connectorName: 'Salesforce', direction: 'Bidirectional', status: 'Failed', recordsProcessed: 0, startedAt: hoursAgo(4), completedAt: hoursAgo(4), message: 'Authentication error — credentials need review.' },
  { id: 'sync_ns_1', connectorId: 'conn_netsuite', connectorName: 'NetSuite', direction: 'Import', status: 'Failed', recordsProcessed: 0, startedAt: hoursAgo(5), completedAt: hoursAgo(5), message: 'Endpoint unreachable (demo).' },
  { id: 'sync_pb_1', connectorId: 'conn_powerbi', connectorName: 'Power BI', direction: 'Export', status: 'Cancelled', recordsProcessed: 0, startedAt: hoursAgo(8), completedAt: hoursAgo(8), message: 'Cancelled by user.' },
];

const seedWebhooks = (): WebhookEvent[] => [
  { id: 'wh_1', connectorId: 'conn_docusign', connectorName: 'DocuSign', eventName: 'envelope.completed', status: 'Failed', attempts: 3, receivedAt: hoursAgo(3), message: 'Delivery failed: signature verification error (demo).' },
  { id: 'wh_2', connectorId: 'conn_webhooks', connectorName: 'Webhooks', eventName: 'contract.executed', status: 'Processed', attempts: 1, receivedAt: hoursAgo(7) },
  { id: 'wh_3', connectorId: 'conn_sharepoint', connectorName: 'Microsoft SharePoint', eventName: 'document.created', status: 'Processed', attempts: 1, receivedAt: hoursAgo(9) },
];

const seedEvents = (): IntegrationEvent[] => [
  { id: genId('evt'), type: 'sync_completed', connectorId: 'conn_sharepoint', connectorName: 'Microsoft SharePoint', actor: 'System', message: 'SharePoint import completed (42 documents).', timestamp: minutesAgo(35), source: 'Integrations Hub' },
  { id: genId('evt'), type: 'connection_tested', connectorId: 'conn_docusign', connectorName: 'DocuSign', actor: 'System', message: 'DocuSign connection test failed (demo).', timestamp: hoursAgo(3), source: 'Integrations Hub' },
  { id: genId('evt'), type: 'webhook_failed', connectorId: 'conn_docusign', connectorName: 'DocuSign', actor: 'System', message: 'Webhook envelope.completed failed after 3 attempts.', timestamp: hoursAgo(3), source: 'Integrations Hub' },
  { id: genId('evt'), type: 'connector_enabled', connectorId: 'conn_teams', connectorName: 'Microsoft Teams', actor: 'System', message: 'Microsoft Teams connector enabled.', timestamp: hoursAgo(20), source: 'Integrations Hub' },
  { id: genId('evt'), type: 'connector_disabled', connectorId: 'conn_ariba', connectorName: 'SAP Ariba', actor: 'System', message: 'SAP Ariba connector disabled.', timestamp: hoursAgo(30), source: 'Integrations Hub' },
];

// ── Seeding ──────────────────────────────────────────────────────────────────
export const seedIntegrationData = (): IntegrationConnector[] => {
  const existing = read<IntegrationConnector[]>(CONNECTORS_KEY, []);
  if (existing.length > 0) {
    return existing; // do not duplicate seed data
  }
  const connectors = connectorCatalog();
  write(CONNECTORS_KEY, connectors);
  write(SYNC_JOBS_KEY, seedSyncJobs());
  write(WEBHOOKS_KEY, seedWebhooks());
  write(EVENTS_KEY, seedEvents());
  return connectors;
};

// ── Connectors ───────────────────────────────────────────────────────────────
export const getConnectors = (): IntegrationConnector[] => {
  const list = read<IntegrationConnector[]>(CONNECTORS_KEY, []);
  return list.length > 0 ? list : seedIntegrationData();
};

export const getConnectorById = (id: string): IntegrationConnector | undefined => {
  if (!id) return undefined;
  return getConnectors().find((c) => c.id === id);
};

export const getConnectorsByCategory = (category: IntegrationConnector['category']): IntegrationConnector[] =>
  getConnectors().filter((c) => c.category === category);

export const getEnabledConnectors = (): IntegrationConnector[] => getConnectors().filter((c) => c.enabled);

export const getConnectorHealthSummary = (): IntegrationHealthSummary => {
  const list = getConnectors();
  return {
    total: list.length,
    connected: list.filter((c) => c.status === 'Connected').length,
    needsAttention: list.filter((c) => c.health === 'Needs Attention').length,
    failed: list.filter((c) => c.health === 'Failed').length,
    demoMode: list.filter((c) => c.status === 'Demo Mode').length,
    disabled: list.filter((c) => c.status === 'Disabled').length,
    notConfigured: list.filter((c) => c.status === 'Not Configured').length,
  };
};

const persistConnectors = (list: IntegrationConnector[]): void => write(CONNECTORS_KEY, list);

const mutateConnector = (
  connectorId: string,
  mutator: (connector: IntegrationConnector) => IntegrationConnector
): IntegrationConnector | undefined => {
  const list = getConnectors();
  const index = list.findIndex((c) => c.id === connectorId);
  if (index < 0) return undefined;
  const updated = mutator(list[index]);
  list[index] = updated;
  persistConnectors(list);
  return updated;
};

export const updateConnectorStatus = (
  connectorId: string,
  status: IntegrationStatus,
  note?: string
): IntegrationConnector | undefined => {
  const updated = mutateConnector(connectorId, (c) => ({
    ...c,
    status,
    health: deriveHealth(status),
    enabled: status === 'Connected' || status === 'Syncing' || status === 'Warning',
    demoMode: status === 'Demo Mode',
    note: note ?? c.note,
  }));
  if (updated) {
    addIntegrationEvent({ type: 'status_updated', connectorId, message: `${updated.name} status changed to ${status}.` });
  }
  return updated;
};

export const enableConnector = (connectorId: string): IntegrationConnector | undefined => {
  const connector = getConnectorById(connectorId);
  if (!connector) return undefined;
  const updated = mutateConnector(connectorId, (c) => ({
    ...c,
    enabled: true,
    status: c.status === 'Disabled' || c.status === 'Not Configured' || c.status === 'Available' ? 'Connected' : c.status,
    health: c.status === 'Error' ? 'Failed' : 'Healthy',
  }));
  if (updated) {
    addIntegrationEvent({ type: 'connector_enabled', connectorId, message: `${updated.name} connector enabled.` });
  }
  return updated;
};

export const disableConnector = (connectorId: string): IntegrationConnector | undefined => {
  const updated = mutateConnector(connectorId, (c) => ({
    ...c,
    enabled: false,
    status: 'Disabled',
    health: 'Not Tested',
    demoMode: false,
  }));
  if (updated) {
    addIntegrationEvent({ type: 'connector_disabled', connectorId, message: `${updated.name} connector disabled.` });
  }
  return updated;
};

export const testConnection = (connectorId: string): { ok: boolean; message: string } => {
  const connector = getConnectorById(connectorId);
  if (!connector) {
    return { ok: false, message: 'Connector not found.' };
  }
  // Demo simulation: Error connectors fail; Not Configured cannot be tested; others pass.
  const tested = (ok: boolean): void => {
    mutateConnector(connectorId, (c) => ({
      ...c,
      lastTestedAt: nowIso(),
      health: ok ? (c.status === 'Demo Mode' ? 'Demo Only' : 'Healthy') : 'Failed',
    }));
    addIntegrationEvent({
      type: 'connection_tested',
      connectorId,
      message: `${connector.name} connection test ${ok ? 'succeeded' : 'failed'} (demo).`,
    });
  };

  if (connector.status === 'Error') {
    tested(false);
    return { ok: false, message: `${connector.name}: ${connector.lastError?.message ?? 'Connection test failed (demo).'}` };
  }
  if (connector.status === 'Not Configured' || connector.status === 'Available') {
    addIntegrationEvent({ type: 'connection_tested', connectorId, message: `${connector.name} test skipped — setup required.` });
    return { ok: false, message: `${connector.name} is not configured yet. Complete setup requirements first.` };
  }
  tested(true);
  return { ok: true, message: `${connector.name} connection test succeeded (demo).` };
};

// ── Sync jobs ────────────────────────────────────────────────────────────────
export const getSyncJobs = (): SyncJob[] => read<SyncJob[]>(SYNC_JOBS_KEY, []);

export const getSyncJobsByConnector = (connectorId: string): SyncJob[] =>
  getSyncJobs().filter((job) => job.connectorId === connectorId);

export const createSyncJob = (input: CreateSyncJobInput): SyncJob | undefined => {
  const connector = getConnectorById(input.connectorId);
  if (!connector) return undefined;
  const job: SyncJob = {
    id: genId('sync'),
    connectorId: connector.id,
    connectorName: connector.name,
    direction: input.direction ?? (connector.supportsExport && connector.supportsImport ? 'Bidirectional' : connector.supportsExport ? 'Export' : 'Import'),
    status: 'Queued',
    recordsProcessed: 0,
    startedAt: nowIso(),
    message: input.note,
  };
  const jobs = getSyncJobs();
  jobs.unshift(job);
  write(SYNC_JOBS_KEY, jobs.slice(0, 100));
  return job;
};

export const runDemoSync = (connectorId: string): SyncJob | undefined => {
  const connector = getConnectorById(connectorId);
  if (!connector) return undefined;

  const willFail = connector.status === 'Error' || connector.status === 'Disabled';
  const job = createSyncJob({ connectorId, note: 'Demo sync run from Integrations Hub.' });
  if (!job) return undefined;

  addIntegrationEvent({ type: 'sync_started', connectorId, message: `Demo sync started for ${connector.name}.` });

  const records = willFail ? 0 : Math.floor(Math.random() * 30) + 5;
  const completed: SyncJob = {
    ...job,
    status: willFail ? 'Failed' : 'Completed',
    recordsProcessed: records,
    completedAt: nowIso(),
    message: willFail
      ? `Demo sync failed for ${connector.name} (connector ${connector.status.toLowerCase()}).`
      : `Demo sync completed for ${connector.name}. ${records} records simulated. No external systems were contacted.`,
  };

  const jobs = getSyncJobs().map((j) => (j.id === job.id ? completed : j));
  write(SYNC_JOBS_KEY, jobs);

  if (willFail) {
    addIntegrationEvent({ type: 'sync_failed', connectorId, message: completed.message ?? 'Demo sync failed.' });
  } else {
    mutateConnector(connectorId, (c) => ({ ...c, lastSyncedAt: nowIso() }));
    addIntegrationEvent({ type: 'sync_completed', connectorId, message: completed.message ?? 'Demo sync completed.' });
  }
  return completed;
};

export const cancelSyncJob = (jobId: string): SyncJob | undefined => {
  const jobs = getSyncJobs();
  const index = jobs.findIndex((j) => j.id === jobId);
  if (index < 0) return undefined;
  const cancelled: SyncJob = { ...jobs[index], status: 'Cancelled', completedAt: nowIso(), message: 'Cancelled by user.' };
  jobs[index] = cancelled;
  write(SYNC_JOBS_KEY, jobs);
  addIntegrationEvent({ type: 'sync_cancelled', connectorId: cancelled.connectorId, message: `Sync cancelled for ${cancelled.connectorName}.` });
  return cancelled;
};

// ── Events / audit ───────────────────────────────────────────────────────────
export const getIntegrationEvents = (): IntegrationEvent[] => read<IntegrationEvent[]>(EVENTS_KEY, []);

export const addIntegrationEvent = (event: {
  type: IntegrationEventType;
  message: string;
  connectorId?: string;
  actor?: string;
}): IntegrationEvent => {
  const connector = event.connectorId ? getConnectorById(event.connectorId) : undefined;
  const entry: IntegrationEvent = {
    id: genId('evt'),
    type: event.type,
    connectorId: event.connectorId,
    connectorName: connector?.name,
    actor: event.actor ?? 'Current User',
    message: event.message,
    timestamp: nowIso(),
    source: 'Integrations Hub',
  };
  const events = getIntegrationEvents();
  events.unshift(entry);
  write(EVENTS_KEY, events.slice(0, 100));
  return entry;
};

// ── Webhooks ─────────────────────────────────────────────────────────────────
export const getWebhookEvents = (): WebhookEvent[] => read<WebhookEvent[]>(WEBHOOKS_KEY, []);

export const addWebhookEvent = (event: {
  connectorId: string;
  eventName: string;
  status?: WebhookEvent['status'];
  message?: string;
}): WebhookEvent => {
  const connector = getConnectorById(event.connectorId);
  const entry: WebhookEvent = {
    id: genId('wh'),
    connectorId: event.connectorId,
    connectorName: connector?.name ?? 'Unknown',
    eventName: event.eventName,
    status: event.status ?? 'Received',
    attempts: 1,
    receivedAt: nowIso(),
    message: event.message,
  };
  const events = getWebhookEvents();
  events.unshift(entry);
  write(WEBHOOKS_KEY, events.slice(0, 100));
  return entry;
};

export const retryWebhookEvent = (eventId: string): WebhookEvent | undefined => {
  const events = getWebhookEvents();
  const index = events.findIndex((e) => e.id === eventId);
  if (index < 0) return undefined;
  // TODO(Integrations): verify webhook signature before reprocessing on retry.
  const retried: WebhookEvent = {
    ...events[index],
    attempts: events[index].attempts + 1,
    status: 'Retrying',
    message: 'Retry attempted (demo). No external delivery performed.',
  };
  events[index] = retried;
  write(WEBHOOKS_KEY, events);
  addIntegrationEvent({ type: 'webhook_retry', connectorId: retried.connectorId, message: `Webhook retry attempted for ${retried.eventName}.` });
  return retried;
};

// ── Metrics ──────────────────────────────────────────────────────────────────
export const getIntegrationMetrics = (): IntegrationMetrics => {
  const connectors = getConnectors();
  const jobs = getSyncJobs();
  const webhooks = getWebhookEvents();
  const completed = jobs
    .filter((j) => j.status === 'Completed' && j.completedAt)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
  return {
    totalConnectors: connectors.length,
    connectedConnectors: connectors.filter((c) => c.status === 'Connected').length,
    needsAttention: connectors.filter((c) => c.health === 'Needs Attention').length,
    demoModeConnectors: connectors.filter((c) => c.status === 'Demo Mode').length,
    syncJobsToday: jobs.filter((j) => isToday(j.startedAt)).length,
    failedSyncJobs: jobs.filter((j) => j.status === 'Failed').length,
    failedWebhooks: webhooks.filter((w) => w.status === 'Failed').length,
    lastSuccessfulSyncAt: completed[0]?.completedAt,
  };
};

// ── Derived provider/source lists ─────────────────────────────────────────────
export type ProviderOption = {
  key: string;
  label: string;
  connectorId?: string;
  status: IntegrationStatus | 'Always Available';
  health: IntegrationHealth | 'Built-in';
  available: boolean;
  demoMode: boolean;
  setupRequired: boolean;
  note?: string;
};

const toProviderOption = (connector: IntegrationConnector): ProviderOption => ({
  key: connector.id,
  label: connector.name,
  connectorId: connector.id,
  status: connector.status,
  health: connector.health,
  available: connector.status === 'Connected',
  demoMode: connector.status === 'Demo Mode',
  setupRequired: connector.status === 'Not Configured' || connector.status === 'Available',
  note: connector.note,
});

export const getAvailableESignProviders = (): ProviderOption[] => {
  const providers = getConnectors().filter((c) => c.isESignProvider);
  return providers.map((c) =>
    c.id === 'conn_manualupload'
      ? { key: c.id, label: c.name, connectorId: c.id, status: 'Always Available', health: 'Built-in', available: true, demoMode: false, setupRequired: false, note: 'Always available.' }
      : toProviderOption(c)
  );
};

export const getAvailableStorageProviders = (): ProviderOption[] =>
  getConnectorsByCategory('Document Storage').map(toProviderOption);

export const getAvailableCollaborationProviders = (): ProviderOption[] =>
  getConnectorsByCategory('Collaboration').map(toProviderOption);

export const getAvailableImportSources = (): ProviderOption[] => {
  const localUpload: ProviderOption = {
    key: 'local_upload',
    label: 'Local Upload',
    status: 'Always Available',
    health: 'Built-in',
    available: true,
    demoMode: false,
    setupRequired: false,
    note: 'Always available.',
  };
  const wanted = ['conn_sharepoint', 'conn_onedrive', 'conn_gdrive', 'conn_box', 'conn_salesforce', 'conn_dyn365sales'];
  const connectorSources = wanted
    .map((id) => getConnectorById(id))
    .filter((c): c is IntegrationConnector => !!c)
    .map(toProviderOption);
  const outlook = getConnectorById('conn_outlook');
  const emailInbox: ProviderOption = outlook
    ? { ...toProviderOption(outlook), key: 'email_inbox', label: 'Email Inbox' }
    : { key: 'email_inbox', label: 'Email Inbox', status: 'Not Configured', health: 'Not Tested', available: false, demoMode: false, setupRequired: true };
  return [localUpload, ...connectorSources, emailInbox];
};
