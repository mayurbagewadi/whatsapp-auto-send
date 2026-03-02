-- Message logs table — stores every sent/failed message per user
CREATE TABLE IF NOT EXISTS message_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  message         TEXT,
  status          TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error           TEXT,
  sent_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_message_logs_user_id  ON message_logs(user_id);
CREATE INDEX idx_message_logs_sent_at  ON message_logs(sent_at DESC);
CREATE INDEX idx_message_logs_status   ON message_logs(status);
CREATE INDEX idx_message_logs_date     ON message_logs(DATE(sent_at));

-- RLS: users cannot access this table — super admin only via service role
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
