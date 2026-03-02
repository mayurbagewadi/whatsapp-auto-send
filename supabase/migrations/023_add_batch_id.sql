-- Add batch_id to group bulk sends together
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_message_logs_batch_id ON message_logs(batch_id);
