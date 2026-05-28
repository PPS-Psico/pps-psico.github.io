# Wiring del loop de aprendizaje — opciones técnicas

> Documenta las 3 formas posibles de conectar el panel React con
> `/tasks/learn_from_feedback` de hermes-pps cuando el operador aprueba, edita
> o descarta una suggestion. La decisión queda para la próxima sesión.
>
> Estado actual: el endpoint backend está listo y testeado. Falta el camino UI → endpoint.

---

## El problema

Cuando el operador aprueba un draft de email, edita una clasificación o
descarta una sugerencia, el panel hace `UPDATE estado` en `agent_suggestions`.
Eso no es suficiente: necesitamos que también se dispare la llamada a
`POST /tasks/learn_from_feedback` para que Hermes:

1. Aprenda del diff (lo agregue a `agent/aprendizajes.md` del vault).
2. Materialice side-effects (ej. cuando aprueba una `tipo=clasificacion`,
   inserta la fila en `whatsapp_contactos`).

El obstáculo: la URL del endpoint requiere header `X-Hermes-Token`. **Ese
token no puede vivir en el cliente React** (cualquiera con DevTools lo ve).
Necesitamos un intermediario seguro.

---

## Opción A — Postgres trigger + `pg_net` (más cerca, menos código)

Crear un trigger en `agent_suggestions` que dispara cuando `estado` cambia de
`pending` a `approved` / `edited` / `discarded`. Usa la extensión `pg_net` de
Supabase para hacer un POST asíncrono a hermes-pps.

```sql
-- Migration sugerida
create extension if not exists pg_net with schema extensions;

-- Guardar token en app_settings (alternativa: Vault de Supabase)
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings (key, value)
  values ('hermes_internal_token', '<<TOKEN>>')
  on conflict (key) do update set value = excluded.value;

create or replace function public.notify_hermes_on_resolve()
returns trigger as $$
declare
  token text;
begin
  if old.estado = 'pending' and new.estado in ('approved','edited','discarded') then
    select value into token from public.app_settings where key = 'hermes_internal_token';
    perform extensions.net.http_post(
      url := 'https://pps-hermes.n8n-blas.com.ar/tasks/learn_from_feedback',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Hermes-Token', token
      ),
      body := jsonb_build_object(
        'suggestion_id', new.id::text,
        'accion', new.estado,
        'tipo', new.tipo,
        'payload_original', old.payload,
        'payload_final', new.payload,
        'motivo', new.payload->>'motivo_descarte',
        'validado_por', new.resolved_by::text
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_hermes_on_resolve
after update of estado on public.agent_suggestions
for each row execute function public.notify_hermes_on_resolve();
```

**Pros:**

- Cero código en el cliente React.
- Acoplamiento mínimo: el panel solo hace `UPDATE`, Hermes se entera solo.
- Auditable desde SQL.

**Cons:**

- Requiere habilitar `pg_net` (Supabase free tier: ✅ disponible).
- El token vive en una tabla — usar Supabase Vault es más seguro pero más código.
- Si hermes-pps está caído, el trigger no falla pero la llamada se pierde
  (pg_net es fire-and-forget). Hay que loguear en `pg_net._http_response`.

---

## Opción B — Supabase Edge Function (más control, más infra)

Crear una Edge Function `notify-hermes` que reciba el evento de un Database
Webhook y lo reenvíe a hermes-pps con el token en env var.

```typescript
// supabase/functions/notify-hermes/index.ts
Deno.serve(async (req) => {
  const { record, old_record } = await req.json();
  if (old_record.estado !== "pending") return new Response("noop");
  if (!["approved", "edited", "discarded"].includes(record.estado)) {
    return new Response("noop");
  }
  const resp = await fetch("https://pps-hermes.n8n-blas.com.ar/tasks/learn_from_feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hermes-Token": Deno.env.get("HERMES_INTERNAL_TOKEN")!,
    },
    body: JSON.stringify({
      suggestion_id: record.id,
      accion: record.estado,
      tipo: record.tipo,
      payload_original: old_record.payload,
      payload_final: record.payload,
      motivo: record.payload?.motivo_descarte,
      validado_por: record.resolved_by,
    }),
  });
  return new Response(JSON.stringify({ status: resp.status }));
});
```

Después: configurar un **Database Webhook** en Supabase Studio que dispare
esta function cuando `agent_suggestions.estado` cambie.

**Pros:**

- Token vive en env vars de Supabase, no en SQL.
- Lógica en TypeScript, más legible que SQL.
- Logs separados, fáciles de debuggear.
- Si hermes-pps falla, Edge Functions reintentan con backoff.

**Cons:**

- Requiere setup de Edge Functions (CLI, deploy).
- Más infra para mantener.
- Latencia extra de un hop adicional.

---

## Opción C — RPC explícito desde el cliente

Crear una función Postgres `public.resolve_suggestion(...)` que el cliente
llama vía `supabase.rpc()`. La función hace el `UPDATE` Y el POST a hermes-pps
(usando `pg_net` igual que la Opción A pero síncrono al RPC).

**Pros:**

- El cliente sabe explícitamente que llamó a "resolver" — más legible.
- Permite retornar resultados de Hermes (ej. el `aprendizaje` que destiló) al
  cliente para mostrarlos.

**Cons:**

- Si Hermes tarda 5-10s, el cliente bloquea ese tiempo.
- Más código en el cliente (cambiar `update().eq()` por `rpc(...)`).

---

## Recomendación

**Opción A** para la primera implementación, por simplicidad y porque el caso
de uso es asincrónico (Hermes aprende, no tiene que devolver nada al cliente
en el momento). Si más adelante necesitamos UX más rica (mostrar al usuario
"Hermes aprendió que prefieres..."), migrar a **Opción C**.

**Opción B** queda para cuando ya tengamos otras Edge Functions en el proyecto
y valga la pena unificar.

---

## Lo que NO requiere ninguna de estas opciones

- El trigger funciona idéntico para suggestions tipo `email_draft`,
  `clasificacion`, `whatsapp_followup`, etc. — el endpoint `learn_from_feedback`
  ya hace el dispatch interno por `tipo`.
- El loop queda activo apenas se aplica la migration. No hay que cambiar el
  código del panel.
- Funciona tanto cuando aprobás desde la UI como si el operador o un workflow
  externo cambia el estado vía SQL directo.
