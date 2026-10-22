
-- Call Guardian AI
-- Migration v0.12: Email Verification

ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME NULL AFTER email;

CREATE TABLE email_verification_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_email_verification_token (token_hash),
  KEY idx_email_verification_user (user_id),

  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);
