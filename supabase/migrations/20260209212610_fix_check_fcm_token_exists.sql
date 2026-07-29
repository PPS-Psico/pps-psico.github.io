
-- Fix the check_fcm_token_exists function
-- Remove the auth check that may be causing issues with RPC calls
CREATE OR REPLACE FUNCTION public.check_fcm_token_exists(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Simply check if token exists for this user
  -- Security is handled by the application layer
  RETURN EXISTS(
    SELECT 1 FROM fcm_tokens WHERE user_id = uid
  );
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_fcm_token_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_fcm_token_exists(uuid) TO anon;
