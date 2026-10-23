
-- ============================================================
-- Call Guardian AI
-- Migration v0.19 - Plans, Subscriptions and Usage
-- MySQL 8.4
-- Requires v0.18
-- ============================================================

-- 1. PLANS

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,

  plan_type ENUM('COMMERCIAL', 'COURTESY')
    NOT NULL DEFAULT 'COMMERCIAL',

  active TINYINT(1) NOT NULL DEFAULT 1,

  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'USD',

  max_users INT UNSIGNED NOT NULL DEFAULT 1,
  max_numbers INT UNSIGNED NOT NULL DEFAULT 1,
  included_calls INT UNSIGNED NOT NULL DEFAULT 100,
  included_minutes INT UNSIGNED NOT NULL DEFAULT 100,

  allow_additional_numbers TINYINT(1)
    NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code),

  CONSTRAINT chk_plans_limits CHECK (
    max_users >= 1
    AND max_numbers >= 1
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. ACCOUNT SUBSCRIPTIONS

CREATE TABLE IF NOT EXISTS account_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  account_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,

  source ENUM('PAID', 'ADMIN_COURTESY')
    NOT NULL,

  status ENUM(
    'PENDING',
    'ACTIVE',
    'PAST_DUE',
    'EXPIRED',
    'CANCELED'
  ) NOT NULL DEFAULT 'PENDING',

  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,

  -- Snapshot of agreed plan limits.
  max_users INT UNSIGNED NOT NULL,
  max_numbers INT UNSIGNED NOT NULL,
  included_calls INT UNSIGNED NOT NULL,
  included_minutes INT UNSIGNED NOT NULL,

  allow_additional_numbers TINYINT(1)
    NOT NULL DEFAULT 0,

  granted_by BIGINT UNSIGNED NULL,
  grant_reason VARCHAR(500) NULL,

  canceled_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_subscriptions_account (
    account_id,
    status,
    starts_at,
    ends_at
  ),

  KEY idx_subscriptions_plan (plan_id),

  CONSTRAINT fk_subscriptions_account
    FOREIGN KEY (account_id)
    REFERENCES accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_subscriptions_plan
    FOREIGN KEY (plan_id)
    REFERENCES plans(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_subscriptions_granted_by
    FOREIGN KEY (granted_by)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_subscription_dates
    CHECK (ends_at > starts_at),

  CONSTRAINT chk_subscription_limits
    CHECK (max_users >= 1 AND max_numbers >= 1),

  CONSTRAINT chk_subscription_courtesy
    CHECK (
      source <> 'ADMIN_COURTESY'
      OR granted_by IS NOT NULL
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. SUBSCRIPTION USAGE

CREATE TABLE IF NOT EXISTS subscription_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  subscription_id BIGINT UNSIGNED NOT NULL,

  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,

  calls_used INT UNSIGNED NOT NULL DEFAULT 0,
  minutes_used DECIMAL(12,4) NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_usage_period (
    subscription_id,
    period_start
  ),

  CONSTRAINT fk_usage_subscription
    FOREIGN KEY (subscription_id)
    REFERENCES account_subscriptions(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_usage_period
    CHECK (period_end > period_start)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. BILLING TRANSACTIONS

CREATE TABLE IF NOT EXISTS billing_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  account_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,

  transaction_type ENUM(
    'SUBSCRIPTION',
    'NUMBER_PURCHASE',
    'NUMBER_RENEWAL',
    'TOP_UP',
    'REFUND',
    'ADJUSTMENT'
  ) NOT NULL,

  status ENUM(
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED'
  ) NOT NULL DEFAULT 'PENDING',

  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',

  provider VARCHAR(40) NULL,
  provider_reference VARCHAR(191) NULL,

  description VARCHAR(500) NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_billing_account (
    account_id,
    created_at
  ),

  KEY idx_billing_subscription (subscription_id),

  UNIQUE KEY uq_billing_provider_reference (
    provider,
    provider_reference
  ),

  CONSTRAINT fk_billing_account
    FOREIGN KEY (account_id)
    REFERENCES accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_billing_subscription
    FOREIGN KEY (subscription_id)
    REFERENCES account_subscriptions(id)
    ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. CREATE THE COURTESY PLAN

INSERT INTO plans (
  code,
  name,
  plan_type,
  monthly_price,
  max_users,
  max_numbers,
  included_calls,
  included_minutes,
  allow_additional_numbers
)
VALUES (
  'COURTESY',
  'Courtesy / Trial Plan',
  'COURTESY',
  0.00,
  1,
  1,
  100,
  100,
  0
)
ON DUPLICATE KEY UPDATE
  code = code;


-- 6. VERIFY

SELECT
  id,
  code,
  name,
  plan_type,
  monthly_price,
  max_users,
  max_numbers,
  included_calls,
  included_minutes,
  active
FROM plans;
