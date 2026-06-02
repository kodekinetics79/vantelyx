import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plug, RefreshCw, ShieldAlert, Webhook, Zap } from 'lucide-react';
import {
  cancelSyncJob,
  disableConnector,
  enableConnector,
  getConnectors,
  getIntegrationEvents,
  getIntegrationMetrics,
  getSyncJobs,
  getWebhookEvents,
  retryWebhookEvent,
  runDemoSync,
  seedIntegrationData,
  testConnection,
  addIntegrationEvent,
} from '../services/integrationService';
import { canManageIntegrations } from '../services/securityService';
import type { IntegrationCategory, IntegrationHealth, IntegrationStatus } from '../types/integrations';

const CATEGORIES: Array<IntegrationCategory | 'All'> = [
  'All',
  'Document Storage',
  'E-Signature',
  'Collaboration',
  'Email & Calendar',
  'CRM',
  'ERP / Procurement',
  'Identity & SSO',
  'Analytics',
  'Webhooks / API',
];

const statusTone: Record<IntegrationStatus, string> = {
  Connected: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Available: 'bg-slate-50 text-slate-600 ring-slate-200',
  'Not Configured': 'bg-slate-50 text-slate-600 ring-slate-200',
  Disabled: 'bg-slate-100 text-slate-500 ring-slate-200',
  Syncing: 'bg-brand-50 text-brand-700 ring-brand-100',
  Warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  Error: 'bg-red-50 text-red-700 ring-red-100',
  'Demo Mode': 'bg-violet-50 text-violet-700 ring-violet-100',
};

const healthTone: Record<IntegrationHealth, string> = {
  Healthy: 'text-emerald-700',
  'Needs Attention': 'text-amber-700',
  Failed: 'text-red-700',
  'Not Tested': 'text-slate-500',
  'Demo Only': 'text-violet-700',
};

const formatDateTime = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export default function Integrations() {
  const [tick, setTick] = useState(0);
  const [category, setCategory] = useState<IntegrationCategory | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string>('');
  const [banner, setBanner] = useState<{ tone: 'ok' | 'warn' | 'error'; message: string } | null>(null);

  // seed once; getConnectors also self-seeds defensively
  useMemo(() => seedIntegrationData(), []);

  const connectors = useMemo(() => getConnectors(), [tick]);
  const metrics = useMemo(() => getIntegrationMetrics(), [tick]);
  const syncJobs = useMemo(() => getSyncJobs(), [tick]);
  const events = useMemo(() => getIntegrationEvents(), [tick]);
  const webhooks = useMemo(() => getWebhookEvents(), [tick]);
  const canManage = useMemo(() => canManageIntegrations(), [tick]);

  const filtered = useMemo(
    () => (category === 'All' ? connectors : connectors.filter((c) => c.category === category)),
    [connectors, category]
  );

  const selected = useMemo(() => connectors.find((c) => c.id === selectedId), [connectors, selectedId]);
  const refresh = () => setTick((value) => value + 1);

  const guard = (action: () => void) => {
    if (!canManage) {
      addIntegrationEvent({ type: 'permission_denied', message: 'Blocked: current role cannot manage connectors.' });
      setBanner({ tone: 'warn', message: 'Your role can view integrations but cannot change connector settings. Contact an administrator.' });
      return;
    }
    try {
      action();
    } catch {
      setBanner({ tone: 'error', message: 'Action failed in demo mode. No external systems were contacted.' });
    }
    refresh();
  };

  const onTest = (id: string) =>
    guard(() => {
      const result = testConnection(id);
      setBanner({ tone: result.ok ? 'ok' : 'error', message: result.message });
    });

  const onEnable = (id: string) => guard(() => { enableConnector(id); setBanner({ tone: 'ok', message: 'Connector enabled (demo).' }); });
  const onDisable = (id: string) => guard(() => { disableConnector(id); setBanner({ tone: 'ok', message: 'Connector disabled (demo).' }); });
  const onSync = (id: string) =>
    guard(() => {
      const job = runDemoSync(id);
      setBanner({
        tone: job?.status === 'Failed' ? 'error' : 'ok',
        message: job?.message ?? 'Demo sync simulated. No external systems were contacted.',
      });
    });
  const onCancelJob = (jobId: string) => guard(() => { cancelSyncJob(jobId); });
  const onRetryWebhook = (eventId: string) => guard(() => { retryWebhookEvent(eventId); setBanner({ tone: 'ok', message: 'Webhook retry attempted (demo).' }); });

  const bannerTone =
    banner?.tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : banner?.tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Integrations</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Integrations Hub</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Connect Vantelyx CLM with document storage, e-signature, CRM, ERP/procurement, identity &amp; SSO,
          collaboration, analytics, and webhook/API systems.
        </p>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Demo mode: all connectors are simulated. No credentials are stored and no external systems are contacted.
        </p>
        {!canManage ? (
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            View-only access: your role can review connectors but cannot change settings.
          </p>
        ) : null}
      </div>

      {banner ? (
        <div className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm font-semibold ${bannerTone}`}>
          <span>{banner.message}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-xs font-bold underline">Dismiss</button>
        </div>
      ) : null}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard icon={<Plug size={16} />} label="Total Connectors" value={metrics.totalConnectors} />
        <SummaryCard icon={<CheckCircle2 size={16} />} label="Connected" value={metrics.connectedConnectors} tone="emerald" />
        <SummaryCard icon={<ShieldAlert size={16} />} label="Needs Attention" value={metrics.needsAttention} tone="amber" />
        <SummaryCard icon={<RefreshCw size={16} />} label="Sync Jobs Today" value={metrics.syncJobsToday} />
        <SummaryCard icon={<Webhook size={16} />} label="Failed Webhooks" value={metrics.failedWebhooks} tone="red" />
        <SummaryCard icon={<Zap size={16} />} label="Demo Mode" value={metrics.demoModeConnectors} tone="violet" />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              category === cat ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Connector list */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Connector Catalog</h3>
            <span className="text-xs font-semibold text-slate-500">{filtered.length} connectors</span>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No connectors in this category yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => setSelectedId(connector.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                    selectedId === connector.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{connector.name}</p>
                    <p className="truncate text-xs text-slate-500">{connector.vendor} · {connector.category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${statusTone[connector.status]}`}>{connector.status}</span>
                    <span className={`text-[10px] font-bold ${healthTone[connector.health]}`}>{connector.health}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
              Select a connector to view details, setup requirements, and actions.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-black tracking-tight text-slate-900">{selected.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${statusTone[selected.status]}`}>{selected.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{selected.vendor} · {selected.category}</p>
                <p className="mt-2 text-sm text-slate-600">{selected.description}</p>
                {selected.note ? <p className="mt-2 text-xs font-semibold text-slate-500">{selected.note}</p> : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info label="Health" value={selected.health} valueClass={healthTone[selected.health]} />
                <Info label="Enabled" value={selected.enabled ? 'Yes' : 'No'} />
                <Info label="Last Tested" value={formatDateTime(selected.lastTestedAt)} />
                <Info label="Last Synced" value={formatDateTime(selected.lastSyncedAt)} />
              </div>

              {selected.lastError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <span className="font-bold">Last error:</span> {selected.lastError.message}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onTest(selected.id)} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700">Test Connection</button>
                {selected.enabled ? (
                  <button type="button" onClick={() => onDisable(selected.id)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Disable</button>
                ) : (
                  <button type="button" onClick={() => onEnable(selected.id)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Enable</button>
                )}
                <button type="button" onClick={() => onSync(selected.id)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Run Demo Sync</button>
              </div>

              {/* Setup requirements */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Setup Requirements</p>
                <div className="space-y-1.5">
                  {selected.setupRequirements.length === 0 ? (
                    <p className="text-xs text-slate-500">No setup requirements.</p>
                  ) : (
                    selected.setupRequirements.map((req) => (
                      <div key={req.id} className="flex items-center gap-2 text-xs">
                        {req.satisfied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <AlertTriangle size={13} className="text-amber-600" />}
                        <span className={req.satisfied ? 'text-slate-600' : 'text-slate-700'}>{req.label}</span>
                        {req.required ? <span className="text-[10px] font-bold text-slate-400">required</span> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Credential placeholders */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Credentials (demo placeholders)</p>
                <div className="space-y-2">
                  {selected.credentialPlaceholders.map((cred) => (
                    <label key={cred.field} className="block text-xs font-semibold text-slate-600">
                      {cred.label}
                      <input
                        type={cred.secret ? 'password' : 'text'}
                        value={cred.placeholder}
                        readOnly
                        className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500"
                      />
                    </label>
                  ))}
                  <p className="text-[11px] text-slate-400">No credentials are stored. Demo placeholders only.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Sync jobs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Sync Jobs</h3>
          {syncJobs.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No sync jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {syncJobs.slice(0, 8).map((job) => (
                <div key={job.id} className="rounded-md border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{job.connectorName}</span>
                    <span className={`font-bold ${job.status === 'Failed' ? 'text-red-700' : job.status === 'Completed' ? 'text-emerald-700' : job.status === 'Cancelled' ? 'text-slate-500' : 'text-brand-700'}`}>{job.status}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{job.direction} · {job.recordsProcessed} records · {formatDateTime(job.startedAt)}</p>
                  {(job.status === 'Queued' || job.status === 'Running') ? (
                    <button type="button" onClick={() => onCancelJob(job.id)} className="mt-1 text-[11px] font-bold text-slate-600 underline">Cancel</button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent events */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Recent Integration Events</h3>
          {events.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No integration events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-md border border-slate-200 p-3 text-xs">
                  <p className="font-bold text-slate-900">{event.message}</p>
                  <p className="mt-1 text-slate-500">{event.actor} · {formatDateTime(event.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhook events */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Webhook Events</h3>
          {webhooks.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No webhook events yet.</p>
          ) : (
            <div className="space-y-2">
              {webhooks.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-md border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{event.eventName}</span>
                    <span className={`font-bold ${event.status === 'Failed' ? 'text-red-700' : event.status === 'Processed' ? 'text-emerald-700' : 'text-amber-700'}`}>{event.status}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{event.connectorName} · {event.attempts} attempt(s) · {formatDateTime(event.receivedAt)}</p>
                  {event.status === 'Failed' ? (
                    <button type="button" onClick={() => onRetryWebhook(event.id)} className="mt-1 text-[11px] font-bold text-brand-600 underline">Retry</button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Future integration notes */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Future Integration Notes</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Production connectors will use OAuth 2.0, Microsoft Graph (SharePoint/Teams/Outlook), DocuSign &amp; Adobe Sign APIs,
          Salesforce/Dynamics/SAP Ariba/NetSuite APIs, SAML/OIDC SSO, SCIM provisioning, signed webhooks, a secrets manager,
          tenant-specific configuration, background workers, retry queues, and rate-limit handling. No external calls are made in this demo.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'emerald' | 'amber' | 'red' | 'violet' }) {
  const chip =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-600'
      : tone === 'amber' ? 'bg-amber-50 text-amber-600'
      : tone === 'red' ? 'bg-red-50 text-red-600'
      : tone === 'violet' ? 'bg-violet-50 text-violet-600'
      : 'bg-brand-50 text-brand-600';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-md p-1.5 ${chip}`}>{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 font-bold ${valueClass ?? 'text-slate-700'}`}>{value}</p>
    </div>
  );
}
