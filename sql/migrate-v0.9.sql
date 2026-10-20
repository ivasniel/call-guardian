ALTER TABLE calls
  ADD COLUMN callback_phone VARCHAR(25) NULL,
  ADD COLUMN callback_phone_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN callback_phone_source ENUM(
    'CALLER_ID',
    'PROVIDED'
  ) NULL;