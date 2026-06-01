export type TemplateType =
  | 'NDA'
  | 'Master Services Agreement'
  | 'Software Subscription Agreement'
  | 'Vendor Agreement'
  | 'Purchase Agreement'
  | 'Government Services Agreement';

export type AuthoringRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ClauseCategory =
  | 'Confidentiality'
  | 'Indemnification'
  | 'Limitation of Liability'
  | 'Termination'
  | 'Renewal'
  | 'Payment Terms'
  | 'Data Protection'
  | 'Governing Law'
  | 'Insurance'
  | 'Assignment'
  | 'Audit Rights';

export type TemplateLibraryItem = {
  id: string;
  name: string;
  templateType: TemplateType;
  department: string;
  riskLevel: AuthoringRiskLevel;
  lastUpdated: string;
  legalApproved: boolean;
  usageCount: number;
};

export type ClauseLibraryItem = {
  id: string;
  clauseName: string;
  category: ClauseCategory;
  riskLevel: AuthoringRiskLevel;
  fallbackLanguageAvailable: boolean;
  legalApproved: boolean;
};

export type TemplateDraft = {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  counterparty: string;
  department: string;
  owner: string;
  status: 'draft' | 'converted';
  versionNumber: number;
  templateFields: Array<{
    id: string;
    label: string;
    value: string;
    placeholder: string;
  }>;
  clauses: Array<{
    id: string;
    clauseName: string;
    included: boolean;
    fallbackOption: string;
    riskLevel: AuthoringRiskLevel;
  }>;
  versions: Array<{
    id: string;
    versionNumber: number;
    note: string;
    createdAt: string;
  }>;
  negotiation: {
    comments: Array<{
      id: string;
      actor: string;
      message: string;
      createdAt: string;
    }>;
    redlines: Array<{
      id: string;
      summary: string;
      severity: AuthoringRiskLevel;
    }>;
  };
  executionChecklist: {
    legalApproved: boolean;
    businessApproved: boolean;
    financeApproved: boolean;
    vendorDetailsConfirmed: boolean;
    signaturePackageReady: boolean;
    finalPdfGenerated: boolean;
  };
  createdAt: string;
  updatedAt: string;
};
