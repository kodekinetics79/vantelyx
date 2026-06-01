-- Vantelyx CLM MySQL schema aligned to frontend CLM model
-- TODO(MySQL): Add Flyway/Liquibase migrations and versioning strategy.

CREATE TABLE IF NOT EXISTS counterparties (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('vendor','customer','partner','government','subcontractor') NOT NULL,
  risk_rating ENUM('low','medium','high','critical') NOT NULL,
  total_contract_value DECIMAL(18,2) NOT NULL DEFAULT 0,
  active_contracts INT NOT NULL DEFAULT 0,
  expired_contracts INT NOT NULL DEFAULT 0,
  pending_contracts INT NOT NULL DEFAULT 0,
  insurance_status ENUM('current','missing','expired','pending_review') NOT NULL,
  compliance_status ENUM('compliant','watch','non_compliant','pending_review') NOT NULL,
  sanctions_status ENUM('clear','watchlist_hit','pending_screening') NOT NULL,
  document_completeness ENUM('complete','partial','missing') NOT NULL,
  relationship_owner VARCHAR(255) NOT NULL,
  region VARCHAR(100),
  industry VARCHAR(100),
  risk_level ENUM('low','medium','high','critical') NOT NULL,
  is_strategic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_counterparties_name (name),
  INDEX idx_counterparties_risk (risk_rating)
);

CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(64) PRIMARY KEY,
  counterparty_id VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  risk_score INT NOT NULL,

  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  contract_type VARCHAR(120) NOT NULL,
  counterparty_name VARCHAR(255) NOT NULL,
  counterparty_region VARCHAR(120) NOT NULL,
  estimated_value DECIMAL(18,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  start_date DATETIME(3) NOT NULL,
  term_months INT NOT NULL,
  payment_terms VARCHAR(255),
  jurisdiction VARCHAR(255),
  auto_renew BOOLEAN,
  department VARCHAR(255),
  priority VARCHAR(32),
  tags_json JSON,
  metadata_json JSON,
  notes TEXT,

  CONSTRAINT fk_contracts_counterparty FOREIGN KEY (counterparty_id) REFERENCES counterparties(id),
  INDEX idx_contracts_status (status),
  INDEX idx_contracts_risk (risk_score),
  INDEX idx_contracts_renewal (start_date, term_months)
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  role VARCHAR(64) NOT NULL,
  approver VARCHAR(255) NOT NULL,
  decision VARCHAR(64) NOT NULL,
  updated_at DATETIME(3),
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_approval_steps_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_approval_steps_contract (contract_id),
  INDEX idx_approval_steps_decision (decision)
);

CREATE TABLE IF NOT EXISTS obligations (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  title VARCHAR(500) NOT NULL,
  owner VARCHAR(255) NOT NULL,
  due_date DATETIME(3) NOT NULL,
  status VARCHAR(64) NOT NULL,
  priority VARCHAR(32) NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_obligations_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_obligations_contract (contract_id),
  INDEX idx_obligations_due (due_date),
  INDEX idx_obligations_status (status)
);

CREATE TABLE IF NOT EXISTS renewals (
  contract_id VARCHAR(64) PRIMARY KEY,
  auto_renew BOOLEAN NOT NULL,
  renewal_date DATETIME(3) NOT NULL,
  notice_deadline DATETIME(3) NOT NULL,
  days_until_notice_deadline INT NOT NULL,
  renewal_owner VARCHAR(255) NOT NULL,
  recommended_action TEXT NOT NULL,
  renewal_risk VARCHAR(32) NOT NULL,
  commercial_impact TEXT NOT NULL,
  vendor_performance_note TEXT NOT NULL,
  notice_sent_at DATETIME(3),
  status VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_renewals_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_renewals_deadline (notice_deadline),
  INDEX idx_renewals_risk (renewal_risk)
);

CREATE TABLE IF NOT EXISTS renewal_action_history (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  note TEXT NOT NULL,
  actor VARCHAR(255) NOT NULL,
  timestamp DATETIME(3) NOT NULL,
  CONSTRAINT fk_renewal_history_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_renewal_history_contract (contract_id),
  INDEX idx_renewal_history_time (timestamp)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  timestamp DATETIME(3) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  event VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  action VARCHAR(255),
  previous_status VARCHAR(64),
  new_status VARCHAR(64),
  note TEXT,
  source VARCHAR(64),
  labels_json JSON,
  CONSTRAINT fk_activity_logs_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_activity_logs_contract (contract_id),
  INDEX idx_activity_logs_time (timestamp)
);

CREATE TABLE IF NOT EXISTS clause_signals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  clause VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  CONSTRAINT fk_clause_signals_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  INDEX idx_clause_signals_contract (contract_id),
  INDEX idx_clause_signals_status (status)
);

CREATE TABLE IF NOT EXISTS document_intelligence (
  contract_id VARCHAR(64) PRIMARY KEY,
  document_name VARCHAR(500) NOT NULL,
  document_type VARCHAR(128) NOT NULL,
  extracted_parties_json JSON NOT NULL,
  effective_date DATETIME(3) NOT NULL,
  expiration_date DATETIME(3) NOT NULL,
  governing_law VARCHAR(255) NOT NULL,
  payment_terms VARCHAR(255) NOT NULL,
  termination_rights TEXT NOT NULL,
  confidentiality VARCHAR(32) NOT NULL,
  indemnity VARCHAR(32) NOT NULL,
  limitation_of_liability VARCHAR(32) NOT NULL,
  auto_renew_language TEXT NOT NULL,
  assignment_restriction TEXT NOT NULL,
  insurance_requirement TEXT NOT NULL,
  audit_rights TEXT NOT NULL,
  human_review_needed BOOLEAN NOT NULL,
  human_review_reasons_json JSON NOT NULL,
  CONSTRAINT fk_document_intel_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_intelligence_fields (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  field_name VARCHAR(128) NOT NULL,
  field_value TEXT,
  confidence DECIMAL(5,4) NOT NULL,
  CONSTRAINT fk_document_intel_fields_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_document_intel_field (contract_id, field_name),
  INDEX idx_document_intel_fields_confidence (confidence)
);

-- Security and access-control schema (pre-auth foundation)
-- TODO(Security): Integrate with Microsoft Entra ID / Azure AD identities and external subject IDs.
-- TODO(Security): Add SAML/OIDC federation mapping tables.
-- TODO(Security): Add SCIM provisioning metadata and sync checkpoints.
-- TODO(Security): Add tenant_id to all security + business tables for strict tenant isolation.
-- TODO(Security): Add row-level policy tables for contract visibility scoping.
-- TODO(Security): Add immutable audit-grade access logging tables with retention policy.

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(64) NOT NULL,
  permission_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  department_id VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_users_department (department_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(64) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_policies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  summary VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delegations (
  id VARCHAR(64) PRIMARY KEY,
  from_user_id VARCHAR(64) NOT NULL,
  to_user_id VARCHAR(64) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  status VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_delegations_from_user FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_delegations_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_delegations_window (starts_at, ends_at)
);

CREATE TABLE IF NOT EXISTS approval_authorities (
  id VARCHAR(64) PRIMARY KEY,
  role_id VARCHAR(64) NOT NULL,
  max_contract_value DECIMAL(18,2) NOT NULL,
  can_approve_high_risk BOOLEAN NOT NULL DEFAULT FALSE,
  department_ids_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_approval_authorities_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
