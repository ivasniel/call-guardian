
-- =====================================================
-- Call Guardian AI
-- Migration v0.17 - Business and Personal Accounts
-- =====================================================

-- Add account_type only if it does not exist.
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'accounts'
    AND COLUMN_NAME = 'account_type'
);

SET @migration_sql = IF(
  @column_exists = 0,
  'ALTER TABLE accounts
   ADD COLUMN account_type
   ENUM(''BUSINESS'', ''PERSONAL'')
   NOT NULL DEFAULT ''BUSINESS''
   AFTER name',
  'SELECT ''account_type already exists'' AS message'
);

PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

-- Inspect accounts without changing existing ownership.
SELECT
  id,
  name,
  account_type,
  slug,
  status
FROM accounts
ORDER BY id;
