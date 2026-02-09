-- Create table for FCM tokens
-- This table stores Firebase Cloud Messaging tokens for push notifications

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(fcm_token);

-- Add RLS policies
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own tokens
CREATE POLICY "Users can view own tokens" ON fcm_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own tokens
CREATE POLICY "Users can insert own tokens" ON fcm_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own tokens
CREATE POLICY "Users can update own tokens" ON fcm_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own tokens
CREATE POLICY "Users can delete own tokens" ON fcm_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Allow admins to view all tokens (for sending notifications)
CREATE POLICY "Admins can view all tokens" ON fcm_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND (
        raw_user_meta_data->>'role' = 'admin' OR
        raw_user_meta_data->>'role' = 'superuser' OR
        raw_user_meta_data->>'role' = 'jefe'
      )
    )
  );

-- Add comment
COMMENT ON TABLE fcm_tokens IS 'Stores Firebase Cloud Messaging tokens for web push notifications';
