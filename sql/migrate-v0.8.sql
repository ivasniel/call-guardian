ALTER TABLE calls
  ADD COLUMN caller_organization VARCHAR(200) NULL,
  ADD COLUMN callback_requested BOOLEAN NULL;