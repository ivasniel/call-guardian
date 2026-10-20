-- Run ONCE, after migrate-v0.2.sql. No existing rows deleted.
ALTER TABLE calls
 ADD COLUMN detected_language VARCHAR(10) NULL,
 ADD COLUMN classification_confidence DECIMAL(4,3) NULL;
