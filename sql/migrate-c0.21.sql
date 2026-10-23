
-- ============================================================
-- CALL GUARDIAN AI
-- Migration v0.20
-- Phone Number Purchase Orders - Customer Self-Service
-- MySQL 8.4
-- Requires v0.19
--
-- NO Super Admin approval required for individual purchases.
-- ============================================================

CREATE TABLE IF NOT EXISTS phone_number_purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  order_uuid CHAR(36) NOT NULL,

  -- Ownership and subscription
  account_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,

  -- Selected Telnyx number
  phone_number VARCHAR(20) NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'US',

  -- Price snapshot obtained from Telnyx
  upfront_cost DECIMAL(12,5) NOT NULL,
  monthly_cost DECIMAL(12,5) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  quote_observed_at DATETIME NOT NULL,

  -- How the Telnyx cost is funded.
  funding_source ENUM(
    'PLAN_INCLUDED',
    'CUSTOMER_PAID',
    'COURTESY_BUDGET'
  ) NULL,

  funding_status ENUM(
    'PENDING',
    'VERIFIED'
  ) NOT NULL DEFAULT 'PENDING',

  funding_verified_at DATETIME NULL,

  -- Transaction reference when applicable.
  billing_transaction_id BIGINT UNSIGNED NULL,

  -- Order lifecycle
  status ENUM(
    'PENDING_PAYMENT',
    'READY',
    'PURCHASING',
    'PURCHASED',
    'PROVISIONING',
    'COMPLETED',
    'FAILED',
    'RECONCILIATION_REQUIRED',
    'CANCELED'
  ) NOT NULL DEFAULT 'PENDING_PAYMENT',

  -- Telnyx references
  telnyx_order_id VARCHAR(191) NULL,
  telnyx_phone_number_id VARCHAR(191) NULL,

  -- Use only if supported by the provider operation.
  provider_idempotency_key VARCHAR(191) NULL,

  purchased_at DATETIME NULL,
  completed_at DATETIME NULL,
  canceled_at DATETIME NULL,

  failure_code VARCHAR(100) NULL,
  failure_message VARCHAR(1000) NULL,

  -- Sanitized provider response
  provider_response JSON NULL,

  -- Prevent another active purchase order for the same number.
  active_phone_number VARCHAR(20)
    GENERATED ALWAYS AS (
      CASE
        WHEN status IN (
          'PENDING_PAYMENT',
          'READY',
          'PURCHASING',
          'PURCHASED',
          'PROVISIONING',
          'RECONCILIATION_REQUIRED'
        )
        THEN phone_number
        ELSE NULL
      END
    ) STORED,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_phone_orders_uuid (
    order_uuid
  ),

  UNIQUE KEY uq_phone_orders_active_number (
    active_phone_number
  ),

  UNIQUE KEY uq_phone_orders_telnyx_order (
    telnyx_order_id
  ),

  UNIQUE KEY uq_phone_orders_provider_key (
    provider_idempotency_key
  ),

  KEY idx_phone_orders_account (
    account_id,
    created_at
  ),

  KEY idx_phone_orders_subscription (
    subscription_id
  ),

  KEY idx_phone_orders_status (
    status,
    created_at
  ),

  KEY idx_phone_orders_target_user (
    target_user_id
  ),

  KEY idx_phone_orders_billing (
    billing_transaction_id
  ),

  CONSTRAINT fk_phone_orders_account
    FOREIGN KEY (account_id)
    REFERENCES accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_phone_orders_subscription
    FOREIGN KEY (subscription_id)
    REFERENCES account_subscriptions(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_phone_orders_target_user
    FOREIGN KEY (target_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_phone_orders_requested_by
    FOREIGN KEY (requested_by)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_phone_orders_billing
    FOREIGN KEY (billing_transaction_id)
    REFERENCES billing_transactions(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_phone_orders_country
    CHECK (
      country_code = 'US'
    ),

  CONSTRAINT chk_phone_orders_costs
    CHECK (
      upfront_cost >= 0
      AND monthly_cost >= 0
    ),

  CONSTRAINT chk_phone_orders_funding
    CHECK (
      funding_status <> 'VERIFIED'
      OR (
        funding_source IS NOT NULL
        AND funding_verified_at IS NOT NULL
      )
    ),

  CONSTRAINT chk_phone_orders_ready_funding
    CHECK (
      status NOT IN (
        'READY',
        'PURCHASING',
        'PURCHASED',
        'PROVISIONING',
        'COMPLETED'
      )
      OR funding_status = 'VERIFIED'
    )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- PURCHASE EVENTS / AUDIT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS phone_number_purchase_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  order_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,

  event_type ENUM(
    'CREATED',
    'ELIGIBILITY_VERIFIED',
    'FUNDING_VERIFIED',
    'PAYMENT_CONFIRMED',
    'PURCHASE_STARTED',
    'PROVIDER_CONFIRMED',
    'PROVISIONING_STARTED',
    'COMPLETED',
    'FAILED',
    'RECONCILIATION_REQUIRED',
    'CANCELED',
    'RECOVERED'
  ) NOT NULL,

  previous_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NOT NULL,

  details JSON NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_phone_events_order (
    order_id,
    created_at
  ),

  KEY idx_phone_events_type (
    event_type,
    created_at
  ),

  CONSTRAINT fk_phone_events_order
    FOREIGN KEY (order_id)
    REFERENCES phone_number_purchase_orders(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_phone_events_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- VERIFICATION
-- ============================================================

SHOW TABLES LIKE 'phone_number_purchase%';

SHOW CREATE TABLE phone_number_purchase_orders;

SHOW CREATE TABLE phone_number_purchase_events;
