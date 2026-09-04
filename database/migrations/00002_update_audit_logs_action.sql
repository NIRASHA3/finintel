-- +goose Up
-- +goose StatementBegin
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'POST', 'REVERSE', 'DELETE', 'LOCK', 'CLOSE'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN ('CREATE', 'UPDATE', 'POST', 'REVERSE', 'DELETE', 'LOCK'));
-- +goose StatementEnd
