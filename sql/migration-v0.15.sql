
-- =====================================================
-- Call Guardian AI
-- Migration v0.15 - Account AI Settings
-- Requires v0.13 (accounts)
-- =====================================================

CREATE TABLE IF NOT EXISTS account_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL,

    agent_enabled TINYINT(1) NOT NULL DEFAULT 1,

    language ENUM('auto', 'en', 'es')
        NOT NULL DEFAULT 'auto',

    greeting_en VARCHAR(500) NOT NULL
        DEFAULT 'Hello. How can I help you today?',

    greeting_es VARCHAR(500) NOT NULL
        DEFAULT 'Hola. ¿En qué puedo ayudarle?',

    max_followups TINYINT UNSIGNED NOT NULL DEFAULT 6,

    early_spam_screening TINYINT(1) NOT NULL DEFAULT 1,

    callback_verification TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_account_settings_account (account_id),

    CONSTRAINT fk_account_settings_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_account_settings_followups
        CHECK (max_followups BETWEEN 1 AND 15)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- Create default settings for existing accounts.
-- Does not overwrite existing configurations.

INSERT INTO account_settings (account_id)
SELECT a.id
FROM accounts a
LEFT JOIN account_settings s ON s.account_id = a.id
WHERE s.account_id IS NULL;


-- Verify
SELECT
    a.id AS account_id,
    a.name AS account_name,
    s.agent_enabled,
    s.language,
    s.greeting_en,
    s.greeting_es,
    s.max_followups,
    s.early_spam_screening,
    s.callback_verification
FROM accounts a
LEFT JOIN account_settings s ON s.account_id = a.id
ORDER BY a.id;
