-- Add unique constraint on user_id for upsert operations
ALTER TABLE push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_id_unique 
UNIQUE (user_id);

-- Also add not null constraint if not already present
ALTER TABLE push_subscriptions 
ALTER COLUMN user_id SET NOT NULL;