"""hermes-pps — servicio HTTP que n8n (y el panel) llaman para razonar sobre los datos.

Endpoints:
  GET  /health                      -> liveness
  POST /tasks/daily_brief           -> arma el brief de la mañana
  POST /tasks/daily_brief_from_db   -> arma el brief leyendo Supabase directo
  POST /tasks/plan_today            -> arma el tablero "Hoy con Hermes"
  POST /tasks/draft_reply           -> redacta borrador de respuesta
  POST /tasks/explore               -> investiga Supabase y escribe hallazgos al vault
  POST /tasks/learn_from_feedback   -> registra aprendizaje a partir de feedback humano

Scheduler interno (ver final del archivo): regenera solo, cada mañana, el plan
del día y —como respaldo— el daily brief si n8n no lo generó. Configurable por
entorno (HERMES_SCHEDULER_ENABLED, HERMES_PLAN_TODAY_AT, etc.).

Todas las rutas /tasks/* requieren header X-Hermes-Token == HERMES_INTERNAL_TOKEN.
Toda invocación queda registrada en agent_audit_log.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import uuid
from typing import Any

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from supabase import Client, create_client


# ---------- config ----------

OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
HERMES_MODEL = os.environ.get("HERMES_MODEL", "deepseek/deepseek-v4-flash")
HERMES_MODEL_FALLBACK = os.environ.get("HERMES_MODEL_FALLBACK", "anthropic/claude-haiku-4.5")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HERMES_MODE = os.environ.get("HERMES_MODE", "shadow")
HERMES_INTERNAL_TOKEN = os.environ["HERMES_INTERNAL_TOKEN"]
VAULT_PATH = pathlib.Path(os.environ.get("VAULT_PATH", "/vault"))

# Verificación de doble pasada en verify_finalizacion: una segunda llamada al LLM
# audita la primera antes de persistir (idea tomada del verifier node de Hermes
# Agent de Nous Research). Pensado para acreditaciones, donde equivocarse es caro.
#   "1" (default) | "0" para apagarlo.
HERMES_DOUBLE_CHECK_VERIFY = os.environ.get("HERMES_DOUBLE_CHECK_VERIFY", "1") == "1"

# Webhook de n8n para acciones SALIENTES de Gmail (responder / archivar / leer).
# n8n posee la credencial Gmail OAuth2; Hermes solo orquesta y audita.
#   GMAIL_ACTION_WEBHOOK_URL  → URL del webhook n8n (POST)
#   GMAIL_ACTION_WEBHOOK_TOKEN→ token opcional enviado en header X-Hermes-Token
N8N_GMAIL_WEBHOOK_URL = os.environ.get("GMAIL_ACTION_WEBHOOK_URL", "")
N8N_GMAIL_WEBHOOK_TOKEN = os.environ.get("GMAIL_ACTION_WEBHOOK_TOKEN", "")
WHATSAPP_E2E_KEY = os.environ.get("WHATSAPP_E2E_KEY", "")
WABDD_MASTER_TOKEN = os.environ.get("WABDD_MASTER_TOKEN", "")
WABDD_ANDROID_ID = os.environ.get("WABDD_ANDROID_ID", "")
WABDD_EMAIL = os.environ.get("WABDD_EMAIL", "")

SYSTEM_PROMPT_PATH = pathlib.Path(__file__).parent.parent / "system_prompt.md"


# ---------- clients ----------

llm = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL)
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def load_system_prompt() -> str:
    """Inyecta el system prompt base + todo el contenido de tuyas/ (incluyendo el manual).

    Orden de prioridad (más arriba = más visible para el modelo):
      1. system_prompt.md
      2. tuyas/criterios.md y contexto-uflo.md (legacy)
      3. tuyas/manual/*.md (en orden alfabético: 00-, 01-, 02-...)
    """
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    extras = []
    tuyas = VAULT_PATH / "tuyas"
    for name in ("criterios.md", "contexto-uflo.md"):
        p = tuyas / name
        if p.exists():
            extras.append(f"\n\n---\n# tuyas/{name}\n\n{p.read_text(encoding='utf-8')}")
    manual = tuyas / "manual"
    if manual.is_dir():
        for path in sorted(manual.glob("*.md")):
            extras.append(f"\n\n---\n# tuyas/manual/{path.name}\n\n{path.read_text(encoding='utf-8')}")
    return base + "".join(extras)


SYSTEM_PROMPT = load_system_prompt()


# ---------- auth ----------

def require_token(x_hermes_token: str = Header(default="")) -> None:
    if x_hermes_token != HERMES_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="invalid token")


# ---------- audit ----------

def audit(
    tool: str,
    input_: dict[str, Any] | None = None,
    output: dict[str, Any] | None = None,
    *,
    invocation_id: str,
    suggestion_id: str | None = None,
    duration_ms: int | None = None,
    error: str | None = None,
) -> None:
    try:
        sb.table("agent_audit_log").insert({
            "invocation_id": invocation_id,
            "tool": tool,
            "input": {"mode": HERMES_MODE, "model": HERMES_MODEL, **(input_ or {})},
            "output": output,
            "suggestion_id": suggestion_id,
            "duration_ms": duration_ms,
            "error": error,
        }).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[audit] fallo al loguear {tool}: {exc}", flush=True)


# ---------- llm call ----------

def llm_json(user_prompt: str, *, schema_hint: str) -> dict[str, Any]:
    """Invoca el LLM esperando JSON. Fallback al modelo secundario si falla."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{user_prompt}\n\nDevolvé JSON con este shape:\n{schema_hint}"},
    ]
    for model in (HERMES_MODEL, HERMES_MODEL_FALLBACK):
        try:
            resp = llm.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            return json.loads(resp.choices[0].message.content or "{}")
        except Exception as exc:  # noqa: BLE001
            print(f"[llm] modelo {model} falló: {exc}", flush=True)
    raise HTTPException(status_code=502, detail="todos los modelos LLM fallaron")


def llm_verify(original_prompt: str, candidate: dict[str, Any], *, schema_hint: str,
               foco: str) -> dict[str, Any]:
    """Segunda pasada: un verificador independiente audita la salida de la primera.

    Idea tomada del verifier node del modo Swarm de Hermes Agent (Nous Research):
    en vez de confiar en una sola inferencia, una segunda llamada revisa el
    resultado contra el contexto original y puede corregirlo. Útil donde
    equivocarse es caro (acreditaciones). No inventa datos nuevos: solo valida
    los que ya están en el contexto y ajusta el veredicto si la primera pasada
    fue demasiado laxa o demasiado dura.

    Devuelve un dict con el MISMO shape que `candidate`, más:
      "_verificador": {"coincide": bool, "ajustes": "string", "modelo": "..."}
    Si la verificación falla por cualquier motivo, devuelve el candidate intacto
    (degradación elegante: nunca peor que sin doble pasada).
    """
    audit_prompt = (
        "Sos un VERIFICADOR independiente. Otra instancia de Hermes ya produjo el "
        "JSON candidato de abajo a partir del contexto original. Tu único trabajo es "
        "auditarlo, NO rehacerlo desde cero.\n\n"
        f"Foco de la auditoría: {foco}\n\n"
        "Revisá específicamente:\n"
        "  - ¿El veredicto/estado es coherente con la evidencia del contexto? "
        "(¿marcó verified algo que tiene una inconsistencia real? ¿marcó critical "
        "algo que es solo un warning menor?)\n"
        "  - ¿Hay datos inventados que NO están en el contexto? Si los hay, eliminalos.\n"
        "  - ¿Falta señalar algo que el contexto deja en evidencia?\n\n"
        "Si el candidato está bien, devolvelo igual. Si hay que corregirlo, devolvé "
        "la versión corregida con EL MISMO shape. En ambos casos agregá la clave "
        '`_verificador` con {"coincide": true/false, "ajustes": "qué cambiaste o '
        '\'nada\'"}.\n\n'
        f"--- contexto original (resumido) ---\n{original_prompt[:6000]}\n\n"
        f"--- JSON candidato a auditar ---\n{json.dumps(candidate, ensure_ascii=False)[:6000]}\n\n"
        f"--- shape esperado ---\n{schema_hint}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": audit_prompt},
    ]
    for model in (HERMES_MODEL, HERMES_MODEL_FALLBACK):
        try:
            resp = llm.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.0,  # verificación = determinista
            )
            checked = json.loads(resp.choices[0].message.content or "{}")
            if not isinstance(checked, dict) or not checked:
                return candidate
            checked.setdefault("_verificador", {})
            if isinstance(checked["_verificador"], dict):
                checked["_verificador"]["modelo"] = model
            return checked
        except Exception as exc:  # noqa: BLE001
            print(f"[llm_verify] modelo {model} falló: {exc}", flush=True)
    # Si la verificación entera falla, no degradamos la respuesta original.
    return candidate


# ---------- app ----------

app = FastAPI(title="hermes-pps", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": HERMES_MODE, "model": HERMES_MODEL}


# ---------- task: daily_brief ----------

class DailyBriefInput(BaseModel):
    """n8n arma el payload con datos ya leídos de Supabase y nos lo pasa."""
    solicitudes_pendientes: list[dict[str, Any]] = []
    lanzamientos_por_vencer: list[dict[str, Any]] = []
    instituciones_sin_contacto: list[dict[str, Any]] = []
    gmail_sin_responder: list[dict[str, Any]] = []
    whatsapp_pendientes: list[dict[str, Any]] = []


def _create_daily_brief(payload: DailyBriefInput, *, source: str) -> dict[str, Any]:
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("daily_brief.start", {"source": source, **payload.model_dump()}, invocation_id=invocation_id)

    schema = (
        '{"bullets":[{"prioridad":"alta|media|baja",'
        '"titulo":"string","por_que":"string",'
        '"accion_sugerida":"string","recurso":"string"}],'
        '"resumen":"string (1-2 frases)"}'
    )
    user = (
        "Armá el daily brief del coordinador. Máximo 7 bullets, priorizados. "
        "Mirá especialmente lo que se está cayendo entre las grietas.\n\n"
        f"DATOS:\n{json.dumps(payload.model_dump(), ensure_ascii=False, indent=2)}"
    )
    result = llm_json(user, schema_hint=schema)

    suggestion_id = str(uuid.uuid4())
    sb.table("agent_suggestions").insert({
        "id": suggestion_id,
        "tipo": "daily_brief",
        "payload": result,
        "contexto": {
            "model": HERMES_MODEL,
            "source": source,
            "input_summary": {k: len(v) for k, v in payload.model_dump().items()},
        },
    }).execute()

    audit(
        "daily_brief.done",
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"suggestion_id": suggestion_id, "content": result}


@app.post("/tasks/daily_brief", dependencies=[Depends(require_token)])
def daily_brief(payload: DailyBriefInput) -> dict[str, Any]:
    return _create_daily_brief(payload, source="payload")


@app.post("/tasks/daily_brief_from_db", dependencies=[Depends(require_token)])
def daily_brief_from_db() -> dict[str, Any]:
    """Arma el brief leyendo Supabase directo para evitar merges fragiles en n8n."""
    now = dt.datetime.now(dt.timezone.utc)
    solicitudes_pendientes: list[dict[str, Any]] = []
    lanzamientos_por_vencer: list[dict[str, Any]] = []
    gmail_sin_responder: list[dict[str, Any]] = []
    whatsapp_pendientes: list[dict[str, Any]] = []

    try:
        solis = sb.table("solicitudes_pps").select(
            "id,estudiante_id,nombre_alumno,nombre_institucion,estado_seguimiento,actualizacion,created_at,"
            "telefono_institucion,email_institucion,referente_institucion"
        ).order("created_at", desc=True).limit(25).execute().data or []

        # Fetch messages and hilos to cross-reference recent contact history
        all_wa = []
        try:
            all_wa = sb.table("whatsapp_mensajes").select("chat_jid,from_me,texto,timestamp").order("timestamp", desc=True).limit(1000).execute().data or []
        except Exception as wa_exc:
            print(f"[daily_brief_from_db] error querying whatsapp_mensajes: {wa_exc}", flush=True)

        all_gmail = []
        try:
            all_gmail = sb.table("gmail_hilos").select("asunto,ultimo_mensaje_de,ultimo_mensaje_at,participantes,email_institucion").order("ultimo_mensaje_at", desc=True).limit(500).execute().data or []
        except Exception as gm_exc:
            print(f"[daily_brief_from_db] error querying gmail_hilos: {gm_exc}", flush=True)

        wa_by_phone = {}
        for m in all_wa:
            jid = m.get("chat_jid") or ""
            phone_part = jid.split("@")[0] if "@" in jid else jid
            norm = _normalize_phone(phone_part)
            if norm:
                last_10 = norm[-10:]
                if last_10 not in wa_by_phone:
                    wa_by_phone[last_10] = {
                        "from_me": m.get("from_me"),
                        "texto": m.get("texto"),
                        "timestamp": m.get("timestamp")
                    }

        gmail_by_email = {}
        for t in all_gmail:
            emails = []
            if t.get("email_institucion"):
                emails.append(t["email_institucion"].lower().strip())
            parts = t.get("participantes")
            if parts:
                if isinstance(parts, list):
                    for p in parts:
                        if isinstance(p, str):
                            emails.append(p.lower().strip())
                        elif isinstance(p, dict) and p.get("email"):
                            emails.append(p["email"].lower().strip())
                elif isinstance(parts, str):
                    for email_match in re.findall(r'[\w\.-]+@[\w\.-]+', parts):
                        emails.append(email_match.lower().strip())
            for email in emails:
                if email not in gmail_by_email:
                    gmail_by_email[email] = {
                        "ultimo_mensaje_de": t.get("ultimo_mensaje_de"),
                        "ultimo_mensaje_at": t.get("ultimo_mensaje_at"),
                        "asunto": t.get("asunto")
                    }

        enriched_solicitudes = []
        for s in solis:
            created_at = s.get("created_at")
            if not created_at:
                continue
            if (now - dt.datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))).total_seconds() <= 48 * 3600:
                continue

            tel = s.get("telefono_institucion")
            email = s.get("email_institucion")
            last_contact = None

            if tel:
                norm_tel = _normalize_phone(tel)
                if norm_tel:
                    last_10 = norm_tel[-10:]
                    wa = wa_by_phone.get(last_10)
                    if wa:
                        last_contact = {
                            "canal": "whatsapp",
                            "hace_cuanto": wa["timestamp"],
                            "de_nosotros": wa["from_me"],
                            "snippet": wa["texto"]
                        }

            if email:
                email_clean = email.lower().strip()
                gm = gmail_by_email.get(email_clean)
                if gm:
                    gm_time = gm["ultimo_mensaje_at"]
                    if not last_contact or (gm_time and gm_time > last_contact["hace_cuanto"]):
                        last_contact = {
                            "canal": "gmail",
                            "hace_cuanto": gm_time,
                            "de_nosotros": gm["ultimo_mensaje_de"] == "nos",
                            "snippet": gm["asunto"]
                        }

            s_copy = dict(s)
            s_copy["ultimo_contacto"] = last_contact
            enriched_solicitudes.append(s_copy)

        solicitudes_pendientes = enriched_solicitudes[:15]
    except Exception as exc:  # noqa: BLE001
        print(f"[daily_brief_from_db] solicitudes: {exc}", flush=True)

    try:
        lanzs = sb.table("lanzamientos_pps").select(
            "id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_gestion,"
            "estado_convocatoria,cupos_disponibles,proximo_seguimiento"
        ).neq("estado_gestion", "Archivado").order("fecha_finalizacion").limit(30).execute().data or []
        for l in lanzs:
            if not l.get("fecha_finalizacion"):
                continue
            end = dt.datetime.fromisoformat(str(l["fecha_finalizacion"]).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=dt.timezone.utc)
            diff_days = (end - now).total_seconds() / 86400
            if -1 <= diff_days <= 7:
                lanzamientos_por_vencer.append(l)
        lanzamientos_por_vencer = lanzamientos_por_vencer[:15]
    except Exception as exc:  # noqa: BLE001
        print(f"[daily_brief_from_db] lanzamientos: {exc}", flush=True)

    try:
        gmail_sin_responder = sb.table("gmail_hilos").select(
            "thread_id,asunto,ultimo_mensaje_de,ultimo_mensaje_at,estado,clasificacion,institucion_id"
        ).eq("estado", "esperando_respuesta").order("ultimo_mensaje_at").limit(20).execute().data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[daily_brief_from_db] gmail: {exc}", flush=True)

    try:
        whatsapp_pendientes = sb.table("whatsapp_mensajes").select(
            "id,chat_jid,institucion_id,autor,texto,timestamp"
        ).eq("from_me", False).order("timestamp", desc=True).limit(20).execute().data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[daily_brief_from_db] whatsapp: {exc}", flush=True)

    instituciones_sin_contacto: list[dict[str, Any]] = []
    try:
        # Cruza instituciones vs último contacto registrado en gmail_hilos / whatsapp_mensajes.
        # Para instituciones activas (estado_gestion != Archivado) cuyo último contacto fue >30 días.
        cutoff = (now - dt.timedelta(days=30)).isoformat()
        instituciones = sb.table("instituciones").select(
            "id,nombre,convenio_nuevo,orientaciones,tutor,telefono,email_institucion"
        ).limit(200).execute().data or []
        gmail_recent = sb.table("gmail_hilos").select("institucion_id,ultimo_mensaje_at").gte(
            "ultimo_mensaje_at", cutoff
        ).limit(500).execute().data or []
        wa_recent = sb.table("whatsapp_mensajes").select("institucion_id,timestamp").gte(
            "timestamp", cutoff
        ).limit(2000).execute().data or []
        active_ids = {r["institucion_id"] for r in gmail_recent if r.get("institucion_id")}
        active_ids |= {r["institucion_id"] for r in wa_recent if r.get("institucion_id")}
        # solo las que tienen algún lanzamiento activo / no archivado (para no inundar con todo el catálogo)
        active_launch_ids = set()
        try:
            active_launches = sb.table("lanzamientos_pps").select("institucion_id").neq(
                "estado_gestion", "Archivado"
            ).limit(500).execute().data or []
            active_launch_ids = {r["institucion_id"] for r in active_launches if r.get("institucion_id")}
        except Exception:  # noqa: BLE001
            pass
        for inst in instituciones:
            if inst["id"] in active_ids:
                continue
            if active_launch_ids and inst["id"] not in active_launch_ids:
                continue
            instituciones_sin_contacto.append(inst)
        instituciones_sin_contacto = instituciones_sin_contacto[:15]
    except Exception as exc:  # noqa: BLE001
        print(f"[daily_brief_from_db] instituciones_sin_contacto: {exc}", flush=True)

    return _create_daily_brief(
        DailyBriefInput(
            solicitudes_pendientes=solicitudes_pendientes,
            lanzamientos_por_vencer=lanzamientos_por_vencer,
            instituciones_sin_contacto=instituciones_sin_contacto,
            gmail_sin_responder=gmail_sin_responder,
            whatsapp_pendientes=whatsapp_pendientes,
        ),
        source="supabase",
    )


# ---------- task: draft_reply ----------

class DraftReplyInput(BaseModel):
    source: str  # "gmail" | "whatsapp"
    thread_id: str | None = None
    institucion_id: str | None = None
    mensaje_original: str
    contexto_extra: str | None = None


@app.post("/tasks/draft_reply", dependencies=[Depends(require_token)])
def draft_reply(payload: DraftReplyInput) -> dict[str, Any]:
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("draft_reply.start", payload.model_dump(), invocation_id=invocation_id)

    institucion_md = ""
    if payload.institucion_id:
        try:
            res = sb.table("institucion_resumen").select("*").eq("institucion_id", payload.institucion_id).limit(1).execute()
            if res.data:
                institucion_md = json.dumps(res.data[0], ensure_ascii=False, indent=2)
        except Exception as exc:  # noqa: BLE001
            print(f"[draft_reply] no se pudo leer institucion_resumen: {exc}", flush=True)

    schema = (
        '{"requiere_decision_humana": true|false,'
        '"motivo": "string (si requiere_decision_humana=true)",'
        '"borrador": "string (vacio si requiere_decision_humana=true)",'
        '"asunto": "string (solo para gmail)"}'
    )
    user = (
        f"Origen: {payload.source}\n"
        f"Mensaje recibido:\n---\n{payload.mensaje_original}\n---\n\n"
        f"Resumen de la institución (si aplica):\n{institucion_md or '(no hay)'}\n\n"
        f"Contexto extra:\n{payload.contexto_extra or '(no hay)'}\n\n"
        "Si esto requiere una decisión institucional, NO redactes el borrador: "
        "explicá por qué y qué información falta."
    )
    result = llm_json(user, schema_hint=schema)

    tipo = "email_draft" if payload.source == "gmail" else "whatsapp_followup"
    suggestion_id = str(uuid.uuid4())
    sb.table("agent_suggestions").insert({
        "id": suggestion_id,
        "tipo": tipo,
        "payload": result,
        "contexto": {
            "model": HERMES_MODEL,
            "source": payload.source,
            "thread_id": payload.thread_id,
            "extra": payload.contexto_extra,
        },
        "institucion_id": payload.institucion_id,
    }).execute()

    audit(
        "draft_reply.done",
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"suggestion_id": suggestion_id, "content": result}


# ---------- task: draft_pending_emails (inteligente) ----------
# Genera proactivamente borradores para los correos "esperando respuesta" que
# todavía no tienen uno. El panel los muestra al instante (sin esperar al LLM).
# Pensado para dispararse por cron (n8n) y también on-demand desde el panel.

class DraftPendingInput(BaseModel):
    limit: int = 10
    only_missing: bool = True  # solo los hilos sin borrador vigente


# Remitentes/dominios que NO son institucionales de PPS (ruido a filtrar del flujo).
_RUIDO_REMITENTES = (
    "cloudflare", "n8n", "noreply", "no-reply", "notifications", "newsletter",
    "mailer-daemon", "postmaster", "github", "google.com", "accounts.google",
    "supabase", "openrouter", "baserow", "youtube", "updates", "billing", "security@",
    "hello@", "team@", "info@vercel", "atlassian", "slack",
)
# Palabras que indican que un correo SÍ es del dominio PPS.
_SENALES_PPS = (
    "pps", "practica", "práctica", "convenio", "acreditaci", "horas", "pasant",
    "estudiante", "alumno", "alumna", "psicolog", "uflo", "supervis", "cupo",
    "convocatoria", "institucion", "institución", "informe", "seguro", "tutor",
)


def _es_correo_pps(hilo: dict[str, Any]) -> bool:
    """Heurística barata: ¿este hilo es realmente del dominio PPS?

    Descarta ruido (Cloudflare, n8n, newsletters…) y exige alguna señal PPS en
    asunto/cuerpo o un remitente @uflouniversidad.edu.ar.
    """
    parts = " ".join(str(p) for p in (hilo.get("participantes") or [])).lower()
    raw = hilo.get("raw_mensajes") or []
    from_field = ""
    if isinstance(raw, list) and raw:
        from_field = str(raw[-1].get("from", "")).lower()
    quien = f"{parts} {from_field}"
    # 1. Ruido explícito → fuera.
    if any(r in quien for r in _RUIDO_REMITENTES):
        # salvo que sea claramente uflo
        if "uflouniversidad.edu.ar" not in quien:
            return False
    # 2. Remitente institucional UFLO → adentro.
    if "uflouniversidad.edu.ar" in quien:
        return True
    # 3. Señal PPS en asunto o cuerpo.
    texto = f"{hilo.get('asunto','')} {_thread_plaintext(hilo)}".lower()
    return any(s in texto for s in _SENALES_PPS)


def _thread_plaintext(hilo: dict[str, Any]) -> str:
    """Arma el texto del último mensaje recibido a partir de raw_mensajes."""
    raw = hilo.get("raw_mensajes") or []
    if not isinstance(raw, list) or not raw:
        return hilo.get("asunto") or ""
    # último mensaje que NO sea nuestro
    me = "blas.rivera@uflouniversidad.edu.ar"
    theirs = [m for m in raw if me not in str(m.get("from", "")).lower()]
    last = (theirs or raw)[-1]
    return f"Asunto: {hilo.get('asunto', '')}\n\n{last.get('snippet') or last.get('body') or ''}"


# Guía de tono compartida para los borradores de correo (cálido, no acartonado).
_TONO_BORRADOR = (
    "TONO Y FORMATO del borrador:\n"
    "- Arrancá SIEMPRE con 'Hola [primer nombre],' usando el primer nombre de quien escribe "
    "(deducilo del remitente o de la firma; si no se puede, usá 'Hola,').\n"
    "- Cordial y cercano, NADA acartonado. Prohibido 'Estimado/a', 'Cordialmente', "
    "'Por la presente', 'Quedo a la espera'.\n"
    "- Tuteá. Frases cortas y claras. Cerrá con 'Saludos,\\nBlas'.\n"
    "- Directo al punto: respondé lo que preguntan sin vueltas."
)


@app.post("/tasks/draft_pending_emails", dependencies=[Depends(require_token)])
def draft_pending_emails(payload: DraftPendingInput) -> dict[str, Any]:
    """Recorre los gmail_hilos esperando respuesta y genera borradores faltantes."""
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("draft_pending.start", payload.model_dump(), invocation_id=invocation_id)

    try:
        hilos = sb.table("gmail_hilos").select(
            "thread_id,asunto,raw_mensajes,institucion_id,estado,ultimo_mensaje_at"
        ).eq("estado", "esperando_respuesta").order("ultimo_mensaje_at", desc=True).limit(payload.limit).execute().data or []
    except Exception as exc:  # noqa: BLE001
        audit("draft_pending.error", error=str(exc), invocation_id=invocation_id)
        raise HTTPException(status_code=500, detail=f"no se pudo leer gmail_hilos: {exc}")

    # thread_ids que ya tienen un borrador pendiente
    existing_ids: set[str] = set()
    if payload.only_missing:
        try:
            sugg = sb.table("agent_suggestions").select("contexto").eq("tipo", "email_draft").eq("estado", "pending").limit(500).execute().data or []
            for s in sugg:
                tid = (s.get("contexto") or {}).get("thread_id")
                if tid:
                    existing_ids.add(str(tid))
        except Exception as exc:  # noqa: BLE001
            print(f"[draft_pending] no se pudo leer suggestions: {exc}", flush=True)

    schema = (
        '{"requiere_decision_humana": true|false,'
        '"motivo": "string (si requiere_decision_humana=true)",'
        '"borrador": "string (vacio si requiere_decision_humana=true)",'
        '"asunto": "string"}'
    )

    generated = 0
    skipped = 0
    for hilo in hilos:
        tid = str(hilo.get("thread_id") or "")
        if not tid or (payload.only_missing and tid in existing_ids):
            skipped += 1
            continue
        # Filtrar ruido: solo correos realmente del dominio PPS.
        if not _es_correo_pps(hilo):
            skipped += 1
            continue

        institucion_md = ""
        if hilo.get("institucion_id"):
            try:
                res = sb.table("institucion_resumen").select("*").eq("institucion_id", hilo["institucion_id"]).limit(1).execute()
                if res.data:
                    institucion_md = json.dumps(res.data[0], ensure_ascii=False, indent=2)
            except Exception:  # noqa: BLE001
                pass

        user = (
            "Origen: gmail\n"
            f"Mensaje recibido:\n---\n{_thread_plaintext(hilo)}\n---\n\n"
            f"Resumen de la institución (si aplica):\n{institucion_md or '(no hay)'}\n\n"
            "Redactá una respuesta como coordinador de PPS.\n\n"
            f"{_TONO_BORRADOR}\n\n"
            "Si requiere una decisión institucional que no podés tomar, NO redactes: "
            "explicá por qué y qué falta."
        )
        try:
            result = llm_json(user, schema_hint=schema)
        except Exception as exc:  # noqa: BLE001
            print(f"[draft_pending] LLM falló para {tid}: {exc}", flush=True)
            continue

        suggestion_id = str(uuid.uuid4())
        try:
            sb.table("agent_suggestions").insert({
                "id": suggestion_id,
                "tipo": "email_draft",
                "payload": result,
                "contexto": {
                    "model": HERMES_MODEL,
                    "source": "gmail",
                    "thread_id": tid,
                    "asunto": hilo.get("asunto"),
                    "auto": True,
                },
                "institucion_id": hilo.get("institucion_id"),
            }).execute()
            generated += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[draft_pending] no se pudo guardar borrador {tid}: {exc}", flush=True)

    output = {"hilos_revisados": len(hilos), "borradores_generados": generated, "omitidos": skipped}
    audit("draft_pending.done", output=output, invocation_id=invocation_id, duration_ms=int((time.time() - t0) * 1000))
    return output


# ---------- task: plan_today (tablero de acciones del día) ----------
# Hermes arma una lista priorizada de ACCIONES concretas para hoy, de varias
# fuentes (no solo correos): responder mails PPS, reinsistir instituciones,
# verificar finalizaciones, mover solicitudes estancadas. Cada acción se guarda
# como agent_suggestions tipo "accion_dia" con un destino accionable.

class PlanTodayInput(BaseModel):
    limit: int = 9


def _accion_link(tipo: str, ref: dict[str, Any]) -> str:
    """Ruta interna del panel para resolver la acción."""
    if tipo == "responder_mail":
        return f"/admin/gestion?view=mails&mails=lista&thread={ref.get('thread_id','')}"
    if tipo == "verificar_finalizacion":
        return "/admin/solicitudes?tab=egreso"
    if tipo == "mover_solicitud":
        # Se acciona DENTRO de Gestión (panel derecho con el borrador listo),
        # no navegamos a Solicitudes. El frontend abre el panel desde la acción.
        return f"/admin/gestion?view=mails&accion_solicitud={ref.get('solicitud_id','')}"
    if tipo == "correccion":
        return "/admin/solicitudes?tab=correcciones"
    return "/admin/gestion"


def _dias_desde(valor: Any, *, ahora: dt.datetime) -> int | None:
    """Días transcurridos desde `valor` (string ISO date o datetime) hasta `ahora`.

    Tolera tanto fechas con hora y timezone (`2026-05-20T23:16:02+00:00`) como
    fechas DATE puras de Postgres (`2026-05-20`), que al parsearse quedan naive.
    A las naive les asignamos UTC para poder restarlas de `ahora` (aware) sin el
    error 'can't subtract offset-naive and offset-aware datetimes'. Devuelve
    None si no se puede parsear.
    """
    if not valor:
        return None
    try:
        d = dt.datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return int((ahora - d).total_seconds() // 86400)


def _es_celular_ar(telefono: str) -> bool:
    """Heurística: ¿este número argentino es un celular (sirve para WhatsApp)?

    Reglas prácticas sobre el número normalizado (solo dígitos):
      · Celular AR con prefijo internacional: 54 9 + área + abonado → tiene el
        '9' después del 54 (ej. 5492604123456).
      · Celular AR local sin 54: suele empezar con '15' o tener 10 dígitos con
        prefijo de área móvil. Es difícil distinguir 100%, así que somos
        conservadores: si NO podemos afirmar que es celular, devolvemos False
        (preferimos mail antes que mandar un WhatsApp a un fijo).
    """
    n = _normalize_phone(telefono)
    if not n:
        return False
    if n.startswith("549"):
        return True
    if n.startswith("54") and len(n) >= 12 and n[2] == "9":
        return True
    # '15' intermedio (formato local de celular): 0 área 15 abonado
    if "15" in n and len(n) >= 10:
        # señal débil; lo tratamos como celular solo si el número es largo
        return len(n) >= 11
    return False


def _elegir_canal_contacto(sol: dict[str, Any]) -> dict[str, Any]:
    """Decide cómo contactar a la institución de una solicitud estancada.

    Devuelve {canal: 'whatsapp'|'email'|'ninguno', destino, telefono, email,
    referente, es_celular}. Prioriza WhatsApp si hay un celular usable; si no,
    cae a email; si no hay nada, 'ninguno'.
    """
    tel = (sol.get("telefono_institucion") or "").strip()
    email = (sol.get("email_institucion") or sol.get("email") or "").strip()
    referente = (sol.get("referente_institucion") or sol.get("contacto_tutor") or "").strip()
    es_cel = _es_celular_ar(tel) if tel else False

    if es_cel:
        return {
            "canal": "whatsapp", "destino": _normalize_phone(tel), "telefono": tel,
            "email": email, "referente": referente, "es_celular": True,
        }
    if email:
        return {
            "canal": "email", "destino": email, "telefono": tel,
            "email": email, "referente": referente, "es_celular": False,
        }
    if tel:
        # Hay un teléfono pero no parece celular y no hay email: igual proponemos
        # email vacío no sirve → marcamos whatsapp como último recurso si el
        # número tiene pinta de móvil largo, si no 'ninguno'.
        return {
            "canal": "ninguno", "destino": tel, "telefono": tel,
            "email": email, "referente": referente, "es_celular": False,
        }
    return {
        "canal": "ninguno", "destino": "", "telefono": "", "email": "",
        "referente": referente, "es_celular": False,
    }


# Tono compartido para los mensajes salientes (cálido, no acartonado).
_TONO_OUTREACH = (
    "TONO Y FORMATO:\n"
    "- Cordial y cercano, NADA acartonado. Prohibido 'Estimado/a', 'Cordialmente', "
    "'Por la presente', 'Quedo a la espera'. Tuteá. Sé breve, concreto y amable.\n"
    "- Si hay nombre de referente, arrancá con 'Hola [primer nombre],'. Si no, 'Hola,'.\n"
    "- Cerrá con 'Saludos,\\nBlas — Coordinación de PPS, UFLO Psicología'.\n"
    "- WhatsApp: 1 párrafo corto, sin asunto. Email: incluí un asunto claro."
)

# Instrucciones según haya o no conversación previa.
_OUTREACH_PRIMER_CONTACTO = (
    "SITUACIÓN: PRIMER CONTACTO. NO hubo conversación previa con esta institución "
    "por este canal. NO digas 'retomo', 'volvemos a escribir', 'como hablamos', "
    "'el tema que veníamos viendo', 'que estábamos organizando' ni nada que implique "
    "un intercambio anterior. Presentate: sos el coordinador de PPS de Psicología de "
    "UFLO, y escribís para INICIAR el contacto y consultar si la institución estaría "
    "interesada en recibir estudiantes en práctica. Sé claro sobre quién sos y para qué escribís."
)
_OUTREACH_SEGUIMIENTO = (
    "SITUACIÓN: SEGUIMIENTO. YA hubo conversación previa (te paso los últimos "
    "mensajes). Retomá el hilo de forma coherente con lo último que se habló, sin "
    "repetir lo ya dicho. Hacé referencia natural a la conversación anterior."
)


def _historial_conversacion(sol: dict[str, Any], canal: str, *, limite: int = 6) -> list[dict[str, Any]]:
    """Trae los últimos mensajes de la conversación con la institución.

    Según el canal elegido busca el historial real:
      · whatsapp → whatsapp_mensajes que matcheen el teléfono (últimos 10 dígitos).
      · email    → gmail_hilos cuyo email_institucion/participantes matcheen, y
                   sus raw_mensajes.
    Devuelve una lista normalizada [{de_mi, autor, texto, fecha}] del más viejo
    al más nuevo, recortada a `limite`. Vacía si no hay nada.
    """
    out: list[dict[str, Any]] = []
    try:
        if canal == "whatsapp":
            tel = _normalize_phone(sol.get("telefono_institucion") or "")
            if not tel:
                return []
            last10 = tel[-10:]
            rows = sb.table("whatsapp_mensajes").select(
                "chat_jid,from_me,autor,texto,timestamp"
            ).order("timestamp", desc=True).limit(800).execute().data or []
            msgs = []
            for m in rows:
                jid = m.get("chat_jid") or ""
                jphone = _normalize_phone(jid.split("@")[0] if "@" in jid else jid)
                if jphone and jphone[-10:] == last10:
                    msgs.append({
                        "de_mi": bool(m.get("from_me")),
                        "autor": m.get("autor") or ("Vos" if m.get("from_me") else "Institución"),
                        "texto": m.get("texto") or "",
                        "fecha": m.get("timestamp"),
                    })
            msgs.sort(key=lambda x: str(x.get("fecha") or ""))
            out = msgs[-limite:]
        else:  # email
            email = (sol.get("email_institucion") or sol.get("email") or "").lower().strip()
            if not email:
                return []
            hilos = sb.table("gmail_hilos").select(
                "asunto,email_institucion,participantes,raw_mensajes,ultimo_mensaje_at"
            ).order("ultimo_mensaje_at", desc=True).limit(200).execute().data or []
            hilo = None
            for h in hilos:
                blob = f"{h.get('email_institucion') or ''} {json.dumps(h.get('participantes') or '', ensure_ascii=False)}".lower()
                if email in blob:
                    hilo = h
                    break
            if not hilo:
                return []
            raw = hilo.get("raw_mensajes") or []
            if isinstance(raw, list):
                for m in raw[-limite:]:
                    frm = str(m.get("from", "")).lower()
                    out.append({
                        "de_mi": "blas.rivera@uflouniversidad.edu.ar" in frm,
                        "autor": str(m.get("from", "")) or "Contacto",
                        "texto": str(m.get("snippet") or m.get("body") or ""),
                        "fecha": str(m.get("date") or hilo.get("ultimo_mensaje_at") or ""),
                    })
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] historial {canal}: {exc}", flush=True)
        return []
    return out


def _draft_outreach_solicitud(
    sol: dict[str, Any], canal: str, referente: str, dias: int, historial: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    """Pide al LLM un mensaje listo para enviar (WhatsApp o email).

    Distingue PRIMER CONTACTO (sin historial) de SEGUIMIENTO (con historial): el
    tono cambia para no decir 'retomo el tema' cuando nunca se habló con la
    institución.
    """
    alumno = sol.get("nombre_alumno") or "un/a estudiante"
    institucion = sol.get("nombre_institucion") or "la institución"
    orientacion = sol.get("orientacion_sugerida") or sol.get("tipo_practica") or ""
    es_seguimiento = bool(historial)

    if canal == "whatsapp":
        schema = '{"mensaje":"string (1 párrafo, listo para WhatsApp)"}'
        canal_hint = "Es un WhatsApp. Sin asunto. Un solo párrafo corto."
    else:
        schema = '{"asunto":"string","mensaje":"string (cuerpo del email)"}'
        canal_hint = "Es un email. Incluí asunto."

    # Bloque de conversación previa: SOLO si es seguimiento.
    hist_txt = ""
    if es_seguimiento:
        lineas = []
        for m in historial or []:
            quien = "Vos" if m.get("de_mi") else (m.get("autor") or "Institución")
            txt = (m.get("texto") or "").strip().replace("\n", " ")
            if len(txt) > 240:
                txt = txt[:240] + "…"
            if txt:
                lineas.append(f"  [{quien}] {txt}")
        if lineas:
            hist_txt = (
                "\nÚltimos mensajes de la conversación (del más viejo al más nuevo):\n"
                + "\n".join(lineas)
                + "\n"
            )

    situacion = _OUTREACH_SEGUIMIENTO if es_seguimiento else _OUTREACH_PRIMER_CONTACTO
    proposito = (
        f"- La gestión lleva {dias} días sin avanzar.\n"
        if es_seguimiento
        else "- Es el primer mensaje a esta institución para esta PPS.\n"
    )

    user = (
        f"Generá un mensaje para gestionar una PPS.\n\n"
        f"{situacion}\n\n"
        f"Datos:\n"
        f"- Estudiante: {alumno}\n"
        f"- Institución: {institucion}\n"
        f"- Orientación/tipo: {orientacion or '(no especificada)'}\n"
        f"- Referente en la institución: {referente or '(desconocido)'}\n"
        f"{proposito}"
        f"{hist_txt}\n"
        f"{canal_hint}\n\n{_TONO_OUTREACH}"
    )
    try:
        return llm_json(user, schema_hint=schema)
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] draft outreach falló: {exc}", flush=True)
        return {}


def _run_plan_today(limit: int = 9, *, source: str = "api") -> dict[str, Any]:
    """Genera el tablero de acciones del día. Reemplaza las acciones previas
    del día (tipo accion_dia, estado pending) por un set fresco y priorizado.

    Núcleo reutilizable: lo llaman tanto el endpoint /tasks/plan_today como el
    scheduler interno (run_plan_today_scheduled)."""
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("plan_today.start", {"limit": limit, "source": source}, invocation_id=invocation_id)
    now = dt.datetime.now(dt.timezone.utc)
    acciones: list[dict[str, Any]] = []

    # ── Fuente 1: correos PPS esperando respuesta (con borrador si existe) ──
    try:
        hilos = sb.table("gmail_hilos").select(
            "thread_id,asunto,raw_mensajes,institucion_id,estado,ultimo_mensaje_at,participantes"
        ).eq("estado", "esperando_respuesta").order("ultimo_mensaje_at", desc=True).limit(40).execute().data or []
        # borradores ya generados por thread
        drafts = sb.table("agent_suggestions").select("contexto,payload").eq("tipo", "email_draft").eq("estado", "pending").limit(500).execute().data or []
        draft_by_thread = {}
        for d in drafts:
            tid = (d.get("contexto") or {}).get("thread_id")
            if tid:
                draft_by_thread[str(tid)] = d.get("payload") or {}
        for h in hilos:
            if not _es_correo_pps(h):
                continue
            tid = str(h.get("thread_id") or "")
            draft = draft_by_thread.get(tid)
            dias = _dias_desde(h.get("ultimo_mensaje_at"), ahora=now) or 0
            tiene_borrador = bool(draft and draft.get("borrador") and not draft.get("requiere_decision_humana"))
            acciones.append({
                "tipo": "responder_mail",
                "titulo": f"Responder: {h.get('asunto') or '(sin asunto)'}",
                "por_que": f"Mail esperando respuesta hace {dias} día(s)." + (" Hermes ya dejó un borrador." if tiene_borrador else ""),
                "prioridad": "alta" if dias >= 5 else "media",
                "tiene_borrador": tiene_borrador,
                "ref": {"thread_id": tid, "institucion_id": h.get("institucion_id")},
                "_score": (2 if dias >= 5 else 1) * 100 + dias,
            })
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] gmail: {exc}", flush=True)

    # ── Fuente 2: solicitudes de ingreso sin movimiento (+4 días) ──
    try:
        # OJO: los valores con espacios ("No se pudo concretar") DEBEN ir como
        # lista de Python; pasarlos como string crudo "(a,b c,d)" rompe el filtro
        # de PostgREST y no excluye nada (metía solicitudes ya terminadas).
        estados_excluidos = ["Realizada", "No se pudo concretar", "Archivado"]
        # Traemos también los datos de contacto para que Hermes prepare el
        # mensaje de reactivación (WhatsApp o email) listo para enviar.
        solis = sb.table("solicitudes_pps").select(
            "id,nombre_alumno,nombre_institucion,estado_seguimiento,actualizacion,created_at,"
            "telefono_institucion,email_institucion,email,referente_institucion,contacto_tutor,"
            "orientacion_sugerida,tipo_practica"
        ).not_.in_("estado_seguimiento", estados_excluidos).order("created_at", desc=True).limit(40).execute().data or []
        # Cuántas de las solicitudes vamos a enriquecer con borrador (las más
        # estancadas primero); generar mensajes con LLM cuesta, así que ponemos
        # un tope por corrida.
        outreach_presupuesto = 12
        for s in solis:
            # Guard defensivo: aunque el filtro de arriba debería bastar, nos
            # aseguramos en Python de no incluir solicitudes ya terminadas.
            if (s.get("estado_seguimiento") or "") in estados_excluidos:
                continue
            ref_date = s.get("actualizacion") or s.get("created_at")
            dias = _dias_desde(ref_date, ahora=now)
            if dias is None:
                continue
            if dias < 4:
                continue

            # Hermes decide canal (whatsapp/email/ninguno) según los datos de
            # contacto cargados, y prepara el mensaje listo para enviar.
            contacto = _elegir_canal_contacto(s)
            outreach: dict[str, Any] = {}
            historial: list[dict[str, Any]] = []
            if contacto["canal"] != "ninguno" and outreach_presupuesto > 0:
                historial = _historial_conversacion(s, contacto["canal"])
                outreach = _draft_outreach_solicitud(
                    s, contacto["canal"], contacto["referente"], dias, historial
                )
                outreach_presupuesto -= 1

            canal = contacto["canal"]
            es_seguimiento = bool(historial)
            # Verbo según haya o no contacto previo: NO inventamos "reactivar"
            # cuando nunca se habló con la institución.
            verbo = "Seguir" if es_seguimiento else "Contactar"
            canal_txt = (
                "un WhatsApp" if canal == "whatsapp" else "un correo" if canal == "email" else None
            )
            if canal == "ninguno":
                por_que = (
                    f"Solicitud sin avanzar hace {dias} días (estado: {s.get('estado_seguimiento') or '—'}). "
                    f"Sin datos de contacto cargados — revisá la solicitud."
                )
            elif es_seguimiento:
                por_que = (
                    f"Ya venías hablando con la institución y la gestión quedó frenada hace "
                    f"{dias} días. Hermes preparó {canal_txt} para retomar el hilo."
                )
            else:
                por_que = (
                    f"Solicitud sin contacto registrado hace {dias} días. Hermes preparó "
                    f"{canal_txt} de primer contacto, listo para enviar."
                )

            acciones.append({
                "tipo": "mover_solicitud",
                "titulo": f"{verbo}: {s.get('nombre_alumno') or 'Alumno'} · {s.get('nombre_institucion') or ''}".strip(),
                "por_que": por_que,
                "prioridad": "alta" if dias >= 10 else "media",
                "tiene_borrador": bool(outreach.get("mensaje")),
                "ref": {
                    "solicitud_id": s.get("id"),
                    "nombre_alumno": s.get("nombre_alumno"),
                    "nombre_institucion": s.get("nombre_institucion"),
                    "estado_seguimiento": s.get("estado_seguimiento"),
                    "dias_sin_movimiento": dias,
                    "canal": canal,
                    "es_seguimiento": es_seguimiento,
                    "destino": contacto["destino"],
                    "telefono": contacto["telefono"],
                    "email": contacto["email"],
                    "referente": contacto["referente"],
                    "outreach_asunto": outreach.get("asunto"),
                    "outreach_mensaje": outreach.get("mensaje"),
                    "historial": historial,
                },
                "_score": (2 if dias >= 10 else 1) * 100 + dias,
            })
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] solicitudes: {exc}", flush=True)

    # ── Fuente 3: finalizaciones por verificar ──
    try:
        verifs = sb.table("agent_suggestions").select("id,payload,contexto").eq("tipo", "update_estado").eq("estado", "pending").limit(40).execute().data or []
        for v in verifs:
            ctx = v.get("contexto") or {}
            if ctx.get("kind") != "verificacion_finalizacion":
                continue
            vp = (v.get("payload") or {}).get("verificacion") or {}
            estado = vp.get("estado")
            acciones.append({
                "tipo": "verificar_finalizacion",
                "titulo": f"Verificar finalización: {ctx.get('nombre_alumno') or 'alumno'}",
                "por_que": "Hermes analizó la documentación y " + (
                    "marcó problemas críticos." if estado == "critical" else
                    "dejó observaciones." if estado == "attention" else
                    "la dio por verificada, falta tu OK."),
                "prioridad": "alta" if estado == "critical" else "media",
                "tiene_borrador": False,
                "ref": {"suggestion_id": v.get("id")},
                "_score": (2 if estado == "critical" else 1) * 100 + 5,
            })
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] finalizaciones: {exc}", flush=True)

    # ── Fuente 4 (DESACTIVADA): instituciones para reinsistir ──
    # El ciclo de vida institucional (recontactar / reinsistir / por finalizar)
    # ahora lo aporta el FRONTEND directamente desde lanzamientos_pps, en la
    # misma bandeja unificada "Hoy". Lo generábamos también acá y se duplicaba,
    # así que lo quitamos del plan. Si en el futuro Hermes necesita redactar el
    # borrador de reinsistencia, se reactiva acá con la misma forma que la
    # Fuente 2 (con _draft_outreach_solicitud).

    # Priorizar y recortar.
    acciones.sort(key=lambda a: -a["_score"])
    acciones = acciones[:limit]

    # Reemplazar el plan del día: descartar acciones previas pendientes.
    try:
        sb.table("agent_suggestions").update({"estado": "discarded"}).eq("tipo", "accion_dia").eq("estado", "pending").execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[plan_today] no se pudo limpiar plan previo: {exc}", flush=True)

    # Insertar las nuevas acciones.
    inserted = 0
    for orden, a in enumerate(acciones):
        try:
            sb.table("agent_suggestions").insert({
                "id": str(uuid.uuid4()),
                "tipo": "accion_dia",
                "payload": {
                    "tipo_accion": a["tipo"],
                    "titulo": a["titulo"],
                    "por_que": a["por_que"],
                    "prioridad": a["prioridad"],
                    "tiene_borrador": a["tiene_borrador"],
                    "link": _accion_link(a["tipo"], a["ref"]),
                    "orden": orden,
                },
                "contexto": {"model": HERMES_MODEL, "ref": a["ref"], "generado_at": now.isoformat(), "source": source},
                "institucion_id": a["ref"].get("institucion_id"),
            }).execute()
            inserted += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[plan_today] no se pudo guardar accion: {exc}", flush=True)

    output = {"acciones_generadas": inserted}
    audit("plan_today.done", output=output, invocation_id=invocation_id, duration_ms=int((time.time() - t0) * 1000))
    return output


@app.post("/tasks/plan_today", dependencies=[Depends(require_token)])
def plan_today(payload: PlanTodayInput) -> dict[str, Any]:
    """Endpoint público: recalcula el plan del día on-demand (botón del panel)."""
    return _run_plan_today(payload.limit, source="api")


# ---------- task: institucion_resumen ----------

class InstitucionResumenInput(BaseModel):
    institucion_id: str | None = None  # si no se da, refresca hasta `limit` instituciones activas
    limit: int = 30
    only_with_activity: bool = True    # default: solo refrescar las que tuvieron actividad reciente


def _refresh_one_institucion_resumen(institucion_id: str) -> dict[str, Any]:
    """Genera/actualiza el resumen para una institución. Devuelve métricas."""
    try:
        inst_rows = sb.table("instituciones").select("*").eq("id", institucion_id).limit(1).execute().data
    except Exception as exc:  # noqa: BLE001
        return {"institucion_id": institucion_id, "error": f"read inst: {exc}"}
    if not inst_rows:
        return {"institucion_id": institucion_id, "error": "institucion no encontrada"}
    inst = inst_rows[0]

    # contexto: lanzamientos, gmail, whatsapp, resumen previo
    lanzamientos = sb.table("lanzamientos_pps").select(
        "id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,estado_gestion,"
        "estado_convocatoria,cupos_disponibles,proximo_seguimiento,horas_acreditadas"
    ).eq("institucion_id", institucion_id).neq("estado_gestion", "Archivado").limit(20).execute().data or []
    gmail = sb.table("gmail_hilos").select(
        "thread_id,asunto,ultimo_mensaje_de,ultimo_mensaje_at,estado,clasificacion"
    ).eq("institucion_id", institucion_id).order("ultimo_mensaje_at", desc=True).limit(20).execute().data or []
    whatsapp = sb.table("whatsapp_mensajes").select(
        "id,autor,texto,from_me,timestamp"
    ).eq("institucion_id", institucion_id).order("timestamp", desc=True).limit(30).execute().data or []
    prev = sb.table("institucion_resumen").select("*").eq("institucion_id", institucion_id).limit(1).execute().data
    prev_row = prev[0] if prev else None

    # último contacto + canal
    last_dates = []
    for g in gmail:
        if g.get("ultimo_mensaje_at"):
            last_dates.append((g["ultimo_mensaje_at"], "gmail"))
    for w in whatsapp:
        if w.get("timestamp"):
            last_dates.append((w["timestamp"], "whatsapp"))
    ultimo_contacto_at, ultimo_canal = (None, None)
    if last_dates:
        last_dates.sort(reverse=True)
        ultimo_contacto_at, ultimo_canal = last_dates[0]

    schema = (
        '{"resumen":"string (1-2 frases del estado actual del vínculo)",'
        '"sugerencia":"string (1 frase con próximo paso concreto para Blas, o null)",'
        '"pendientes_concretos":["string"]}'
    )
    tuyas_md = _read_tuyas()
    user_prompt = (
        "Hermes, generá un resumen ejecutivo del vínculo con esta institución para la "
        "ficha del panel. El campo `sugerencia` es la caja morada 'Hermes sugiere' — sé "
        "concreto, accionable, mencioná la institución por nombre. Si no hay nada útil, "
        "devolvé null en sugerencia. NO inventes datos que no estén en lo que te paso.\n\n"
        f"--- criterios del operador (tuyas/) ---\n{tuyas_md[:3000] if tuyas_md else '(vacío)'}\n\n"
        f"--- institución ---\n{json.dumps(inst, ensure_ascii=False, indent=2)}\n\n"
        f"--- lanzamientos activos ({len(lanzamientos)}) ---\n{json.dumps(lanzamientos, ensure_ascii=False, indent=2)}\n\n"
        f"--- gmail recientes ({len(gmail)}) ---\n{json.dumps(gmail, ensure_ascii=False, indent=2)}\n\n"
        f"--- whatsapp recientes ({len(whatsapp)}) ---\n{json.dumps(whatsapp[:15], ensure_ascii=False, indent=2)}\n\n"
        f"--- resumen previo (si existe) ---\n{json.dumps(prev_row or {}, ensure_ascii=False, indent=2)}"
    )
    result = llm_json(user_prompt, schema_hint=schema)

    row = {
        "institucion_id": institucion_id,
        "resumen": result.get("resumen") or "(sin resumen)",
        "ultimo_contacto_at": ultimo_contacto_at,
        "ultimo_canal": ultimo_canal,
        "pendientes_concretos": {
            "items": result.get("pendientes_concretos", []),
            "sugerencia": result.get("sugerencia"),
        },
        "actualizado_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "version_prompt": HERMES_MODEL,
    }
    try:
        sb.table("institucion_resumen").upsert(row, on_conflict="institucion_id").execute()
        return {
            "institucion_id": institucion_id,
            "nombre": inst.get("nombre"),
            "sugerencia": result.get("sugerencia"),
            "pendientes": len(result.get("pendientes_concretos", [])),
        }
    except Exception as exc:  # noqa: BLE001
        return {"institucion_id": institucion_id, "error": f"upsert: {exc}"}


@app.post("/tasks/institucion_resumen", dependencies=[Depends(require_token)])
def institucion_resumen(payload: InstitucionResumenInput = InstitucionResumenInput()) -> dict[str, Any]:
    """Refresca el `institucion_resumen` (la caja morada 'Hermes sugiere').

    - Si `institucion_id` viene: refresca solo esa.
    - Si no viene: refresca las instituciones que tuvieron actividad reciente o
      tienen lanzamientos activos, hasta `limit`.
    """
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("institucion_resumen.start", payload.model_dump(), invocation_id=invocation_id)

    if payload.institucion_id:
        ids = [payload.institucion_id]
    else:
        try:
            # IDs con actividad: lanzamientos activos + actividad reciente en gmail/whatsapp
            launches = sb.table("lanzamientos_pps").select("institucion_id").neq(
                "estado_gestion", "Archivado"
            ).limit(500).execute().data or []
            ids_set = {r["institucion_id"] for r in launches if r.get("institucion_id")}
            if payload.only_with_activity:
                cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).isoformat()
                gmail = sb.table("gmail_hilos").select("institucion_id").gte(
                    "ultimo_mensaje_at", cutoff
                ).limit(500).execute().data or []
                ids_set |= {r["institucion_id"] for r in gmail if r.get("institucion_id")}
                wa = sb.table("whatsapp_mensajes").select("institucion_id").gte(
                    "timestamp", cutoff
                ).limit(2000).execute().data or []
                ids_set |= {r["institucion_id"] for r in wa if r.get("institucion_id")}
            ids = sorted(ids_set)[: payload.limit]
        except Exception as exc:  # noqa: BLE001
            audit("institucion_resumen.error", {"step": "list", "err": str(exc)},
                  invocation_id=invocation_id, error=str(exc))
            raise HTTPException(status_code=500, detail=f"fallo listando: {exc}")

    results = []
    for iid in ids:
        results.append(_refresh_one_institucion_resumen(iid))

    summary = {
        "instituciones_procesadas": len(results),
        "con_sugerencia": sum(1 for r in results if r.get("sugerencia")),
        "con_error": sum(1 for r in results if r.get("error")),
    }
    audit(
        "institucion_resumen.done",
        output={**summary, "sample": results[:5]},
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"summary": summary, "results": results}


# ---------- task: classify_email ----------

class ClassifyEmailInput(BaseModel):
    thread_id: str
    mensaje: str
    asunto: str | None = None
    remitente: str | None = None
    institucion_id: str | None = None


class GmailSyncInput(BaseModel):
    messages: list[dict[str, Any]] = []


def _headers_dict(message: dict[str, Any]) -> dict[str, str]:
    headers = message.get("payload", {}).get("headers", []) or []
    return {
        str(header.get("name", "")).lower(): str(header.get("value", ""))
        for header in headers
        if header.get("name")
    }


def _extract_email(value: str) -> str:
    match = re.search(r"<([^>]+)>", value or "")
    return (match.group(1) if match else value or "").lower().strip()


def _split_emails(value: str) -> list[str]:
    emails: list[str] = []
    for part in (value or "").split(","):
        email = _extract_email(part)
        if email:
            emails.append(email)
    return emails


def _message_date_ms(message: dict[str, Any], headers: dict[str, str]) -> int:
    candidates = (
        message.get("internalDate"),
        message.get("date"),
        message.get("Date"),
        headers.get("date"),
    )
    for candidate in candidates:
        if candidate is None:
            continue
        try:
            numeric = int(str(candidate))
            if numeric > 10_000_000_000:
                return numeric
            if numeric > 0:
                return numeric * 1000
        except ValueError:
            pass
        try:
            parsed = dt.datetime.fromisoformat(str(candidate).replace("Z", "+00:00"))
            return int(parsed.timestamp() * 1000)
        except ValueError:
            try:
                return int(dt.datetime.strptime(str(candidate), "%a, %d %b %Y %H:%M:%S %z").timestamp() * 1000)
            except ValueError:
                continue
    return int(time.time() * 1000)


def _normalize_gmail_threads(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    me = "blas.rivera@uflouniversidad.edu.ar"
    by_thread: dict[str, dict[str, Any]] = {}

    for message in messages:
        thread_id = message.get("threadId") or message.get("thread_id") or message.get("id")
        if not thread_id:
            continue

        headers = _headers_dict(message)
        from_ = headers.get("from") or message.get("From") or message.get("from") or ""
        to = headers.get("to") or message.get("To") or message.get("to") or ""
        subject = headers.get("subject") or message.get("Subject") or message.get("subject") or "(sin asunto)"
        snippet = message.get("snippet") or message.get("textPlain") or message.get("textHtml") or ""
        date_ms = _message_date_ms(message, headers)
        date_iso = dt.datetime.fromtimestamp(date_ms / 1000, tz=dt.timezone.utc).isoformat()
        from_email = _extract_email(str(from_))
        from_me = me in from_email

        existing = by_thread.get(str(thread_id))
        if not existing:
            existing = {
                "thread_id": str(thread_id),
                "asunto": re.sub(r"^(Re:|Fwd:|RE:|FW:)\s*", "", str(subject), flags=re.I),
                "participantes": set(),
                "primer_mensaje_at": date_iso,
                "ultimo_mensaje_at": date_iso,
                "ultimo_mensaje_de": str(from_),
                "from_email": from_email,
                "from_me": from_me,
                "last_ms": date_ms,
                "mensajes": [],
            }
            by_thread[str(thread_id)] = existing
        elif date_ms > int(existing["last_ms"]):
            existing.update({
                "asunto": re.sub(r"^(Re:|Fwd:|RE:|FW:)\s*", "", str(subject), flags=re.I),
                "ultimo_mensaje_at": date_iso,
                "ultimo_mensaje_de": str(from_),
                "from_email": from_email,
                "from_me": from_me,
                "last_ms": date_ms,
            })

        if from_email:
            existing["participantes"].add(from_email)
        for email in _split_emails(str(to)):
            existing["participantes"].add(email)

        if date_ms < int(dt.datetime.fromisoformat(existing["primer_mensaje_at"]).timestamp() * 1000):
            existing["primer_mensaje_at"] = date_iso

        existing["mensajes"].append({
            "from": str(from_),
            "to": str(to),
            "subject": str(subject),
            "snippet": str(snippet)[:1000],
            "date": date_iso,
        })

    rows: list[dict[str, Any]] = []
    for thread in by_thread.values():
        participantes = sorted(thread["participantes"])
        uflo = thread["from_email"].endswith("@uflouniversidad.edu.ar") or any(
            email.endswith("@uflouniversidad.edu.ar") for email in participantes
        )
        rows.append({
            "thread_id": thread["thread_id"],
            "asunto": thread["asunto"],
            "participantes": participantes,
            "primer_mensaje_at": thread["primer_mensaje_at"],
            "ultimo_mensaje_at": thread["ultimo_mensaje_at"],
            "ultimo_mensaje_de": thread["ultimo_mensaje_de"],
            "estado": "respondido_por_nos" if thread["from_me"] else "esperando_respuesta",
            "clasificacion": "uflo_interno" if uflo else "externo",
            "raw_mensajes": thread["mensajes"][-5:],
        })
    return rows


@app.post("/tasks/sync_gmail_messages", dependencies=[Depends(require_token)])
def sync_gmail_messages(payload: GmailSyncInput) -> dict[str, Any]:
    """Recibe mensajes crudos de Gmail desde n8n y los persiste con service role."""
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit(
        "gmail_sync.start",
        {"messages_count": len(payload.messages)},
        invocation_id=invocation_id,
    )

    rows = _normalize_gmail_threads(payload.messages)
    if rows:
        sb.table("gmail_hilos").upsert(rows, on_conflict="thread_id").execute()

    output = {
        "messages_count": len(payload.messages),
        "threads_upserted": len(rows),
        "waiting_response": sum(1 for row in rows if row.get("estado") == "esperando_respuesta"),
    }
    audit(
        "gmail_sync.done",
        output=output,
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return output


# ---------- Gmail: acciones desde el panel (leer / responder / archivar) ----------

class GmailThreadInput(BaseModel):
    thread_id: str


class GmailSendInput(BaseModel):
    thread_id: str
    to: str
    subject: str
    body: str


class GmailModifyInput(BaseModel):
    thread_id: str
    action: str  # "archive" | "markRead" | "markUnread" | "trash"


def _call_n8n_gmail(action: str, payload: dict[str, Any], *, timeout: int = 30) -> dict[str, Any]:
    """Dispara el webhook de n8n que ejecuta la acción real con la credencial Gmail.

    n8n es quien posee el OAuth2 de Gmail. Hermes solo orquesta y audita. Si el
    webhook no está configurado, devolvemos un error claro (no rompemos).
    """
    if not N8N_GMAIL_WEBHOOK_URL:
        raise HTTPException(
            status_code=503,
            detail="GMAIL_ACTION_WEBHOOK_URL no configurado en Hermes",
        )
    import httpx

    headers = {"Content-Type": "application/json"}
    if N8N_GMAIL_WEBHOOK_TOKEN:
        headers["X-Hermes-Token"] = N8N_GMAIL_WEBHOOK_TOKEN
    body = {"action": action, **payload}
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(N8N_GMAIL_WEBHOOK_URL, json=body, headers=headers)
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:  # noqa: BLE001
            return {"ok": True}


@app.post("/tasks/gmail_thread", dependencies=[Depends(require_token)])
def gmail_thread(payload: GmailThreadInput) -> dict[str, Any]:
    """Devuelve el hilo completo. Intenta n8n (cuerpo completo de la Gmail API);
    si no hay webhook, degrada a lo guardado en `gmail_hilos.raw_mensajes`."""
    invocation_id = str(uuid.uuid4())
    audit("gmail_thread.start", {"thread_id": payload.thread_id}, invocation_id=invocation_id)

    # 1) intentar traer el hilo completo vía n8n (Capa 3: cuerpo completo on-demand)
    if N8N_GMAIL_WEBHOOK_URL:
        try:
            data = _call_n8n_gmail("getThread", {"thread_id": payload.thread_id})
            mensajes = data.get("mensajes") or data.get("messages") or []
            if mensajes:
                audit(
                    "gmail_thread.done",
                    output={"source": "n8n", "mensajes": len(mensajes)},
                    invocation_id=invocation_id,
                )
                return {
                    "thread_id": payload.thread_id,
                    "asunto": data.get("asunto") or data.get("subject"),
                    "participantes": data.get("participantes") or [],
                    "mensajes": mensajes,
                }
        except Exception as exc:  # noqa: BLE001
            print(f"[gmail_thread] n8n no disponible, uso raw_mensajes: {exc}", flush=True)

    # 2) fallback: lo que ya guardamos en Supabase
    row = (
        sb.table("gmail_hilos")
        .select("thread_id, asunto, participantes, raw_mensajes")
        .eq("thread_id", payload.thread_id)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="hilo no encontrado")
    r = row[0]
    raw = r.get("raw_mensajes") or []
    mensajes = [
        {
            "from": m.get("from", ""),
            "to": m.get("to", ""),
            "subject": m.get("subject", ""),
            "date": m.get("date", ""),
            "snippet": m.get("snippet", ""),
            "body": m.get("snippet", ""),
        }
        for m in raw
    ]
    audit(
        "gmail_thread.done",
        output={"source": "raw_mensajes", "mensajes": len(mensajes)},
        invocation_id=invocation_id,
    )
    return {
        "thread_id": payload.thread_id,
        "asunto": r.get("asunto"),
        "participantes": r.get("participantes") or [],
        "mensajes": mensajes,
    }


@app.post("/tasks/gmail_send", dependencies=[Depends(require_token)])
def gmail_send(payload: GmailSendInput) -> dict[str, Any]:
    """Responde dentro del hilo vía n8n (que posee la credencial Gmail)."""
    invocation_id = str(uuid.uuid4())
    audit(
        "gmail_send.start",
        {"thread_id": payload.thread_id, "to": payload.to, "subject": payload.subject},
        invocation_id=invocation_id,
    )
    result = _call_n8n_gmail(
        "send",
        {
            "thread_id": payload.thread_id,
            "to": payload.to,
            "subject": payload.subject,
            "body": payload.body,
        },
    )
    # Reflejar en Supabase: el hilo pasa a "respondido_por_nos".
    try:
        sb.table("gmail_hilos").update(
            {
                "estado": "respondido_por_nos",
                "ultimo_mensaje_de": "nos",
                "ultimo_mensaje_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
        ).eq("thread_id", payload.thread_id).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[gmail_send] no se pudo actualizar gmail_hilos: {exc}", flush=True)
    audit("gmail_send.done", output={"ok": True}, invocation_id=invocation_id)
    return {"ok": True, "result": result}


@app.post("/tasks/gmail_modify", dependencies=[Depends(require_token)])
def gmail_modify(payload: GmailModifyInput) -> dict[str, Any]:
    """Archiva / marca leído / etc. el hilo vía n8n."""
    valid = {"archive", "markRead", "markUnread", "trash"}
    if payload.action not in valid:
        raise HTTPException(status_code=400, detail=f"acción inválida: {payload.action}")
    invocation_id = str(uuid.uuid4())
    audit(
        "gmail_modify.start",
        {"thread_id": payload.thread_id, "action": payload.action},
        invocation_id=invocation_id,
    )
    result = _call_n8n_gmail("modify", {"thread_id": payload.thread_id, "gmail_action": payload.action})
    # Reflejar "archive"/"trash" sacándolo de la bandeja activa.
    if payload.action in ("archive", "trash"):
        try:
            sb.table("gmail_hilos").update({"estado": "archivado"}).eq(
                "thread_id", payload.thread_id
            ).execute()
        except Exception as exc:  # noqa: BLE001
            print(f"[gmail_modify] no se pudo actualizar gmail_hilos: {exc}", flush=True)
    audit("gmail_modify.done", output={"ok": True}, invocation_id=invocation_id)
    return {"ok": True, "result": result}


@app.post("/tasks/classify_email", dependencies=[Depends(require_token)])
def classify_email(payload: ClassifyEmailInput) -> dict[str, Any]:
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("classify_email.start", payload.model_dump(), invocation_id=invocation_id)

    schema = (
        '{"clasificacion": "interesado|sin_cupo|pide_convenio|requiere_llamada|pendiente_docs|otro",'
        '"requiere_respuesta": true|false,'
        '"justificacion": "string",'
        '"borrador": "string (dejar vacio si requiere_respuesta=false o si requiere_decision_humana=true)",'
        '"requiere_decision_humana": true|false,'
        '"decision_motivo": "string (si requiere_decision_humana=true)",'
        '"asunto_respuesta": "string (asunto sugerido para la respuesta)"}'
    )
    user = (
        f"Asunto: {payload.asunto or '(sin asunto)'}\n"
        f"De: {payload.remitente or 'Desconocido'}\n"
        f"Cuerpo del mensaje:\n---\n{payload.mensaje}\n---\n\n"
        "Clasificá este correo institucional de PPS en una de las categorías: "
        "interesado (acepta alumnos/convenio), sin_cupo (no tiene vacantes), "
        "pide_convenio (pregunta por convenios), requiere_llamada (pide reunión/contacto telefónico), "
        "pendiente_docs (envía seguros, firmas o actas), u otro. "
        "Si requiere respuesta, generá un borrador formal, claro y cortés de respuesta."
    )
    result = llm_json(user, schema_hint=schema)

    # 1. Update the classification in gmail_hilos
    try:
        sb.table("gmail_hilos").update({
            "clasificacion": result.get("clasificacion", "otro")
        }).eq("thread_id", payload.thread_id).execute()
    except Exception as exc:
        print(f"[classify_email] failed to update gmail_hilos: {exc}", flush=True)

    # 2. If it requires a response, insert it in agent_suggestions
    suggestion_id = None
    if result.get("requiere_respuesta") and not result.get("requiere_decision_humana"):
        try:
            suggestion_id = str(uuid.uuid4())
            sb.table("agent_suggestions").insert({
                "id": suggestion_id,
                "tipo": "email_draft",
                "payload": {
                    "asunto": result.get("asunto_respuesta") or f"Re: {payload.asunto or 'PPS'}",
                    "borrador": result.get("borrador") or "",
                    "justificacion": result.get("justificacion") or "",
                    "confidence": 0.88
                },
                "contexto": {
                    "model": HERMES_MODEL,
                    "thread_id": payload.thread_id,
                    "remitente": payload.remitente,
                    "mensaje_recibido": payload.mensaje[:1000]
                },
                "institucion_id": payload.institucion_id,
                "estado": "pending"
            }).execute()
        except Exception as exc:
            print(f"[classify_email] failed to insert suggestion: {exc}", flush=True)

    audit(
        "classify_email.done",
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"classification": result.get("clasificacion", "otro"), "suggestion_id": suggestion_id, "content": result}


# ---------- vault writing ----------

def _safe_slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9\- ]+", "", s or "").strip().lower()
    return re.sub(r"\s+", "-", s)[:80] or "sin-titulo"


def vault_write(rel_path: str, body: str, *, append: bool = False) -> str:
    """Escribe (o appendea) un archivo al vault Obsidian. Devuelve la ruta absoluta."""
    target = VAULT_PATH / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append and target.exists() else "w"
    with open(target, mode, encoding="utf-8") as f:
        if append:
            f.write("\n\n")
        f.write(body)
    return str(target)


def _read_tuyas() -> str:
    """Lee criterios.md + contexto-uflo.md + manual/*.md del operador."""
    parts = []
    tuyas = VAULT_PATH / "tuyas"
    for name in ("criterios.md", "contexto-uflo.md"):
        p = tuyas / name
        if p.exists():
            parts.append(f"# tuyas/{name}\n{p.read_text(encoding='utf-8')}")
    manual = tuyas / "manual"
    if manual.is_dir():
        for path in sorted(manual.glob("*.md")):
            parts.append(f"# tuyas/manual/{path.name}\n{path.read_text(encoding='utf-8')}")
    return "\n\n".join(parts)


# ---------- task: explore ----------

class ExploreInput(BaseModel):
    topic: str = "supabase_overview"     # supabase_overview | instituciones | lanzamientos | solicitudes
    limit: int = 100


@app.post("/tasks/explore", dependencies=[Depends(require_token)])
def explore(payload: ExploreInput) -> dict[str, Any]:
    """Hermes investiga el panel y escribe hallazgos al vault.

    No requiere data del cliente: lee Supabase directo con service role.
    """
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("explore.start", payload.model_dump(), invocation_id=invocation_id)

    # --- recolección de datos ---
    data: dict[str, Any] = {}
    try:
        data["instituciones"] = sb.table("instituciones").select(
            "id,nombre,orientaciones,tutor,convenio_nuevo,direccion,telefono"
        ).limit(payload.limit).execute().data
        data["lanzamientos"] = sb.table("lanzamientos_pps").select(
            "id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,"
            "estado_gestion,estado_convocatoria,cupos_disponibles,proximo_seguimiento,horas_acreditadas"
        ).neq("estado_gestion", "Archivado").limit(payload.limit).execute().data
        data["solicitudes_recientes"] = sb.table("solicitudes_pps").select(
            "id,estudiante_id,nombre_alumno,nombre_institucion,estado_seguimiento,"
            "orientacion_sugerida,localidad,actualizacion,created_at"
        ).order("created_at", desc=True).limit(payload.limit).execute().data
    except Exception as exc:  # noqa: BLE001
        audit("explore.error", {"err": str(exc)}, invocation_id=invocation_id, error=str(exc))
        raise HTTPException(status_code=500, detail=f"error leyendo supabase: {exc}")

    # --- llamada al LLM ---
    schema = (
        '{"resumen_general":"string",'
        '"patrones_instituciones":["string"],'
        '"patrones_lanzamientos":["string"],'
        '"patrones_solicitudes":["string"],'
        '"alertas":[{"tipo":"string","detalle":"string"}],'
        '"preguntas_para_blas":["string"],'
        '"aprendizajes_nuevos":["string"]}'
    )
    tuyas_md = _read_tuyas()
    user_prompt = (
        "Sos Hermes-PPS. Acabás de leer el estado actual del panel. Tu tarea es "
        "investigar: identificar patrones, anomalías y cosas que valga la pena "
        "registrar para tener mejor criterio en el futuro. Sé concreto y honesto. "
        "Si algo te llama la atención y no entendés por qué, formulá una pregunta para Blas.\n\n"
        f"--- criterios y contexto del operador ---\n{tuyas_md or '(vault tuyas/ vacío)'}\n\n"
        f"--- DATOS ---\n"
        f"instituciones ({len(data['instituciones'])}):\n{json.dumps(data['instituciones'], ensure_ascii=False, indent=2)}\n\n"
        f"lanzamientos activos ({len(data['lanzamientos'])}):\n{json.dumps(data['lanzamientos'], ensure_ascii=False, indent=2)}\n\n"
        f"solicitudes recientes ({len(data['solicitudes_recientes'])}):\n{json.dumps(data['solicitudes_recientes'], ensure_ascii=False, indent=2)}"
    )
    result = llm_json(user_prompt, schema_hint=schema)

    # --- escribir al vault ---
    today = dt.date.today().isoformat()
    md = (
        f"# Exploración Supabase — {today}\n\n"
        f"_generado por Hermes-PPS, modelo {HERMES_MODEL}_\n\n"
        f"## Resumen general\n\n{result.get('resumen_general','(vacío)')}\n\n"
        f"## Patrones — instituciones\n\n"
        + "\n".join(f"- {x}" for x in result.get("patrones_instituciones", []))
        + "\n\n## Patrones — lanzamientos\n\n"
        + "\n".join(f"- {x}" for x in result.get("patrones_lanzamientos", []))
        + "\n\n## Patrones — solicitudes\n\n"
        + "\n".join(f"- {x}" for x in result.get("patrones_solicitudes", []))
        + "\n\n## Alertas\n\n"
        + "\n".join(f"- **{a.get('tipo','?')}**: {a.get('detalle','')}" for a in result.get("alertas", []))
        + "\n\n## Preguntas para Blas\n\n"
        + "\n".join(f"- {q}" for q in result.get("preguntas_para_blas", []))
        + "\n\n## Aprendizajes nuevos\n\n"
        + "\n".join(f"- {x}" for x in result.get("aprendizajes_nuevos", []))
        + "\n"
    )
    vault_path = vault_write(f"agent/exploracion-{today}.md", md)

    # también dejamos la suggestion en la base para que sea revisable desde el panel
    suggestion_id = str(uuid.uuid4())
    sb.table("agent_suggestions").insert({
        "id": suggestion_id,
        "tipo": "daily_brief",  # reutilizo tipo; aún no hay 'exploration' en el check constraint
        "payload": result,
        "contexto": {"model": HERMES_MODEL, "topic": payload.topic, "vault_path": vault_path},
    }).execute()

    audit(
        "explore.done",
        output={"vault_path": vault_path},
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"suggestion_id": suggestion_id, "vault_path": vault_path, "content": result}


# ---------- task: learn_from_feedback ----------

class LearnInput(BaseModel):
    suggestion_id: str
    accion: str           # "approved" | "edited" | "discarded"
    payload_original: dict[str, Any]
    payload_final: dict[str, Any] | None = None
    motivo: str | None = None      # comentario libre del operador
    tipo: str | None = None        # tipo de la suggestion (para side-effects)
    validado_por: str | None = None  # auth.user.id que tomó la decisión


def _materialize_clasificacion(
    suggestion_id: str,
    payload: dict[str, Any],
    *,
    validado_por: str | None,
) -> dict[str, Any] | None:
    """Upsertea una clasificación aprobada en whatsapp_contactos.

    Espera payload con: chat_jid, phone, nombre_contacto, tipo, institucion_id?, confidence?
    """
    chat_jid = payload.get("chat_jid")
    tipo = payload.get("tipo")
    if not chat_jid or not tipo:
        return None
    row = {
        "chat_jid": chat_jid,
        "phone": payload.get("phone"),
        "nombre_contacto": payload.get("nombre_contacto"),
        "tipo": tipo,
        "institucion_id": payload.get("institucion_id"),
        "confidence": payload.get("confidence"),
        "clasificado_por": "hermes",
        "validado_por": validado_por,
        "validado_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "notas": payload.get("notas"),
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    try:
        sb.table("whatsapp_contactos").upsert(row, on_conflict="chat_jid").execute()
        return {"materialized": True, "chat_jid": chat_jid, "tipo": tipo}
    except Exception as exc:  # noqa: BLE001
        print(f"[learn] fallo materializar clasificacion {chat_jid}: {exc}", flush=True)
        return {"materialized": False, "error": str(exc)}


@app.post("/tasks/learn_from_feedback", dependencies=[Depends(require_token)])
def learn_from_feedback(payload: LearnInput) -> dict[str, Any]:
    """Cuando Blas resuelve una suggestion, Hermes destila lo aprendido al vault.

    Además, si la suggestion es de tipo `clasificacion` y se aprobó/editó,
    materializa el registro en `whatsapp_contactos`.
    """
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("learn.start", payload.model_dump(), invocation_id=invocation_id)

    side_effect: dict[str, Any] | None = None
    if payload.tipo == "clasificacion" and payload.accion in ("approved", "edited"):
        # Usar payload_final si fue editado, sino el original
        final = payload.payload_final or payload.payload_original
        side_effect = _materialize_clasificacion(
            payload.suggestion_id, final, validado_por=payload.validado_por
        )

    schema = (
        '{"aprendizaje":"string (1-2 frases concretas)",'
        '"tag":"string (ej. tono, criterio, contenido, prioridad, sin_aprendizaje)",'
        '"aplica_cuando":"string (en qué situaciones debo recordarlo)"}'
    )
    tuyas_md = _read_tuyas()
    user_prompt = (
        "El operador resolvió una propuesta tuya. Tu tarea es destilar **una** lección "
        "concreta para tu propio comportamiento futuro. Si la lección es 'no hay nada para aprender' "
        "(ej. fue aprobada sin cambios), devolvé tag='sin_aprendizaje'.\n\n"
        f"--- criterios del operador ---\n{tuyas_md or '(vacío)'}\n\n"
        f"--- ACCIÓN ---\nacción: {payload.accion}\n"
        f"motivo (si lo dio): {payload.motivo or '(sin comentario)'}\n\n"
        f"--- payload propuesto ---\n{json.dumps(payload.payload_original, ensure_ascii=False, indent=2)}\n\n"
        f"--- payload final (si editado) ---\n{json.dumps(payload.payload_final or {}, ensure_ascii=False, indent=2)}"
    )
    result = llm_json(user_prompt, schema_hint=schema)

    vault_path = None
    if result.get("tag") != "sin_aprendizaje" and result.get("aprendizaje"):
        today = dt.date.today().isoformat()
        entry = (
            f"\n## {today} — {result.get('tag','?')} (suggestion {payload.suggestion_id[:8]})\n\n"
            f"**Aprendizaje:** {result['aprendizaje']}\n\n"
            f"**Aplica cuando:** {result.get('aplica_cuando','(?)')}\n"
        )
        vault_path = vault_write("agent/aprendizajes.md", entry, append=True)

        # Espejar la lección en Supabase para que el panel pueda mostrarla.
        # (El vault sigue siendo la fuente narrativa; esto es solo para la UI.)
        try:
            sb.table("agent_aprendizajes").insert({
                "suggestion_id": payload.suggestion_id,
                "tipo": payload.tipo,
                "accion": payload.accion,
                "tag": result.get("tag"),
                "aprendizaje": result["aprendizaje"],
                "aplica_cuando": result.get("aplica_cuando"),
                "model": HERMES_MODEL,
            }).execute()
        except Exception as exc:  # noqa: BLE001
            print(f"[learn] no se pudo espejar aprendizaje en supabase: {exc}", flush=True)

    audit(
        "learn.done",
        output={"vault_path": vault_path, "tag": result.get("tag"), "side_effect": side_effect},
        invocation_id=invocation_id,
        suggestion_id=payload.suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"vault_path": vault_path, "content": result, "side_effect": side_effect}


# ---------- task: process_whatsapp_backup ----------

def _normalize_phone(raw: str) -> str:
    """Deja solo dígitos. Ej. '+54 911 4012-3456' -> '5491140123456'."""
    return re.sub(r"\D", "", raw or "")


def _load_institucion_phone_index() -> dict[str, str]:
    """Devuelve {telefono_normalizado: institucion_id} desde la tabla instituciones."""
    try:
        rows = sb.table("instituciones").select("id,telefono").execute().data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[wa] no se pudo leer instituciones: {exc}", flush=True)
        return {}
    index: dict[str, str] = {}
    for r in rows:
        p = _normalize_phone(r.get("telefono") or "")
        if not p:
            continue
        # WhatsApp usa formato sin '+'. Indexamos por terminación (últimos 10) y completo.
        index[p] = r["id"]
        if len(p) >= 10:
            index[p[-10:]] = r["id"]
    return index


def _decrypt_crypt15(input_path: pathlib.Path, output_path: pathlib.Path, key_hex: str) -> None:
    """Decrypts msgstore.db.crypt15 using wa-crypt-tools. Raises on failure."""
    from wa_crypt_tools.lib.key.keyfactory import KeyFactory
    from wa_crypt_tools.lib.db.db15 import Database15

    key = KeyFactory.new(key_hex)  # acepta 64 hex chars
    db = Database15(key=key, encrypted=input_path.open("rb"))
    raw = db.decrypt(db.encrypted.read())
    output_path.write_bytes(raw)


def _load_pps_label_phones(db_path: pathlib.Path, label_name: str = "PPS") -> set[str]:
    """Devuelve los teléfonos (sin '+') que están en la lista de WhatsApp `label_name`."""
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = con.execute("""
          SELECT j.user
          FROM labels l
          JOIN labeled_jid lj ON lj.label_id = l._id
          JOIN jid j ON j._id = lj.jid_row_id
          WHERE l.label_name = ? AND j.server = 's.whatsapp.net'
        """, (label_name,)).fetchall()
    finally:
        con.close()
    return {(r[0] or "").lstrip("+") for r in rows if r[0]}


def _parse_msgstore(db_path: pathlib.Path, since_days: int = 60) -> list[dict[str, Any]]:
    """Lee msgstore.db (SQLite) y devuelve mensajes 1-on-1 normalizados."""
    cutoff_ms = int((time.time() - since_days * 86400) * 1000)
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    out: list[dict[str, Any]] = []
    try:
        # Schema moderno (WA 2.23+). Si la query falla por nombres distintos, dejamos un fallback.
        rows = con.execute("""
          SELECT
            m.key_id          AS key_id,
            m._id             AS row_id,
            m.from_me         AS from_me,
            m.text_data       AS texto,
            m.timestamp       AS ts_ms,
            j.user            AS user_phone,
            j.server          AS jid_server,
            c.subject         AS chat_subject
          FROM message m
          JOIN chat c ON c._id = m.chat_row_id
          JOIN jid  j ON j._id = c.jid_row_id
          WHERE m.timestamp > ?
            AND j.server = 's.whatsapp.net'   -- 1-on-1; grupos son 'g.us'
          ORDER BY m.timestamp DESC
          LIMIT 5000
        """, (cutoff_ms,)).fetchall()
        for r in rows:
            phone = (r["user_phone"] or "").lstrip("+")
            out.append({
                "id": r["key_id"] or f"row-{r['row_id']}",
                "chat_jid": f"{phone}@{r['jid_server']}",
                "from_me": bool(r["from_me"]),
                "autor": (r["chat_subject"] or phone) if not r["from_me"] else None,
                "texto": r["texto"],
                "timestamp": dt.datetime.fromtimestamp(int(r["ts_ms"]) / 1000, dt.timezone.utc).isoformat(),
                "media_tipo": None,
                "_phone": phone,
            })
    finally:
        con.close()
    return out


@app.post("/tasks/process_whatsapp_backup", dependencies=[Depends(require_token)])
async def process_whatsapp_backup(
    file: UploadFile = File(...),
    since_days: int = 60,
) -> dict[str, Any]:
    """Recibe un msgstore.db.crypt15 vía multipart, lo desencripta, parsea y upserta.

    El cliente (n8n) baja el backup de Drive y lo sube acá.
    """
    if not WHATSAPP_E2E_KEY:
        raise HTTPException(status_code=500, detail="WHATSAPP_E2E_KEY no configurada en el servidor")

    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("wa_backup.start", {"filename": file.filename, "since_days": since_days}, invocation_id=invocation_id)

    with tempfile.TemporaryDirectory() as td:
        tdp = pathlib.Path(td)
        enc = tdp / "msgstore.db.crypt15"
        dec = tdp / "msgstore.db"
        try:
            content = await file.read()
            enc.write_bytes(content)
            _decrypt_crypt15(enc, dec, WHATSAPP_E2E_KEY)
        except Exception as exc:  # noqa: BLE001
            audit("wa_backup.error", {"step": "decrypt", "err": str(exc)},
                  invocation_id=invocation_id, error=str(exc))
            raise HTTPException(status_code=500, detail=f"fallo al desencriptar: {exc}")

        try:
            messages = _parse_msgstore(dec, since_days=since_days)
        except Exception as exc:  # noqa: BLE001
            audit("wa_backup.error", {"step": "parse", "err": str(exc)},
                  invocation_id=invocation_id, error=str(exc))
            raise HTTPException(status_code=500, detail=f"fallo al parsear msgstore: {exc}")

    # mapear a institucion_id
    phone_index = _load_institucion_phone_index()
    matched = 0
    rows_for_db = []
    for m in messages:
        phone = m.pop("_phone", "")
        inst_id = phone_index.get(phone) or phone_index.get(phone[-10:] if len(phone) >= 10 else "")
        if inst_id:
            m["institucion_id"] = inst_id
            matched += 1
        m["raw"] = {"source": "msgstore.db.crypt15"}
        rows_for_db.append(m)

    # upsert por batches
    upserted = 0
    for i in range(0, len(rows_for_db), 500):
        batch = rows_for_db[i:i + 500]
        try:
            sb.table("whatsapp_mensajes").upsert(batch, on_conflict="id").execute()
            upserted += len(batch)
        except Exception as exc:  # noqa: BLE001
            print(f"[wa] fallo upsert batch {i}: {exc}", flush=True)

    summary = {
        "mensajes_parseados": len(messages),
        "mensajes_mapeados_a_institucion": matched,
        "mensajes_upserted": upserted,
        "since_days": since_days,
    }
    audit(
        "wa_backup.done",
        output=summary,
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return summary


# ---------- task: sync_whatsapp_backup (auto via wabdd) ----------

def _process_messages_to_db(messages: list[dict[str, Any]], *, only_institutions: bool = True) -> dict[str, Any]:
    """Mapea a institucion_id y upsertea. Compartido entre los dos endpoints.

    Si only_institutions=True (default): SOLO upserta los mensajes cuyo teléfono matchea
    con un registro en `instituciones` o está presente en `whatsapp_contactos` / `solicitudes_pps`.
    El resto se descarta — privacy por defecto.
    """
    phone_index = _load_institucion_phone_index()
    allowed_phones = set()

    # Si only_institutions=True, también permitimos números de whatsapp_contactos y solicitudes_pps
    if only_institutions:
        try:
            # 1. Cargar desde whatsapp_contactos
            contacts = sb.table("whatsapp_contactos").select("phone,chat_jid").execute().data or []
            for c in contacts:
                p = _normalize_phone(c.get("phone") or (c.get("chat_jid") or "").split("@")[0])
                if p and len(p) >= 10:
                    allowed_phones.add(p[-10:])
        except Exception as exc:
            print(f"[wa] no se pudo leer whatsapp_contactos: {exc}", flush=True)

        try:
            # 2. Cargar desde solicitudes_pps
            sols = sb.table("solicitudes_pps").select("telefono_institucion").execute().data or []
            for s in sols:
                tel = s.get("telefono_institucion")
                if tel:
                    p = _normalize_phone(tel)
                    if p and len(p) >= 10:
                        allowed_phones.add(p[-10:])
        except Exception as exc:
            print(f"[wa] no se pudo leer solicitudes_pps: {exc}", flush=True)

    matched = 0
    skipped_no_match = 0
    rows_for_db = []
    for m in messages:
        phone = m.pop("_phone", "")
        inst_id = phone_index.get(phone) or phone_index.get(phone[-10:] if len(phone) >= 10 else "")
        last_10 = phone[-10:] if len(phone) >= 10 else ""

        if inst_id:
            m["institucion_id"] = inst_id
            m["raw"] = {"source": "wabdd"}
            rows_for_db.append(m)
            matched += 1
        elif only_institutions and last_10 and last_10 in allowed_phones:
            # Es un contacto permitido pero sin institución formal aún
            m["institucion_id"] = None
            m["raw"] = {"source": "wabdd"}
            rows_for_db.append(m)
            matched += 1
        else:
            skipped_no_match += 1
            if not only_institutions:
                m["institucion_id"] = None
                m["raw"] = {"source": "wabdd"}
                rows_for_db.append(m)

    upserted = 0
    for i in range(0, len(rows_for_db), 500):
        batch = rows_for_db[i:i + 500]
        try:
            sb.table("whatsapp_mensajes").upsert(batch, on_conflict="id").execute()
            upserted += len(batch)
        except Exception as exc:  # noqa: BLE001
            print(f"[wa] fallo upsert batch {i}: {exc}", flush=True)

    return {
        "mensajes_parseados": len(messages),
        "mensajes_mapeados_a_institucion": matched,
        "mensajes_skip_sin_match": skipped_no_match,
        "mensajes_upserted": upserted,
        "only_institutions": only_institutions,
    }


class SyncWhatsAppInput(BaseModel):
    since_days: int = 60
    exclude_media: bool = True
    only_institutions: bool = True   # fallback: si no hay lista PPS, filtra por instituciones.telefono
    pps_label: str = "PPS"            # nombre de la lista en WhatsApp que define el allowlist


def _refresh_wabdd_auth_token() -> str:
    """Usa el master_token de Google (long-lived) para obtener un auth_token fresco
    con los scopes específicos de WhatsApp backup (drive.appdata, app=com.whatsapp).
    Equivale a lo que hace gpsoauth_helper.get_auth_token() de wabdd.
    """
    import gpsoauth
    if not (WABDD_MASTER_TOKEN and WABDD_ANDROID_ID and WABDD_EMAIL):
        raise HTTPException(status_code=500, detail="WABDD_MASTER_TOKEN/ANDROID_ID/EMAIL no configurados")
    resp = gpsoauth.perform_oauth(
        WABDD_EMAIL, WABDD_MASTER_TOKEN, WABDD_ANDROID_ID,
        service="oauth2:https://www.googleapis.com/auth/drive.appdata",
        app="com.whatsapp",
        client_sig="38a0f7d505fe18fec64fbf343ecaaaf310dbd799",
    )
    if "Auth" not in resp:
        raise HTTPException(status_code=500, detail=f"gpsoauth no devolvió Auth: {resp}")
    return resp["Auth"]


@app.post("/tasks/sync_whatsapp_backup", dependencies=[Depends(require_token)])
def sync_whatsapp_backup(payload: SyncWhatsAppInput = SyncWhatsAppInput()) -> dict[str, Any]:
    """Pipeline completo: bajá backup via wabdd (Drive interno), desencriptá, parseá, upserteá."""
    if not WHATSAPP_E2E_KEY:
        raise HTTPException(status_code=500, detail="WHATSAPP_E2E_KEY no configurado")
    # refresca auth_token desde master_token (largoplacista)
    auth_token = _refresh_wabdd_auth_token()

    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("wa_sync.start", payload.model_dump(), invocation_id=invocation_id)

    with tempfile.TemporaryDirectory() as td:
        tdp = pathlib.Path(td)
        token_file = tdp / "token.txt"
        key_file = tdp / "key.txt"
        out_dir = tdp / "out"
        out_dir.mkdir()

        token_file.write_text(auth_token)
        key_file.write_text(WHATSAPP_E2E_KEY)

        # Paso 1: download (solo baja, no desencripta msgstore.db; --decryption-key-file
        # parece reservado para otros archivos. msgstore.db necesita 'wabdd decrypt' aparte).
        # Excluyo stickers y media para no bajar GB innecesarios.
        dl_cmd = [
            "wabdd", "download",
            "--token-file", str(token_file),
            "--output", str(out_dir),
            "--exclude", "Backups/Stickers/*",
        ]
        if payload.exclude_media:
            dl_cmd += ["--exclude", "Media/*"]

        try:
            dl_proc = subprocess.run(dl_cmd, capture_output=True, text=True, timeout=900)
        except subprocess.TimeoutExpired:
            audit("wa_sync.error", {"step": "wabdd_download_timeout"}, invocation_id=invocation_id, error="timeout")
            raise HTTPException(status_code=504, detail="wabdd download timed out (15 min)")
        if dl_proc.returncode != 0:
            err_tail = (dl_proc.stderr or dl_proc.stdout or "")[-1200:]
            audit("wa_sync.error", {"step": "wabdd_download", "stderr_tail": err_tail},
                  invocation_id=invocation_id, error=err_tail)
            raise HTTPException(status_code=500, detail=f"wabdd download falló: {err_tail}")

        # Paso 2: decrypt — produce un dir paralelo <out_dir>-decrypted/
        dec_cmd = [
            "wabdd", "decrypt",
            "--key-file", str(key_file),
            "dump", str(out_dir),
        ]
        try:
            dec_proc = subprocess.run(dec_cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            audit("wa_sync.error", {"step": "wabdd_decrypt_timeout"}, invocation_id=invocation_id, error="timeout")
            raise HTTPException(status_code=504, detail="wabdd decrypt timed out (5 min)")
        if dec_proc.returncode != 0:
            err_tail = (dec_proc.stderr or dec_proc.stdout or "")[-1200:]
            audit("wa_sync.error", {"step": "wabdd_decrypt", "stderr_tail": err_tail},
                  invocation_id=invocation_id, error=err_tail)
            raise HTTPException(status_code=500, detail=f"wabdd decrypt falló: {err_tail}")

        decrypted_dir = out_dir.parent / f"{out_dir.name}-decrypted"
        msgstore_candidate = decrypted_dir / "Databases" / "msgstore.db"
        if not msgstore_candidate.exists():
            # fallback: cualquier msgstore.db dentro del árbol desencriptado
            cands = list(decrypted_dir.rglob("msgstore.db")) if decrypted_dir.exists() else []
            if not cands:
                audit("wa_sync.error", {"step": "locate_db"}, invocation_id=invocation_id, error="no msgstore.db")
                raise HTTPException(status_code=500, detail="no se encontró msgstore.db desencriptado")
            msgstore = max(cands, key=lambda p: p.stat().st_size)
        else:
            msgstore = msgstore_candidate

        try:
            pps_phones = _load_pps_label_phones(msgstore, label_name=payload.pps_label)
        except Exception as exc:  # noqa: BLE001
            print(f"[wa] no se pudo leer lista PPS: {exc}", flush=True)
            pps_phones = set()

        try:
            messages = _parse_msgstore(msgstore, since_days=payload.since_days)
        except Exception as exc:  # noqa: BLE001
            audit("wa_sync.error", {"step": "parse", "err": str(exc)},
                  invocation_id=invocation_id, error=str(exc))
            raise HTTPException(status_code=500, detail=f"fallo al parsear msgstore: {exc}")

        # Filtro principal: si hay lista PPS con contactos, usar SOLO esos teléfonos.
        # Fallback: si la lista está vacía, caer al match contra instituciones (only_institutions).
        if pps_phones:
            messages = [m for m in messages if m.get("_phone", "") in pps_phones
                        or (len(m.get("_phone", "")) >= 10 and m["_phone"][-10:] in {p[-10:] for p in pps_phones})]

        summary = _process_messages_to_db(
            messages,
            only_institutions=payload.only_institutions and not bool(pps_phones),
        )
        summary["pps_label_contactos"] = len(pps_phones)
        summary["filter_mode"] = (
            "pps_label"
            if pps_phones
            else ("instituciones" if payload.only_institutions else "todos")
        )

    summary["since_days"] = payload.since_days
    audit(
        "wa_sync.done",
        output={k: v for k, v in summary.items() if k != "wabdd_stdout_tail"},
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return summary


# ---------- task: classify_pps_contacts ----------

class ClassifyContactsInput(BaseModel):
    limit: int = 50
    dry_run: bool = False


@app.post("/tasks/classify_pps_contacts", dependencies=[Depends(require_token)])
def classify_pps_contacts(payload: ClassifyContactsInput = ClassifyContactsInput()) -> dict[str, Any]:
    """Clasifica los contactos recientes de WhatsApp basándose en sus mensajes.
    
    Genera propuestas de clasificación en agent_suggestions que Blas puede validar en la UI.
    """
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("classify_contacts.start", payload.model_dump(), invocation_id=invocation_id)

    # 1. Obtener mensajes recientes para extraer remitentes y dar contexto
    try:
        msgs_res = sb.table("whatsapp_mensajes") \
            .select("chat_jid,autor,texto,timestamp,id") \
            .eq("from_me", False) \
            .order("timestamp", desc=True) \
            .limit(1000) \
            .execute()
        
        all_msgs = msgs_res.data or []
    except Exception as exc:  # noqa: BLE001
        audit("classify_contacts.error", {"step": "fetch_messages", "err": str(exc)},
              invocation_id=invocation_id, error=str(exc))
        raise HTTPException(status_code=500, detail=f"error leyendo whatsapp_mensajes: {exc}")

    # Agrupar mensajes por chat_jid para aislar candidatos
    contacts_msgs: dict[str, dict[str, Any]] = {}
    for m in all_msgs:
        jid = m["chat_jid"]
        if not jid:
            continue
        if jid not in contacts_msgs:
            contacts_msgs[jid] = {
                "chat_jid": jid,
                "autor": m["autor"] or jid.split("@")[0],
                "messages": []
            }
        # Guardamos hasta 10 mensajes para dar contexto de conversación
        if len(contacts_msgs[jid]["messages"]) < 10:
            contacts_msgs[jid]["messages"].append({
                "id": m["id"],
                "texto": m["texto"],
                "timestamp": m["timestamp"]
            })

    # 2. Excluir contactos ya clasificados en la tabla whatsapp_contactos
    try:
        existing_res = sb.table("whatsapp_contactos").select("chat_jid").execute()
        classified_jids = {c["chat_jid"] for c in (existing_res.data or [])}
    except Exception as exc:  # noqa: BLE001
        # Si la tabla aún no existe o no tiene registros, asumimos vacío
        print(f"[classify] tabla whatsapp_contactos no consultada: {exc}", flush=True)
        classified_jids = set()

    # 3. Excluir contactos que ya tengan sugerencia pendiente de tipo clasificacion
    try:
        pending_res = sb.table("agent_suggestions") \
            .select("contexto") \
            .eq("tipo", "clasificacion") \
            .eq("estado", "pending") \
            .execute()
        
        pending_jids = set()
        for s in (pending_res.data or []):
            ctx = s.get("contexto") or {}
            if "chat_jid" in ctx:
                pending_jids.add(ctx["chat_jid"])
    except Exception as exc:  # noqa: BLE001
        print(f"[classify] error consultando sugerencias pendientes: {exc}", flush=True)
        pending_jids = set()

    # Filtrar candidatos viables
    candidates = []
    for jid, data in contacts_msgs.items():
        if jid in classified_jids:
            continue
        if jid in pending_jids:
            continue
        candidates.append(data)

    # Limitar lote
    candidates = candidates[:payload.limit]

    if not candidates:
        audit("classify_contacts.done", {"msg": "no candidates to classify"}, invocation_id=invocation_id)
        return {"suggestion_ids": [], "classifications": [], "msg": "No hay contactos nuevos para clasificar."}

    # 4. Obtener instituciones cargadas para ayudar a vincularlas
    try:
        inst_res = sb.table("instituciones").select("id,nombre,tutor,convenio_nuevo").execute()
        institutions = inst_res.data or []
    except Exception as exc:  # noqa: BLE001
        print(f"[classify] error leyendo instituciones: {exc}", flush=True)
        institutions = []

    # 5. Llamada al LLM
    schema = (
        '{"classifications": [{'
        '"chat_jid": "string",'
        '"phone": "string (solo digitos o vacio)",'
        '"nombre_contacto": "string",'
        '"tipo": "autoridad_uflo|institucion_con_convenio|sin_convenio|coordinador_externo|otro",'
        '"institucion_id": "string (UUID de la institucion si tipo es institucion_con_convenio o coordinador_externo, null de lo contrario)",'
        '"confidence": number (entre 0.0 y 1.0),'
        '"justificacion": "string (max 2 frases)",'
        '"evidence_message_ids": ["string (IDs de mensajes de evidencia)"],'
        '"resumen_patron": "string (resumen muy breve de la interaccion o relacion detectada)"'
        '}]}'
    )

    user_prompt = (
        "Analizá los siguientes contactos recientes de WhatsApp del coordinador de PPS y sugerí su clasificación.\n\n"
        "REGLAS DE CLASIFICACIÓN:\n"
        "1. autoridad_uflo: Directores de carrera (ej: Agostina), vicerrectores (ej: Fabiana de Col) u otras autoridades académicas que consultan o piden cosas sobre el funcionamiento general de las PPS u otros temas institucionales.\n"
        "2. institucion_con_convenio: Contactos que representan a una institución que ya está cargada en el panel de instituciones. Debes asociar su institucion_id correspondiente.\n"
        "3. sin_convenio: Contactos de instituciones de PPS con las que aún no hay convenio formal o no se ha lanzado la PPS (ej: chats de prospección, primer contacto o solicitud de pps sin registrar).\n"
        "4. coordinador_externo: Tutores o referentes individuales de instituciones que ya tienen convenio pero son contactos individuales.\n"
        "5. otro: Otros chats personales, alumnos que te contactan por fuera de los canales oficiales, spam o que no corresponden a la gestión directa de PPS o autoridades.\n\n"
        f"LISTA DE INSTITUCIONES EN EL PANEL (usar para mapear):\n{json.dumps(institutions, ensure_ascii=False, indent=2)}\n\n"
        f"CONTACTOS A CLASIFICAR:\n{json.dumps(candidates, ensure_ascii=False, indent=2)}"
    )

    result = llm_json(user_prompt, schema_hint=schema)
    classifications = result.get("classifications", [])

    valid_types = {
        "autoridad_uflo",
        "institucion_con_convenio",
        "sin_convenio",
        "coordinador_externo",
        "otro",
    }
    institution_ids = {str(inst.get("id")) for inst in institutions if inst.get("id")}

    suggestion_ids = []
    insert_failures = []
    if not payload.dry_run:
        for c in classifications:
            sugg_id = str(uuid.uuid4())
            chat_jid = c.get("chat_jid")
            tipo = c.get("tipo") if c.get("tipo") in valid_types else "otro"
            institucion_id = c.get("institucion_id")
            if institucion_id not in institution_ids:
                institucion_id = None
            clean_payload = {
                **c,
                "tipo": tipo,
                "institucion_id": institucion_id,
            }
            try:
                # Insertamos una sugerencia individual en agent_suggestions para clasificacion
                sb.table("agent_suggestions").insert({
                    "id": sugg_id,
                    "tipo": "clasificacion",
                    "estado": "pending",
                    "payload": clean_payload,
                    "contexto": {
                        "model": HERMES_MODEL,
                        "chat_jid": chat_jid,
                        "phone": c.get("phone"),
                        "nombre_contacto": c.get("nombre_contacto")
                    },
                    "institucion_id": institucion_id
                }).execute()
                suggestion_ids.append(sugg_id)
            except Exception as exc:  # noqa: BLE001
                insert_failures.append({"chat_jid": chat_jid, "error": str(exc)})
                print(f"[classify] fallo al insertar sugerencia para {chat_jid}: {exc}", flush=True)

    audit(
        "classify_contacts.done",
        output={
            "candidates_count": len(candidates),
            "classifications_count": len(classifications),
            "suggestion_ids": suggestion_ids,
            "insert_failures": insert_failures,
        },
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )

    return {
        "suggestion_ids": suggestion_ids,
        "classifications": classifications,
        "dry_run": payload.dry_run
    }


# ---------- task: verify_finalizacion ----------

class VerifyFinalizacionInput(BaseModel):
    solicitud_id: str | None = None         # id de la solicitud_pps (egreso)
    estudiante_id: str | None = None
    lanzamiento_id: str | None = None
    planilla_horas_url: str | None = None
    informe_final_url: str | None = None
    planilla_asistencia_url: str | None = None
    horas_declaradas: float | None = None
    contexto_extra: str | None = None


def _download_file(url: str) -> bytes | None:
    """Descarga un archivo desde una URL (signed o pública). Devuelve bytes o None."""
    if not url:
        return None
    try:
        import httpx
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception as exc:  # noqa: BLE001
        print(f"[verify] fallo descarga {url[:80]}: {exc}", flush=True)
        return None


def _extract_pdf_text(data: bytes, max_chars: int = 8000) -> str:
    """Extrae texto de un PDF. Devuelve string vacío si falla."""
    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        chunks = []
        total = 0
        for page in reader.pages:
            txt = (page.extract_text() or "").strip()
            if not txt:
                continue
            chunks.append(txt)
            total += len(txt)
            if total > max_chars:
                break
        return "\n\n".join(chunks)[:max_chars]
    except Exception as exc:  # noqa: BLE001
        return f"(no se pudo extraer texto: {exc})"


def _read_file_as_text(url: str | None, label: str) -> dict[str, Any]:
    """Descarga + extrae texto, devuelve metadata estructurada para el LLM."""
    if not url:
        return {"label": label, "presente": False}
    data = _download_file(url)
    if not data:
        return {"label": label, "presente": False, "error": "no se pudo descargar"}
    size_kb = len(data) // 1024
    is_pdf = data[:4] == b"%PDF"
    is_jpeg = data[:3] == b"\xff\xd8\xff"
    is_png = data[:8] == b"\x89PNG\r\n\x1a\n"
    if is_pdf:
        return {
            "label": label, "presente": True, "tipo": "pdf",
            "size_kb": size_kb, "texto": _extract_pdf_text(data),
        }
    if is_jpeg or is_png:
        return {
            "label": label, "presente": True, "tipo": "imagen",
            "size_kb": size_kb,
            "texto": "(es una imagen escaneada — Hermes no puede leer el contenido en v1; verificar a ojo)",
        }
    return {"label": label, "presente": True, "tipo": "desconocido", "size_kb": size_kb,
            "texto": "(formato no reconocido)"}


@app.post("/tasks/verify_finalizacion", dependencies=[Depends(require_token)])
def verify_finalizacion(payload: VerifyFinalizacionInput) -> dict[str, Any]:
    """Verifica los 3 documentos de finalización contra el lanzamiento original y otras PPS.

    Devuelve estado (`verified` / `attention` / `critical`), lista de checks aprobados
    y lista de issues con severidad + sugerencia de acción.
    Persiste como suggestion para que la UI pueda re-leer sin invocar de nuevo.
    """
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("verify_finalizacion.start", payload.model_dump(), invocation_id=invocation_id)

    # 1. Contexto del lanzamiento
    lanzamiento_ctx: dict[str, Any] = {}
    if payload.lanzamiento_id:
        try:
            res = sb.table("lanzamientos_pps").select(
                "id,nombre_pps,orientacion,fecha_inicio,fecha_finalizacion,horas_acreditadas,"
                "descripcion_larga,actividades_lista,requisito_obligatorio"
            ).eq("id", payload.lanzamiento_id).limit(1).execute().data
            if res:
                lanzamiento_ctx = res[0]
        except Exception as exc:  # noqa: BLE001
            print(f"[verify] read lanzamiento: {exc}", flush=True)

    # 2. Otras PPS del alumno (overlap check)
    otras_pps: list[dict[str, Any]] = []
    if payload.estudiante_id:
        try:
            res = sb.table("solicitudes_pps").select(
                "id,nombre_institucion,estado_seguimiento,created_at"
            ).eq("estudiante_id", payload.estudiante_id).limit(15).execute().data or []
            otras_pps = [s for s in res if str(s.get("id")) != str(payload.solicitud_id)]
        except Exception as exc:  # noqa: BLE001
            print(f"[verify] read otras_pps: {exc}", flush=True)

    # 3. Leer los 3 archivos
    archivos = {
        "planilla_horas": _read_file_as_text(payload.planilla_horas_url, "Planilla de horas"),
        "informe_final": _read_file_as_text(payload.informe_final_url, "Informe final"),
        "planilla_asistencia": _read_file_as_text(payload.planilla_asistencia_url, "Planilla de asistencia"),
    }

    # 4. Prompt LLM
    schema = (
        '{"estado":"verified|attention|critical",'
        '"score_confianza":0.0,'
        '"checks":[{"item":"string (corto)","ok":true,"detalle":"string"}],'
        '"issues":[{"severidad":"warning|critical","detalle":"string (qué pasa)","sugerencia":"string (qué hacer)"}],'
        '"resumen":"string (1 frase para el coordinador)"}'
    )
    tuyas_md = _read_tuyas()
    user_prompt = (
        "Sos Hermes verificando una solicitud de finalización de PPS. Tu trabajo es chequear:\n"
        "  1) Horas declaradas coinciden con las horas del lanzamiento original.\n"
        "  2) El informe final cubre los objetivos del programa (descripcion_larga + actividades).\n"
        "  3) Las fechas en la planilla de asistencia caen dentro del rango del lanzamiento.\n"
        "  4) No hay overlap con otras PPS del alumno en las mismas fechas.\n"
        "  5) Los archivos tienen sustancia (no son PDFs vacíos ni informes de 2 líneas).\n\n"
        "Devolvé estado=verified si los 5 puntos están OK, attention si hay warnings menores, "
        "critical si hay al menos una inconsistencia que requiere corrección antes de subir al SAC. "
        "NO inventes datos; si un archivo no se pudo leer (imagen escaneada), señalalo en `issues` "
        "como warning con sugerencia de revisar manualmente.\n\n"
        f"--- criterios del operador (tuyas/) ---\n{tuyas_md[:2500] if tuyas_md else '(vacío)'}\n\n"
        f"--- horas declaradas por el alumno ---\n{payload.horas_declaradas if payload.horas_declaradas is not None else '(no informado)'}\n\n"
        f"--- lanzamiento original ---\n{json.dumps(lanzamiento_ctx, ensure_ascii=False, indent=2)}\n\n"
        f"--- otras PPS del alumno (para overlap) ---\n{json.dumps(otras_pps, ensure_ascii=False, indent=2)}\n\n"
        f"--- archivos adjuntos ---\n{json.dumps(archivos, ensure_ascii=False)[:10000]}\n\n"
        f"--- contexto extra del coordinador ---\n{payload.contexto_extra or '(sin contexto)'}"
    )
    result = llm_json(user_prompt, schema_hint=schema)

    # 4.b. Verificación de doble pasada (opcional, default ON). Una segunda
    # instancia audita el veredicto antes de persistir: clave en acreditaciones,
    # donde un falso "verified" es el error más caro. Degrada con elegancia: si
    # la verificación falla, se queda con el resultado de la primera pasada.
    if HERMES_DOUBLE_CHECK_VERIFY:
        result = llm_verify(
            user_prompt, result, schema_hint=schema,
            foco=("verificación de finalización de PPS para acreditación — "
                  "prioridad: no dejar pasar inconsistencias de horas, fechas u overlap"),
        )

    # 5. Persistir como suggestion (usamos tipo='update_estado' del CHECK constraint, etiqueta real va en contexto.kind)
    suggestion_id = str(uuid.uuid4())
    verif_meta = result.get("_verificador") if isinstance(result, dict) else None
    try:
        sb.table("agent_suggestions").insert({
            "id": suggestion_id,
            "tipo": "update_estado",
            "payload": {
                "verificacion": result,
                "solicitud_id": payload.solicitud_id,
                "archivos_meta": {
                    k: {kk: vv for kk, vv in v.items() if kk != "texto"}
                    for k, v in archivos.items()
                },
            },
            "contexto": {
                "model": HERMES_MODEL,
                "kind": "verificacion_finalizacion",
                "doble_pasada": HERMES_DOUBLE_CHECK_VERIFY,
                "verificador": verif_meta,
                "lanzamiento_id": payload.lanzamiento_id,
                "estudiante_id": payload.estudiante_id,
            },
        }).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[verify] no se pudo persistir suggestion: {exc}", flush=True)

    audit(
        "verify_finalizacion.done",
        output={
            "estado": result.get("estado"),
            "issues_count": len(result.get("issues", [])),
            "checks_count": len(result.get("checks", [])),
            "doble_pasada": HERMES_DOUBLE_CHECK_VERIFY,
            "verificador_coincide": (verif_meta or {}).get("coincide") if isinstance(verif_meta, dict) else None,
        },
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"suggestion_id": suggestion_id, "verificacion": result}


# ---------- scheduler interno ----------
# Hermes regenera solo, cada mañana, el PLAN DEL DÍA (tablero "Hoy con Hermes")
# y, como RESPALDO, el daily brief si n8n no lo generó. Vive dentro del propio
# contenedor: al redesplegar arranca, sin depender de configurar n8n aparte.
#
# Config por entorno (.env, todas opcionales — traen defaults sanos):
#   HERMES_SCHEDULER_ENABLED    "1" (default) | "0" para apagarlo
#   HERMES_TZ_OFFSET            offset horario vs UTC en horas (Argentina = -3)
#   HERMES_PLAN_TODAY_AT        "HH:MM" local para regenerar el plan (def 08:05)
#   HERMES_DAILY_BRIEF_AT       "HH:MM" local para el brief de respaldo (def 08:00)
#   HERMES_DAILY_BRIEF_FALLBACK "1" (default): genera el brief SOLO si no hay uno
#                               de hoy (no pisa el de n8n); "0" para no tocarlo.
#   HERMES_DRAFT_EMAILS_ENABLED "1" (default) | "0": genera borradores de correo.
#   HERMES_DRAFT_EMAILS_AT      "HH:MM" local, ANTES del plan (def 07:55) para
#                               que el plan ya detecte los borradores nuevos.
#   HERMES_DRAFT_EMAILS_LIMIT   máximo de hilos a procesar por corrida (def 40).
#
# NOTA: pensado para un único worker uvicorn (así arranca el contenedor). Si
# algún día se corre con --workers > 1, mover el scheduler a un proceso aparte
# para no disparar los jobs N veces.

import threading

SCHEDULER_ENABLED = os.environ.get("HERMES_SCHEDULER_ENABLED", "1") == "1"
try:
    TZ_OFFSET_HOURS = float(os.environ.get("HERMES_TZ_OFFSET", "-3"))
except ValueError:
    TZ_OFFSET_HOURS = -3.0
PLAN_TODAY_AT = os.environ.get("HERMES_PLAN_TODAY_AT", "08:05")
DAILY_BRIEF_AT = os.environ.get("HERMES_DAILY_BRIEF_AT", "08:30")
DAILY_BRIEF_FALLBACK = os.environ.get("HERMES_DAILY_BRIEF_FALLBACK", "1") == "1"
# Borradores de correo: se generan ANTES del plan para que éste los detecte.
DRAFT_EMAILS_ENABLED = os.environ.get("HERMES_DRAFT_EMAILS_ENABLED", "1") == "1"
DRAFT_EMAILS_AT = os.environ.get("HERMES_DRAFT_EMAILS_AT", "07:55")
try:
    DRAFT_EMAILS_LIMIT = int(os.environ.get("HERMES_DRAFT_EMAILS_LIMIT", "40"))
except ValueError:
    DRAFT_EMAILS_LIMIT = 40

_LOCAL_TZ = dt.timezone(dt.timedelta(hours=TZ_OFFSET_HOURS))


def _parse_hhmm(s: str, default_h: int, default_m: int) -> tuple[int, int]:
    try:
        hh, mm = s.strip().split(":")
        h, m = int(hh), int(mm)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return h, m
    except Exception:  # noqa: BLE001
        pass
    return default_h, default_m


def _seconds_until(hh: int, mm: int) -> float:
    """Segundos desde ahora hasta el próximo HH:MM en hora local."""
    now = dt.datetime.now(_LOCAL_TZ)
    target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if target <= now:
        target += dt.timedelta(days=1)
    return (target - now).total_seconds()


def _brief_exists_today() -> bool:
    """¿Ya hay un daily_brief con fecha de hoy (hora local)?"""
    try:
        today_local = dt.datetime.now(_LOCAL_TZ).date()
        start_local = dt.datetime.combine(today_local, dt.time.min, tzinfo=_LOCAL_TZ)
        start_utc = start_local.astimezone(dt.timezone.utc)
        res = sb.table("agent_suggestions").select("id").eq("tipo", "daily_brief").gte(
            "created_at", start_utc.isoformat()
        ).limit(1).execute().data or []
        return len(res) > 0
    except Exception as exc:  # noqa: BLE001
        print(f"[scheduler] no se pudo verificar brief de hoy: {exc}", flush=True)
        return False


def _job_plan_today() -> None:
    print("[scheduler] regenerando plan del día…", flush=True)
    out = _run_plan_today(20, source="scheduler")
    print(f"[scheduler] plan del día listo: {out}", flush=True)


def _job_draft_emails() -> None:
    print("[scheduler] generando borradores de correo faltantes…", flush=True)
    out = draft_pending_emails(DraftPendingInput(limit=DRAFT_EMAILS_LIMIT, only_missing=True))
    print(f"[scheduler] borradores de correo: {out}", flush=True)


def _job_daily_brief() -> None:
    if DAILY_BRIEF_FALLBACK and _brief_exists_today():
        print("[scheduler] el brief de hoy ya existe (n8n); omito respaldo.", flush=True)
        return
    print("[scheduler] generando daily brief de respaldo…", flush=True)
    out = daily_brief_from_db()
    print(f"[scheduler] daily brief de respaldo: {out.get('suggestion_id')}", flush=True)


def _scheduler_loop(name: str, hh: int, mm: int, job) -> None:
    while True:
        time.sleep(_seconds_until(hh, mm))
        try:
            job()
        except Exception as exc:  # noqa: BLE001
            print(f"[scheduler:{name}] job falló: {exc}", flush=True)
        # Colchón para no re-disparar dentro del mismo minuto objetivo.
        time.sleep(61)


@app.on_event("startup")
def _start_scheduler() -> None:
    if not SCHEDULER_ENABLED:
        print("[scheduler] deshabilitado (HERMES_SCHEDULER_ENABLED=0).", flush=True)
        return
    ph, pm = _parse_hhmm(PLAN_TODAY_AT, 8, 5)
    bh, bm = _parse_hhmm(DAILY_BRIEF_AT, 8, 30)
    threading.Thread(
        target=_scheduler_loop, args=("plan_today", ph, pm, _job_plan_today), daemon=True
    ).start()
    threading.Thread(
        target=_scheduler_loop, args=("daily_brief", bh, bm, _job_daily_brief), daemon=True
    ).start()
    log_extra = ""
    if DRAFT_EMAILS_ENABLED:
        dh, dm = _parse_hhmm(DRAFT_EMAILS_AT, 7, 55)
        threading.Thread(
            target=_scheduler_loop, args=("draft_emails", dh, dm, _job_draft_emails), daemon=True
        ).start()
        log_extra = f" · draft_emails {dh:02d}:{dm:02d}"
    print(
        f"[scheduler] activo · plan_today {ph:02d}:{pm:02d} · "
        f"daily_brief {bh:02d}:{bm:02d}{log_extra} (UTC{TZ_OFFSET_HOURS:+g})",
        flush=True,
    )
