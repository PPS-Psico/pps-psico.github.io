-- Los wrappers privados que reciben áreas arbitrarias son piezas internas de
-- los RPC autorizados. Sus llamadores SECURITY DEFINER no necesitan delegar
-- esos permisos al rol del navegador.
revoke execute on function private.require_jefe_areas_v1() from authenticated;
revoke execute on function private.jefe_report_rows_v1(text[]) from authenticated;
revoke execute on function private.jefe_annual_offers_v1(text[], integer, date) from authenticated;
revoke execute on function private.jefe_text_has_area(text, text) from authenticated;
revoke execute on function private.jefe_orientation_key(text) from authenticated;
