-- Add OneSignal player ID column to push_subscriptions
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON push_subscriptions(onesignal_player_id) 
WHERE onesignal_player_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN push_subscriptions.onesignal_player_id IS 'OneSignal Player ID for push notifications';

-- Create notifications log table if not exists
CREATE TABLE IF NOT EXISTS notifications_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    url TEXT DEFAULT '/',
    user_id TEXT,
    recipients_count INTEGER DEFAULT 0,
    onesignal_response JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on sent_at for queries
CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_at 
ON notifications_log(sent_at DESC);