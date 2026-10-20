-- Execute ONCE on existing v0.1 database (do not rerun schema.sql)
ALTER TABLE calls
 ADD COLUMN caller_name VARCHAR(180) NULL,
 ADD COLUMN reason_text TEXT NULL,
 ADD COLUMN category VARCHAR(24) NULL,
 ADD COLUMN priority VARCHAR(12) NULL,
 ADD COLUMN ai_summary VARCHAR(400) NULL,
 ADD COLUMN classification_source VARCHAR(12) NULL;
