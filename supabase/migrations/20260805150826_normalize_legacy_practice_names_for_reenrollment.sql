-- Algunas prácticas heredadas conservan el nombre como JSON serializado
-- (por ejemplo, ["Institución"]). Se incluyen corchetes en el recorte para que
-- la barrera de reinscripción compare esos antecedentes con el nombre limpio.
create or replace function private.normalize_pps_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(
        btrim(
          replace(coalesce(p_value, ''), chr(160), ' '),
          E' {}"[]'
        )
      ),
      'áéíóúüñ',
      'aeiouun'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

revoke all on function private.normalize_pps_key(text) from public, anon, authenticated;
