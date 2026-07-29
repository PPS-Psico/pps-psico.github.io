
-- Create a function to get all FCM tokens (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_all_fcm_tokens()
RETURNS TABLE(fcm_token text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT t.fcm_token::text FROM public.fcm_tokens t;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_fcm_tokens() TO authenticated;
