import type { ClauseLibraryItem, TemplateDraft, TemplateLibraryItem } from '../types/authoring';

const TEMPLATE_LIBRARY_KEY = 'vantelyx_template_library';
const CLAUSE_LIBRARY_KEY = 'vantelyx_clause_library';
const TEMPLATE_DRAFTS_KEY = 'vantelyx_template_drafts';

const nowIso = (): string => new Date().toISOString();

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
  window.localStorage.setItem(key, JSON.stringify(value));
};

const defaultTemplateLibrary = (): TemplateLibraryItem[] => [
  {
    id: 'tpl_nda',
    name: 'Mutual NDA Standard',
    templateType: 'NDA',
    department: 'Legal',
    riskLevel: 'low',
    lastUpdated: nowIso(),
    legalApproved: true,
    usageCount: 132
  },
  {
    id: 'tpl_msa',
    name: 'Master Services Agreement Core',
    templateType: 'Master Services Agreement',
    department: 'Legal',
    riskLevel: 'medium',
    lastUpdated: nowIso(),
    legalApproved: true,
    usageCount: 88
  },
  {
    id: 'tpl_ssa',
    name: 'Software Subscription Enterprise',
    templateType: 'Software Subscription Agreement',
    department: 'Technology',
    riskLevel: 'medium',
    lastUpdated: nowIso(),
    legalApproved: true,
    usageCount: 74
  },
  {
    id: 'tpl_vendor',
    name: 'Vendor Agreement Risk-Controlled',
    templateType: 'Vendor Agreement',
    department: 'Procurement',
    riskLevel: 'high',
    lastUpdated: nowIso(),
    legalApproved: false,
    usageCount: 61
  },
  {
    id: 'tpl_purchase',
    name: 'Purchase Agreement Standard',
    templateType: 'Purchase Agreement',
    department: 'Finance',
    riskLevel: 'medium',
    lastUpdated: nowIso(),
    legalApproved: true,
    usageCount: 47
  },
  {
    id: 'tpl_gov',
    name: 'Government Services Agreement Public Sector',
    templateType: 'Government Services Agreement',
    department: 'Public Sector',
    riskLevel: 'critical',
    lastUpdated: nowIso(),
    legalApproved: false,
    usageCount: 19
  }
];

const defaultClauseLibrary = (): ClauseLibraryItem[] => [
  { id: 'cl_conf', clauseName: 'Confidentiality', category: 'Confidentiality', riskLevel: 'low', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_ind', clauseName: 'Indemnification', category: 'Indemnification', riskLevel: 'high', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_lol', clauseName: 'Liability Cap', category: 'Limitation of Liability', riskLevel: 'high', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_term', clauseName: 'Termination for Convenience', category: 'Termination', riskLevel: 'medium', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_ren', clauseName: 'Auto-Renewal Controls', category: 'Renewal', riskLevel: 'high', fallbackLanguageAvailable: true, legalApproved: false },
  { id: 'cl_pay', clauseName: 'Payment Terms Net 30', category: 'Payment Terms', riskLevel: 'medium', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_dpa', clauseName: 'Data Processing Addendum', category: 'Data Protection', riskLevel: 'critical', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_law', clauseName: 'Governing Law', category: 'Governing Law', riskLevel: 'low', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_ins', clauseName: 'Insurance Requirement', category: 'Insurance', riskLevel: 'medium', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_asg', clauseName: 'Assignment Restriction', category: 'Assignment', riskLevel: 'medium', fallbackLanguageAvailable: true, legalApproved: true },
  { id: 'cl_aud', clauseName: 'Audit Rights', category: 'Audit Rights', riskLevel: 'high', fallbackLanguageAvailable: true, legalApproved: false }
];

const baseFieldsByTemplate: Record<string, Array<{ id: string; label: string; placeholder: string }>> = {
  tpl_nda: [
    { id: 'effective_date', label: 'Effective Date', placeholder: '2026-06-01' },
    { id: 'term_months', label: 'Term (Months)', placeholder: '24' },
    { id: 'governing_law', label: 'Governing Law', placeholder: 'Delaware' }
  ],
  tpl_msa: [
    { id: 'service_scope', label: 'Service Scope', placeholder: 'Managed services and support' },
    { id: 'payment_terms', label: 'Payment Terms', placeholder: 'Net 30' },
    { id: 'liability_cap', label: 'Liability Cap', placeholder: '12 months fees paid' }
  ],
  tpl_ssa: [
    { id: 'subscription_tier', label: 'Subscription Tier', placeholder: 'Enterprise' },
    { id: 'data_residency', label: 'Data Residency', placeholder: 'US-East' },
    { id: 'sla_uptime', label: 'SLA Uptime', placeholder: '99.9%' }
  ],
  tpl_vendor: [
    { id: 'vendor_services', label: 'Vendor Services', placeholder: 'Cloud platform operations' },
    { id: 'insurance_requirements', label: 'Insurance Requirements', placeholder: '$5M aggregate liability' },
    { id: 'security_controls', label: 'Security Controls', placeholder: 'SOC 2 Type II + ISO 27001' }
  ],
  tpl_purchase: [
    { id: 'purchase_items', label: 'Purchase Items', placeholder: 'Hardware and maintenance' },
    { id: 'delivery_terms', label: 'Delivery Terms', placeholder: 'FOB destination' },
    { id: 'warranty_term', label: 'Warranty Term', placeholder: '12 months' }
  ],
  tpl_gov: [
    { id: 'agency', label: 'Agency', placeholder: 'State IT Procurement Office' },
    { id: 'compliance_framework', label: 'Compliance Framework', placeholder: 'FedRAMP Moderate' },
    { id: 'records_retention', label: 'Records Retention', placeholder: '7 years' }
  ]
};

const buildDraft = (template: TemplateLibraryItem): TemplateDraft => {
  const now = nowIso();
  const templateFields = (baseFieldsByTemplate[template.id] ?? baseFieldsByTemplate.tpl_nda).map((field) => ({
    ...field,
    value: ''
  }));
  const clauses = defaultClauseLibrary().slice(0, 8).map((clause) => ({
    id: `${template.id}_${clause.id}`,
    clauseName: clause.clauseName,
    included: true,
    fallbackOption: clause.fallbackLanguageAvailable
      ? `Fallback for ${clause.clauseName} is available in legal playbook.`
      : 'No fallback provided.',
    riskLevel: clause.riskLevel
  }));

  return {
    id: `draft_${Math.random().toString(36).slice(2, 10)}`,
    templateId: template.id,
    templateName: template.name,
    title: `${template.templateType} Draft`,
    counterparty: 'Counterparty TBD',
    department: template.department,
    owner: 'Workspace User',
    status: 'draft',
    versionNumber: 1,
    templateFields,
    clauses,
    versions: [{ id: `ver_${Math.random().toString(36).slice(2, 10)}`, versionNumber: 1, note: 'Initial draft created from template.', createdAt: now }],
    negotiation: {
      comments: [
        {
          id: `cmt_${Math.random().toString(36).slice(2, 10)}`,
          actor: 'AI Assistant',
          message: 'Initial clause package generated from approved template.',
          createdAt: now
        }
      ],
      redlines: [
        { id: `rl_${Math.random().toString(36).slice(2, 10)}`, summary: 'Limitation of liability cap adjusted to playbook standard.', severity: 'medium' }
      ]
    },
    executionChecklist: {
      legalApproved: false,
      businessApproved: false,
      financeApproved: false,
      vendorDetailsConfirmed: false,
      signaturePackageReady: false,
      finalPdfGenerated: false
    },
    createdAt: now,
    updatedAt: now
  };
};

const normalizeDraft = (draft: TemplateDraft): TemplateDraft => {
  if ('versionNumber' in draft && draft.versionNumber) {
    return draft;
  }
  const template = getTemplateLibrary().find((item) => item.id === draft.templateId);
  const fallback = buildDraft(
    template ?? {
      id: draft.templateId,
      name: draft.templateName,
      templateType: 'NDA',
      department: 'Legal',
      riskLevel: 'low',
      lastUpdated: draft.updatedAt,
      legalApproved: true,
      usageCount: 0
    }
  );
  return {
    ...fallback,
    ...draft,
    title: draft.templateName,
    counterparty: 'Counterparty TBD',
    department: template?.department ?? 'Legal',
    owner: 'Workspace User'
  };
};

export const seedTemplateStudioData = (): void => {
  const templates = read<TemplateLibraryItem[]>(TEMPLATE_LIBRARY_KEY, []);
  if (templates.length === 0) {
    write(TEMPLATE_LIBRARY_KEY, defaultTemplateLibrary());
  }

  const clauses = read<ClauseLibraryItem[]>(CLAUSE_LIBRARY_KEY, []);
  if (clauses.length === 0) {
    write(CLAUSE_LIBRARY_KEY, defaultClauseLibrary());
  }

  const drafts = read<TemplateDraft[]>(TEMPLATE_DRAFTS_KEY, []);
  if (drafts.length === 0) {
    write(TEMPLATE_DRAFTS_KEY, []);
  }
};

export const getTemplateLibrary = (): TemplateLibraryItem[] => {
  seedTemplateStudioData();
  return read<TemplateLibraryItem[]>(TEMPLATE_LIBRARY_KEY, []);
};

export const getClauseLibrary = (): ClauseLibraryItem[] => {
  seedTemplateStudioData();
  return read<ClauseLibraryItem[]>(CLAUSE_LIBRARY_KEY, []);
};

export const getTemplateDrafts = (): TemplateDraft[] => {
  seedTemplateStudioData();
  const drafts = read<TemplateDraft[]>(TEMPLATE_DRAFTS_KEY, []).map(normalizeDraft);
  write(TEMPLATE_DRAFTS_KEY, drafts);
  return drafts;
};

export const createTemplateDraft = (templateId: string): TemplateDraft | null => {
  seedTemplateStudioData();
  const templates = read<TemplateLibraryItem[]>(TEMPLATE_LIBRARY_KEY, []);
  const template = templates.find((entry) => entry.id === templateId);
  if (!template) {
    return null;
  }

  const now = nowIso();
  const draft = buildDraft(template);

  const drafts = read<TemplateDraft[]>(TEMPLATE_DRAFTS_KEY, []);
  write(TEMPLATE_DRAFTS_KEY, [draft, ...drafts]);

  const updatedTemplates = templates.map((entry) =>
    entry.id === template.id
      ? { ...entry, usageCount: entry.usageCount + 1, lastUpdated: now }
      : entry
  );
  write(TEMPLATE_LIBRARY_KEY, updatedTemplates);

  return draft;
};

export const getTemplateDraftById = (draftId: string): TemplateDraft | null => {
  const drafts = getTemplateDrafts();
  return drafts.find((draft) => draft.id === draftId) ?? null;
};

export const getMostRecentTemplateDraft = (): TemplateDraft | null => {
  const drafts = getTemplateDrafts();
  if (drafts.length === 0) return null;
  return [...drafts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
};

export const updateTemplateDraft = (draftId: string, update: Partial<TemplateDraft>): TemplateDraft | null => {
  const drafts = getTemplateDrafts();
  const existing = drafts.find((draft) => draft.id === draftId);
  if (!existing) return null;
  const updated: TemplateDraft = {
    ...existing,
    ...update,
    updatedAt: nowIso()
  };
  write(
    TEMPLATE_DRAFTS_KEY,
    drafts.map((draft) => (draft.id === draftId ? updated : draft))
  );
  return updated;
};

export const addTemplateDraftVersion = (draftId: string, note: string): TemplateDraft | null => {
  const draft = getTemplateDraftById(draftId);
  if (!draft) return null;
  const nextVersion = draft.versionNumber + 1;
  return updateTemplateDraft(draftId, {
    versionNumber: nextVersion,
    versions: [
      {
        id: `ver_${Math.random().toString(36).slice(2, 10)}`,
        versionNumber: nextVersion,
        note,
        createdAt: nowIso()
      },
      ...draft.versions
    ]
  });
};

export const addTemplateNegotiationComment = (draftId: string, message: string, actor = 'Workspace User'): TemplateDraft | null => {
  const draft = getTemplateDraftById(draftId);
  if (!draft) return null;
  return updateTemplateDraft(draftId, {
    negotiation: {
      ...draft.negotiation,
      comments: [
        {
          id: `cmt_${Math.random().toString(36).slice(2, 10)}`,
          actor,
          message,
          createdAt: nowIso()
        },
        ...draft.negotiation.comments
      ]
    }
  });
};

export const markTemplateDraftConverted = (draftId: string): TemplateDraft | null => {
  const draft = getTemplateDraftById(draftId);
  if (!draft) return null;
  return updateTemplateDraft(draftId, { status: 'converted' });
};
