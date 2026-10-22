
-- =====================================================
-- Call Guardian AI
-- Migration v0.14 - Multi-tenant contacts
--
-- Requirements:
--   - Migration v0.13 already applied
--   - MySQL 8.0+
--
-- Supports:
--   - Fresh migration
--   - Re-execution after successful completion
--   - Recovery from partially applied migration
-- =====================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_contacts_v014$$

CREATE PROCEDURE migrate_contacts_v014()
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_missing BIGINT DEFAULT 0;
    DECLARE v_duplicates BIGINT DEFAULT 0;

    -- 1. Add account_id if it does not exist.

    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contacts'
      AND COLUMN_NAME = 'account_id';

    IF v_count = 0 THEN
        ALTER TABLE contacts
            ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER id;
    END IF;

    -- 2. Associate existing contacts with their accounts.
    -- Safe Update Mode is disabled only for this session
    -- and restored to its previous value afterward.

    SET @previous_safe_updates = @@SQL_SAFE_UPDATES;
    SET SQL_SAFE_UPDATES = 0;

    UPDATE contacts c
    INNER JOIN users u ON u.id = c.user_id
    SET c.account_id = u.account_id
    WHERE c.account_id IS NULL;

    SET SQL_SAFE_UPDATES = @previous_safe_updates;

    -- 3. Verify that every contact has an account.

    SELECT COUNT(*)
    INTO v_missing
    FROM contacts
    WHERE account_id IS NULL;

    IF v_missing > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT =
            'Migration stopped: contacts without account_id';
    END IF;

    -- 4. Check for duplicate numbers inside the same account.

    SELECT COUNT(*)
    INTO v_duplicates
    FROM (
        SELECT account_id, phone_e164
        FROM contacts
        GROUP BY account_id, phone_e164
        HAVING COUNT(*) > 1
    ) AS duplicates_found;

    IF v_duplicates > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT =
            'Migration stopped: duplicate phones in account';
    END IF;

    -- 5. Preserve the foreign key on contacts.user_id.
    -- MySQL needs an index whose first column is user_id.

    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contacts'
      AND INDEX_NAME = 'idx_contacts_user_id';

    IF v_count = 0 THEN
        ALTER TABLE contacts
            ADD INDEX idx_contacts_user_id (user_id);
    END IF;

    -- 6. Add the account foreign key if missing.

    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contacts'
      AND CONSTRAINT_NAME = 'fk_contacts_account'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY';

    IF v_count = 0 THEN
        ALTER TABLE contacts
            ADD CONSTRAINT fk_contacts_account
            FOREIGN KEY (account_id)
            REFERENCES accounts(id)
            ON DELETE RESTRICT;
    END IF;

    -- 7. Create unique phone numbers per account.

    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contacts'
      AND INDEX_NAME = 'uq_contacts_account_phone';

    IF v_count = 0 THEN
        ALTER TABLE contacts
            ADD UNIQUE KEY uq_contacts_account_phone
                (account_id, phone_e164);
    END IF;

    -- 8. Remove the old user-level unique index.

    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contacts'
      AND INDEX_NAME = 'uq_user_phone';

    IF v_count > 0 THEN
        ALTER TABLE contacts
            DROP INDEX uq_user_phone;
    END IF;

    -- 9. Enforce account_id NOT NULL.

    ALTER TABLE contacts
        MODIFY COLUMN account_id BIGINT UNSIGNED NOT NULL;

END$$

DELIMITER ;

-- Execute migration.
CALL migrate_contacts_v014();

-- Remove temporary migration procedure.
DROP PROCEDURE IF EXISTS migrate_contacts_v014;

-- Verify final structure.
SHOW CREATE TABLE contacts;

SELECT
    COUNT(*) AS total_contacts,
    COUNT(DISTINCT account_id) AS total_accounts,
    SUM(account_id IS NULL) AS contacts_without_account
FROM contacts;
