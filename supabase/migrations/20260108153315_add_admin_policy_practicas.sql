create policy "Admin todo practicas"
on "public"."practicas"
as PERMISSIVE
for ALL
to public
using (
  is_admin()
);
