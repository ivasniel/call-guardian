
CREATE TABLE IF NOT EXISTS courtesy_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  action ENUM('EXTEND', 'UPDATE_LIMITS', 'REVOKE') NOT NULL,
  previous_state JSON NOT NULL,
  new_state JSON NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_courtesy_audit_subscription
    (subscription_id, created_at),

  CONSTRAINT fk_courtesy_audit_subscription
    FOREIGN KEY (subscription_id)
    REFERENCES account_subscriptions(id),

  CONSTRAINT fk_courtesy_audit_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
