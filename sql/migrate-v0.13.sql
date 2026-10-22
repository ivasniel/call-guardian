
-- =====================================================
-- Call Guardian AI
-- Migration v0.13 - Multi-tenant foundation
-- =====================================================

-- 1. Business accounts

CREATE TABLE accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(120) NOT NULL,

    status ENUM(
        'ACTIVE',
        'SUSPENDED',
        'CANCELED'
    ) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_accounts_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Extend users with account membership and roles
-- SUPER_ADMIN has no customer account.
-- ACCOUNT_ADMIN and ACCOUNT_USER belong to an account.

ALTER TABLE users
    ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN role ENUM(
        'SUPER_ADMIN',
        'ACCOUNT_ADMIN',
        'ACCOUNT_USER'
    ) NOT NULL DEFAULT 'ACCOUNT_USER' AFTER account_id,
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE AFTER role;

ALTER TABLE users
    ADD KEY idx_users_account (account_id);

ALTER TABLE users
    ADD CONSTRAINT fk_users_account
    FOREIGN KEY (account_id)
    REFERENCES accounts(id)
    ON DELETE RESTRICT;


-- 3. Create an account for the existing pilot user

INSERT INTO accounts (
    name,
    slug,
    status
)
VALUES (
    'Pilot Account',
    'pilot-account',
    'ACTIVE'
);


-- 4. Assign existing users to the pilot account.
-- Keeps their original IDs and existing relationships.

UPDATE users
SET
    account_id = (
        SELECT id
        FROM accounts
        WHERE slug = 'pilot-account'
        LIMIT 1
    ),
    role = 'ACCOUNT_ADMIN'
WHERE account_id IS NULL;


-- 5. Add account ownership to phone numbers

ALTER TABLE phone_numbers
    ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER id,
    ADD KEY idx_phone_numbers_account (account_id),
    ADD CONSTRAINT fk_phone_numbers_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT;


-- 6. Assign existing phone numbers

UPDATE phone_numbers pn
INNER JOIN users u ON u.id = pn.user_id
SET pn.account_id = u.account_id
WHERE pn.account_id IS NULL;


-- 7. Add account ownership to calls

ALTER TABLE calls
    ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER id,
    ADD KEY idx_calls_account_started (
        account_id,
        started_at,
        id
    ),
    ADD CONSTRAINT fk_calls_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT;


-- 8. Assign existing calls to their account

UPDATE calls c
INNER JOIN users u ON u.id = c.user_id
SET c.account_id = u.account_id
WHERE c.account_id IS NULL;
