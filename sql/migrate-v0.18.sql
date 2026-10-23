
-- ===========================================================
-- Call Guardian AI
-- Migration v0.18 - Administrative Locks and Audit
-- Requires v0.17
-- MySQL 8.4
-- ===========================================================

-- Account-level administrative restrictions

ALTER TABLE accounts
  ADD COLUMN admin_locked TINYINT(1)
    NOT NULL DEFAULT 0,
  ADD COLUMN admin_lock_mode
    ENUM('NONE', 'PURCHASES', 'SERVICE', 'FULL')
    NOT NULL DEFAULT 'NONE',
  ADD COLUMN admin_lock_reason VARCHAR(500) NULL,
  ADD COLUMN admin_locked_at DATETIME NULL,
  ADD COLUMN admin_locked_by BIGINT UNSIGNED NULL;

-- Number-level administrative restriction

ALTER TABLE phone_numbers
  ADD COLUMN admin_locked TINYINT(1)
    NOT NULL DEFAULT 0,
  ADD COLUMN admin_lock_reason VARCHAR(500) NULL,
  ADD COLUMN admin_locked_at DATETIME NULL,
  ADD COLUMN admin_locked_by BIGINT UNSIGNED NULL;

-- Record administrative changes for accountability

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('ACCOUNT', 'PHONE_NUMBER')
    NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  action ENUM('LOCK', 'UNLOCK', 'CHANGE_LOCK')
    NOT NULL,
  previous_state JSON NULL,
  new_state JSON NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_audit_target (target_type, target_id),
  KEY idx_audit_actor (actor_user_id),
  KEY idx_audit_created (created_at),

  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- Validate current accounts

SELECT
  id,
  name,
  account_type,
  status,
  admin_locked,
  admin_lock_mode,
  admin_lock_reason
FROM accounts
ORDER BY id;

-- Validate current phone numbers

SELECT
  id,
  account_id,
  telnyx_e164,
  active,
  admin_locked,
  admin_lock_reason
FROM phone_numbers
ORDER BY id;
