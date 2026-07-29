
-- Remove unique constraint to allow multiple tokens per user
-- First, we need to drop the existing constraint
ALTER TABLE fcm_tokens DROP CONSTRAINT IF EXISTS fcm_tokens_user_id_key;

-- Add a composite unique constraint on user_id + fcm_token
-- This allows multiple devices per user, but prevents duplicate tokens for the same user
ALTER TABLE fcm_tokens ADD CONSTRAINT fcm_tokens_user_token_unique 
  UNIQUE (user_id, fcm_token);

-- Update the save function to handle multiple tokens
CREATE OR REPLACE FUNCTION public.save_fcm_token(uid uuid, tok text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert new token or update existing one
  INSERT INTO public.fcm_tokens (user_id, fcm_token)
  VALUES (uid, tok)
  ON CONFLICT (user_id, fcm_token) 
  DO UPDATE SET updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Drop and recreate get_all_fcm_tokens with new return type
DROP FUNCTION IF EXISTS public.get_all_fcm_tokens();

-- Update get_all_fcm_tokens to return all tokens (including duplicates for same user)
CREATE OR REPLACE FUNCTION public.get_all_fcm_tokens()
RETURNS TABLE(fcm_token text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT t.fcm_token::text, t.user_id 
  FROM public.fcm_tokens t;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.save_fcm_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_fcm_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO anon;
