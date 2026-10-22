-- Call Guardian AI
-- Migration v0.11: User Authentication

ALTER TABLE users
    ADD COLUMN email VARCHAR(255) NULL AFTER name,
    ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;

CREATE UNIQUE INDEX uq_users_email ON users (email);