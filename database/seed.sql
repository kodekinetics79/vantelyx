-- Demo seed data aligned with current frontend demo contracts
-- Safe to rerun with INSERT IGNORE on unique keys.

INSERT IGNORE INTO counterparties (
  id, name, type, risk_rating, total_contract_value, active_contracts, expired_contracts, pending_contracts,
  insurance_status, compliance_status, sanctions_status, document_completeness, relationship_owner,
  region, industry, risk_level, is_strategic
) VALUES
  ('cp_demo_001','Northstar Cloud LLC','vendor','high',650000,2,0,1,'pending_review','compliant','pending_screening','partial','Avery Morgan','US','Technology','high',1),
  ('cp_demo_002','Bluebridge Analytics GmbH','partner','medium',220000,1,0,1,'current','watch','pending_screening','complete','Riley Chen','EU','Analytics','medium',0),
  ('cp_demo_003','Orion Integrations Inc','partner','low',50000,1,0,0,'current','compliant','clear','partial','Jordan Patel','US','Integration','low',0);

INSERT IGNORE INTO contracts (
  id, counterparty_id, status, created_at, updated_at, risk_score,
  requester_name, requester_email, title, contract_type, counterparty_name, counterparty_region,
  estimated_value, currency, start_date, term_months, payment_terms, jurisdiction, auto_renew,
  department, priority, tags_json, metadata_json, notes
) VALUES
  ('ct_demo_001','cp_demo_001','internal_review','2026-05-12 00:00:00.000','2026-05-31 00:00:00.000',76,
   'Avery Morgan','avery.morgan@vantelyx.com','Cloud Hosting Renewal FY27','Vendor Agreement','Northstar Cloud LLC','US',
   650000,'USD','2026-05-12 00:00:00.000',24,'Net 30','Delaware',1,
   'Technology','high',JSON_ARRAY('Critical','AutoRenew'),JSON_OBJECT('source','seed'),'Critical service provider for production workloads.'),
  ('ct_demo_002','cp_demo_002','drafting','2026-05-27 00:00:00.000','2026-06-01 00:00:00.000',58,
   'Riley Chen','riley.chen@vantelyx.com','EMEA Data Processing Addendum','SOW','Bluebridge Analytics GmbH','EU',
   220000,'EUR','2026-05-27 00:00:00.000',12,'Net 45',NULL,0,
   'Data','medium',JSON_ARRAY('EU','DPA'),JSON_OBJECT('region','EMEA'),'Supports expansion into EU enterprise segment.'),
  ('ct_demo_003','cp_demo_003','executed','2026-06-01 00:00:00.000','2026-06-01 00:00:00.000',22,
   'Jordan Patel','jordan.patel@vantelyx.com','Mutual NDA for Strategic Partnership','NDA','Orion Integrations Inc','US',
   50000,'USD','2026-06-01 00:00:00.000',18,NULL,'California',0,
   'Sales','low',JSON_ARRAY('NDA'),JSON_OBJECT('stage','pre-sales'),'Pre-sales diligence and roadmap collaboration.');

INSERT IGNORE INTO approval_steps (id, contract_id, role, approver, decision, updated_at, note) VALUES
  ('appr_001','ct_demo_001','legal','Legal Reviewer','pending',NULL,NULL),
  ('appr_002','ct_demo_001','finance','Finance Controller','pending',NULL,NULL),
  ('appr_003','ct_demo_002','legal','Legal Reviewer','pending',NULL,NULL),
  ('appr_004','ct_demo_003','requestor','Jordan Patel','approved','2026-06-01 00:00:00.000','Intake submitted and confirmed.');

INSERT IGNORE INTO obligations (id, contract_id, title, owner, due_date, status, priority, note) VALUES
  ('obl_001','ct_demo_001','Confirm insurance certificates','Procurement','2026-06-15 00:00:00.000','open','high',NULL),
  ('obl_002','ct_demo_001','Validate billing schedule','Finance','2026-06-22 00:00:00.000','open','medium',NULL),
  ('obl_003','ct_demo_002','Run compliance audit checkpoint','Compliance','2026-07-20 00:00:00.000','open','high',NULL);

INSERT IGNORE INTO renewals (
  contract_id, auto_renew, renewal_date, notice_deadline, days_until_notice_deadline, renewal_owner,
  recommended_action, renewal_risk, commercial_impact, vendor_performance_note, notice_sent_at, status
) VALUES
  ('ct_demo_001',1,'2027-05-12 00:00:00.000','2027-02-11 00:00:00.000',255,'Avery Morgan',
   'Validate notice intent before auto-renew trigger.','high','High commercial exposure due to contract value and continuity dependency.','Performance tracking required before renewal decision.',NULL,'on_track'),
  ('ct_demo_002',0,'2027-05-27 00:00:00.000','2027-02-26 00:00:00.000',270,'Riley Chen',
   'Plan commercial renegotiation before notice window.','medium','Moderate commercial exposure with manageable continuity impact.','Monitor business outcomes against agreement scope.',NULL,'on_track'),
  ('ct_demo_003',0,'2027-12-01 00:00:00.000','2027-09-02 00:00:00.000',460,'Jordan Patel',
   'No action required this quarter.','low','Low commercial exposure.','NDA performance acceptable.',NULL,'on_track');

INSERT IGNORE INTO renewal_action_history (id, contract_id, action, note, actor, timestamp) VALUES
  ('ren_001','ct_demo_001','start_review','Renewal review initiated.','Workspace User','2026-06-01 08:15:00.000');

INSERT IGNORE INTO clause_signals (contract_id, clause, status, severity, message) VALUES
  ('ct_demo_001','Confidentiality','present','low','Standard confidentiality language detected.'),
  ('ct_demo_001','Limitation of Liability','needs_review','medium','Liability cap should be reviewed for high-value engagement.'),
  ('ct_demo_001','Governing Law','present','low','Jurisdiction specified as Delaware.'),
  ('ct_demo_002','Data Protection','needs_review','medium','GDPR obligations likely apply and should be validated.'),
  ('ct_demo_002','Payment Terms','present','low','Payment terms extracted: Net 45.'),
  ('ct_demo_003','Confidentiality','present','low','Standard confidentiality language detected.');

INSERT IGNORE INTO activity_logs (
  id, contract_id, timestamp, actor, event, message, action, previous_status, new_status, note, source, labels_json
) VALUES
  ('act_001','ct_demo_001','2026-05-12 00:00:00.000','AI Intake Engine','created','Contract created from intake with simulated AI extraction.','Intake Created','intake','drafting','Initial extraction completed.','AI Intake',JSON_ARRAY('system generated','review required')),
  ('act_002','ct_demo_001','2026-05-31 00:00:00.000','Workflow Engine','status_changed','Status changed to internal_review.','Status Update','drafting','internal_review','Submitted for legal review.','Workflow',JSON_ARRAY('system generated')),
  ('act_003','ct_demo_003','2026-06-01 00:00:00.000','Workflow Engine','status_changed','Status changed to executed.','Status Update','approved','executed','Contract fully executed.','Workflow',JSON_ARRAY('completed'));

INSERT IGNORE INTO document_intelligence (
  contract_id, document_name, document_type, extracted_parties_json, effective_date, expiration_date,
  governing_law, payment_terms, termination_rights, confidentiality, indemnity, limitation_of_liability,
  auto_renew_language, assignment_restriction, insurance_requirement, audit_rights,
  human_review_needed, human_review_reasons_json
) VALUES
  ('ct_demo_001','Cloud Hosting Renewal FY27.pdf','Vendor Agreement',JSON_ARRAY('Vantelyx, Inc.','Northstar Cloud LLC'),'2026-05-12 00:00:00.000','2028-05-12 00:00:00.000',
   'Delaware','Net 30','Termination for cause with 30-day cure period.','present','present','needs_review',
   'Auto-renewal language detected.','Assignment restricted without written consent.','General liability and cyber coverage required.','Audit rights included for security compliance.',
   1,JSON_ARRAY('High contract risk score','Liability language needs review')),
  ('ct_demo_002','EMEA Data Processing Addendum.pdf','SOW',JSON_ARRAY('Vantelyx, Inc.','Bluebridge Analytics GmbH'),'2026-05-27 00:00:00.000','2027-05-27 00:00:00.000',
   'Not explicitly identified','Net 45','Termination rights require legal validation.','present','missing','present',
   'No explicit auto-renew language detected.','Assignment restricted without consent.','Insurance language not clearly identified.','Audit rights not clearly identified.',
   1,JSON_ARRAY('Low AI confidence in governing law','Critical clause coverage is incomplete'));

INSERT IGNORE INTO document_intelligence_fields (contract_id, field_name, field_value, confidence) VALUES
  ('ct_demo_001','documentName','Cloud Hosting Renewal FY27.pdf',0.9600),
  ('ct_demo_001','governingLaw','Delaware',0.8900),
  ('ct_demo_001','paymentTerms','Net 30',0.9000),
  ('ct_demo_002','governingLaw','Not explicitly identified',0.5400),
  ('ct_demo_002','paymentTerms','Net 45',0.9000);

INSERT IGNORE INTO departments (id, name) VALUES
  ('dept_legal','Legal'),
  ('dept_technology','Technology'),
  ('dept_finance','Finance'),
  ('dept_sales','Sales'),
  ('dept_procurement','Procurement'),
  ('dept_executive','Executive'),
  ('dept_compliance','Compliance');

INSERT IGNORE INTO permissions (id, name, description) VALUES
  ('contracts.create','contracts.create','Create contracts from intake.'),
  ('contracts.view_all','contracts.view_all','View all contracts across departments.'),
  ('contracts.view_department','contracts.view_department','View contracts in assigned department.'),
  ('contracts.edit','contracts.edit','Edit contract records.'),
  ('contracts.delete','contracts.delete','Delete contract records.'),
  ('contracts.submit_review','contracts.submit_review','Submit contracts for review.'),
  ('contracts.approve','contracts.approve','Approve contracts in workflow.'),
  ('contracts.execute','contracts.execute','Mark contracts as executed.'),
  ('obligations.manage','obligations.manage','Manage obligations and completion state.'),
  ('renewals.manage','renewals.manage','Manage renewal actions.'),
  ('vendors.manage','vendors.manage','Manage counterparty records.'),
  ('reports.export','reports.export','Export analytics and audit CSV data.'),
  ('admin.manage_users','admin.manage_users','Manage users.'),
  ('admin.manage_roles','admin.manage_roles','Manage roles and assignments.'),
  ('admin.manage_policies','admin.manage_policies','Manage access policies.');

INSERT IGNORE INTO roles (id, name) VALUES
  ('role_system_admin','System Admin'),
  ('role_legal_admin','Legal Admin'),
  ('role_contract_manager','Contract Manager'),
  ('role_business_requester','Business Requester'),
  ('role_department_approver','Department Approver'),
  ('role_finance_reviewer','Finance Reviewer'),
  ('role_procurement_reviewer','Procurement Reviewer'),
  ('role_executive_approver','Executive Approver'),
  ('role_read_only_auditor','Read Only Auditor');

INSERT IGNORE INTO users (id, full_name, email, department_id, active) VALUES
  ('usr_admin','Alex Rivera','alex.rivera@vantelyx.com','dept_legal',1),
  ('usr_legal','Nina Patel','nina.patel@vantelyx.com','dept_legal',1),
  ('usr_mgr','Avery Morgan','avery.morgan@vantelyx.com','dept_technology',1),
  ('usr_req','Jordan Patel','jordan.patel@vantelyx.com','dept_sales',1),
  ('usr_fin','Chris Lin','chris.lin@vantelyx.com','dept_finance',1),
  ('usr_exec','Maya Chen','maya.chen@vantelyx.com','dept_executive',1),
  ('usr_audit','Taylor Grant','taylor.grant@vantelyx.com','dept_compliance',1);

INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_system_admin','contracts.create'),('role_system_admin','contracts.view_all'),('role_system_admin','contracts.view_department'),('role_system_admin','contracts.edit'),('role_system_admin','contracts.delete'),
  ('role_system_admin','contracts.submit_review'),('role_system_admin','contracts.approve'),('role_system_admin','contracts.execute'),('role_system_admin','obligations.manage'),('role_system_admin','renewals.manage'),
  ('role_system_admin','vendors.manage'),('role_system_admin','reports.export'),('role_system_admin','admin.manage_users'),('role_system_admin','admin.manage_roles'),('role_system_admin','admin.manage_policies'),
  ('role_legal_admin','contracts.create'),('role_legal_admin','contracts.view_all'),('role_legal_admin','contracts.edit'),('role_legal_admin','contracts.submit_review'),('role_legal_admin','contracts.approve'),
  ('role_legal_admin','contracts.execute'),('role_legal_admin','obligations.manage'),('role_legal_admin','renewals.manage'),('role_legal_admin','vendors.manage'),('role_legal_admin','reports.export'),('role_legal_admin','admin.manage_policies'),
  ('role_contract_manager','contracts.create'),('role_contract_manager','contracts.view_all'),('role_contract_manager','contracts.edit'),('role_contract_manager','contracts.submit_review'),('role_contract_manager','contracts.approve'),
  ('role_contract_manager','obligations.manage'),('role_contract_manager','renewals.manage'),('role_contract_manager','reports.export'),
  ('role_business_requester','contracts.create'),('role_business_requester','contracts.view_department'),('role_business_requester','contracts.submit_review'),
  ('role_department_approver','contracts.view_department'),('role_department_approver','contracts.approve'),
  ('role_finance_reviewer','contracts.view_all'),('role_finance_reviewer','contracts.approve'),('role_finance_reviewer','reports.export'),
  ('role_procurement_reviewer','contracts.view_all'),('role_procurement_reviewer','contracts.approve'),('role_procurement_reviewer','vendors.manage'),('role_procurement_reviewer','renewals.manage'),
  ('role_executive_approver','contracts.view_all'),('role_executive_approver','contracts.approve'),('role_executive_approver','contracts.execute'),('role_executive_approver','reports.export'),
  ('role_read_only_auditor','contracts.view_all'),('role_read_only_auditor','reports.export');

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES
  ('usr_admin','role_system_admin'),
  ('usr_legal','role_legal_admin'),
  ('usr_mgr','role_contract_manager'),
  ('usr_req','role_business_requester'),
  ('usr_fin','role_finance_reviewer'),
  ('usr_exec','role_executive_approver'),
  ('usr_audit','role_read_only_auditor');

INSERT IGNORE INTO access_policies (id, name, summary) VALUES
  ('pol_department_scope','Department Scope','Department-scoped visibility for non-global viewers.'),
  ('pol_approval_authority','Approval Authority','Approval requires permission and value/risk authority.'),
  ('pol_admin_controls','Admin Controls','Admin permissions govern user/role/policy management.');

INSERT IGNORE INTO delegations (id, from_user_id, to_user_id, starts_at, ends_at, status) VALUES
  ('del_001','usr_legal','usr_mgr','2026-06-01 00:00:00.000','2026-06-30 23:59:59.000','active');

INSERT IGNORE INTO approval_authorities (id, role_id, max_contract_value, can_approve_high_risk, department_ids_json) VALUES
  ('auth_legal_admin','role_legal_admin',2000000,1,JSON_ARRAY('dept_legal','dept_technology')),
  ('auth_manager','role_contract_manager',500000,0,JSON_ARRAY('dept_technology','dept_procurement')),
  ('auth_exec','role_executive_approver',10000000,1,JSON_ARRAY('dept_executive','dept_finance','dept_legal'));
