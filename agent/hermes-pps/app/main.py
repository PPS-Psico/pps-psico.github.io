"""hermes-pps — servicio HTTP que n8n llama para razonar sobre datos del panel.

Endpoints:
  GET  /health                      -> liveness
  POST /tasks/daily_brief           -> arma el brief de la mañana
  POST /tasks/draft_reply           -> redacta borrador de respuesta
  POST /tasks/institucion_resumen   -> actualiza resumen de una institución

Todas las rutas /tasks/* requieren header X-Hermes-Token == HERMES_INTERNAL_TOKEN.
Toda invocación queda registrada en agent_audit_log.
"""

from __future__ import annotations

import json
import os
import pathlib
import time
import uuid
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
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

SYSTEM_PROMPT_PATH = pathlib.Path(__file__).parent.parent / "system_prompt.md"


# ---------- clients ----------

llm = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL)
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def load_system_prompt() -> str:
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    extras = []
    for name in ("criterios.md", "contexto-uflo.md"):
        p = VAULT_PATH / "tuyas" / name
        if p.exists():
            extras.append(f"\n\n---\n# {name} (criterios personales del operador)\n\n{p.read_text(encoding='utf-8')}")
    return base + "".join(extras)


SYSTEM_PROMPT = load_system_prompt()


# ---------- auth ----------

def require_token(x_hermes_token: str = Header(default="")) -> None:
    if x_hermes_token != HERMES_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="invalid token")


# ---------- audit ----------

def audit(event: str, payload: dict[str, Any], suggestion_id: str | None = None) -> None:
    try:
        sb.table("agent_audit_log").insert({
            "event": event,
            "payload": payload,
            "suggestion_id": suggestion_id,
            "mode": HERMES_MODE,
            "model": HERMES_MODEL,
        }).execute()
    except Exception as exc:  # noqa: BLE001
        # nunca tumbamos el request por un fallo de auditoría, pero lo dejamos visible
        print(f"[audit] fallo al loguear {event}: {exc}", flush=True)


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


# ---------- app ----------

app = FastAPI(title="hermes-pps", version="0.1.0")


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


@app.post("/tasks/daily_brief", dependencies=[Depends(require_token)])
def daily_brief(payload: DailyBriefInput) -> dict[str, Any]:
    t0 = time.time()
    audit("daily_brief.start", payload.model_dump())

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
        "kind": "daily_brief",
        "status": "pending",
        "content": result,
        "model": HERMES_MODEL,
    }).execute()

    audit("daily_brief.done", {"ms": int((time.time() - t0) * 1000)}, suggestion_id=suggestion_id)
    return {"suggestion_id": suggestion_id, "content": result}


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
    audit("draft_reply.start", payload.model_dump())

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

    suggestion_id = str(uuid.uuid4())
    sb.table("agent_suggestions").insert({
        "id": suggestion_id,
        "kind": "draft_reply",
        "status": "pending",
        "content": result,
        "model": HERMES_MODEL,
        "ref_thread_id": payload.thread_id,
        "ref_institucion_id": payload.institucion_id,
    }).execute()

    audit("draft_reply.done", {"ms": int((time.time() - t0) * 1000)}, suggestion_id=suggestion_id)
    return {"suggestion_id": suggestion_id, "content": result}
