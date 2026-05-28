"""hermes-pps — servicio HTTP que n8n (y el panel) llaman para razonar sobre los datos.

Endpoints:
  GET  /health                      -> liveness
  POST /tasks/daily_brief           -> arma el brief de la mañana
  POST /tasks/draft_reply           -> redacta borrador de respuesta
  POST /tasks/explore               -> investiga Supabase y escribe hallazgos al vault
  POST /tasks/learn_from_feedback   -> registra aprendizaje a partir de feedback humano

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
WHATSAPP_E2E_KEY = os.environ.get("WHATSAPP_E2E_KEY", "")
WABDD_MASTER_TOKEN = os.environ.get("WABDD_MASTER_TOKEN", "")
WABDD_ANDROID_ID = os.environ.get("WABDD_ANDROID_ID", "")
WABDD_EMAIL = os.environ.get("WABDD_EMAIL", "")

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
    invocation_id = str(uuid.uuid4())
    audit("daily_brief.start", payload.model_dump(), invocation_id=invocation_id)

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
        "contexto": {"model": HERMES_MODEL, "input_summary": {k: len(v) for k, v in payload.model_dump().items()}},
    }).execute()

    audit(
        "daily_brief.done",
        invocation_id=invocation_id,
        suggestion_id=suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
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
    """Lee criterios.md y contexto-uflo.md del operador para contexto del LLM."""
    parts = []
    for name in ("criterios.md", "contexto-uflo.md"):
        p = VAULT_PATH / "tuyas" / name
        if p.exists():
            parts.append(f"# tuyas/{name}\n{p.read_text(encoding='utf-8')}")
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


@app.post("/tasks/learn_from_feedback", dependencies=[Depends(require_token)])
def learn_from_feedback(payload: LearnInput) -> dict[str, Any]:
    """Cuando Blas resuelve una suggestion, Hermes destila lo aprendido al vault."""
    t0 = time.time()
    invocation_id = str(uuid.uuid4())
    audit("learn.start", payload.model_dump(), invocation_id=invocation_id)

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

    audit(
        "learn.done",
        output={"vault_path": vault_path, "tag": result.get("tag")},
        invocation_id=invocation_id,
        suggestion_id=payload.suggestion_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return {"vault_path": vault_path, "content": result}


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
    con un registro en `instituciones`. El resto se descarta — privacy por defecto.
    """
    phone_index = _load_institucion_phone_index()
    matched = 0
    skipped_no_match = 0
    rows_for_db = []
    for m in messages:
        phone = m.pop("_phone", "")
        inst_id = phone_index.get(phone) or phone_index.get(phone[-10:] if len(phone) >= 10 else "")
        if inst_id:
            m["institucion_id"] = inst_id
            m["raw"] = {"source": "wabdd"}
            rows_for_db.append(m)
            matched += 1
        else:
            skipped_no_match += 1
            if not only_institutions:
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

        summary = _process_messages_to_db(messages, only_institutions=payload.only_institutions and not pps_phones)
        summary["pps_label_contactos"] = len(pps_phones)

    summary["since_days"] = payload.since_days
    audit(
        "wa_sync.done",
        output={k: v for k, v in summary.items() if k != "wabdd_stdout_tail"},
        invocation_id=invocation_id,
        duration_ms=int((time.time() - t0) * 1000),
    )
    return summary
