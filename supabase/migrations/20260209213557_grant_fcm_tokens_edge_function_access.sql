
-- Grant SELECT permission to the service role for the Edge Function
GRANT SELECT ON public.fcm_tokens TO service_role;

-- Also grant to anon and authenticated for good measure
GRANT SELECT ON public.fcm_tokens TO anon;
GRANT SELECT ON public.fcm_tokens TO authenticated;

-- Verify permissions
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'fcm_tokens'
ORDER BY grantee, privilege_type;
