-- Run ONCE, after v0.2 and v0.3 migrations. Back up the database first.
ALTER TABLE calls
 ADD COLUMN transcript_original TEXT NULL,
 ADD COLUMN transcript_language VARCHAR(10) NULL,
 ADD COLUMN processing_phase VARCHAR(24) NULL;
CREATE TABLE IF NOT EXISTS recording_jobs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 recording_id VARCHAR(100) NOT NULL UNIQUE,
 call_control_id VARCHAR(255) NOT NULL,
 recording_url TEXT NOT NULL,
 status ENUM('QUEUED','PROCESSING','DONE','ERROR') NOT NULL DEFAULT 'QUEUED',
 attempts INT NOT NULL DEFAULT 0,
 last_error VARCHAR(500) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 processed_at TIMESTAMP NULL,
 INDEX ix_jobs_status (status, attempts, id),
 INDEX ix_jobs_call (call_control_id)
);
