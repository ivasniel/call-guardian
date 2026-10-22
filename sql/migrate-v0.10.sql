-- Call Guardian AI
-- Migration v0.10: Notification Preferences

CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    enabled BOOLEAN NOT NULL DEFAULT FALSE,

    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    whatsapp_number VARCHAR(25) NULL,
    email_address VARCHAR(255) NULL,

    priority_filter ENUM('ALL', 'HIGH')
        NOT NULL DEFAULT 'ALL',

    categories JSON NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_preferences_user (user_id),

    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);