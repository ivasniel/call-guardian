-- Apply ONCE after v0.4 migration. Backup database beforehand.
ALTER TABLE recording_jobs ADD COLUMN turn_number TINYINT UNSIGNED NOT NULL DEFAULT 1;
