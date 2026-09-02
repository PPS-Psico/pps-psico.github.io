#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
espacios.py — Gestion de solicitudes de nuevos espacios de PPS.

Un "nuevo espacio" es una institucion que propone un estudiante para hacer ahi
su practica. Vive en `solicitudes_pps` y su gestion pasa casi entera por
WhatsApp: hay que contactar a la institucion, ver si acepta, y recien despues
existe el convenio.

Este script hace la parte deterministica de ese trabajo — la que no necesita
criterio y por eso no deberia hacerla una persona ni un modelo:

  · resolver el telefono al formato que entiende WhatsApp (el panel los guarda
    de seis formas distintas);
  · calcular hace cuanto que la gestion no se mueve, mirando la conversacion y
    no solo la fila de la base;
  · decir si ya hubo contacto previo, que es lo que separa un mensaje de
    presentacion de uno de seguimiento;
  · buscar si la institucion ya esta en el catalogo antes de tratarla como nueva;
  · registrar el contacto una vez hecho, para que la solicitud deje de figurar
    como estancada.

Lo que NO hace, a proposito: redactar el mensaje y mandarlo. Eso lo hace Claude
en sesion, porque necesita el contexto que este script junta mas los correos
previos, y porque mandar un WhatsApp a un tercero se confirma de a uno.

Uso:
    python scripts/pps/espacios.py listar
    python scripts/pps/espacios.py ficha 35466
    python scripts/pps/espacios.py registrar <solicitud_id> --canal whatsapp \
        --nota "Primer contacto por WhatsApp"

Credenciales: se leen del `.env` del repo (SUPABASE_SERVICE_ROLE_KEY). Nunca se
imprimen ni se pasan por linea de comandos.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]

# Estados que sacan a una solicitud del tablero: ya se resolvio, para bien o para mal.
ESTADOS_CERRADOS = ["Realizada", "No se pudo concretar", "Archivado"]

# A partir de aca la gestion se considera frenada. Mismo umbral que usa el panel
# en el filtro "Sin movimiento +4d", para que las dos superficies coincidan.
DIAS_ESTANCADA = 4

# Palabras que aparecen en media base y no distinguen una institucion de otra.
# Sin sacarlas, "Instituto Secundario Pablo VI" matchea con cualquier "Instituto".
GENERICOS = {
    "instituto", "institucion", "fundacion", "centro", "asociacion", "civil",
    "hospital", "colegio", "escuela", "secundario", "primario", "consejo",
    "ministerio", "subsecretaria", "secretaria", "direccion", "programa",
    "servicio", "clinica", "sanatorio", "municipalidad", "provincial",
    "nacional", "universidad", "uflo", "del", "las", "los", "para", "con",
}


# ─────────────────────────────────────────────────────────────────────────────
# Acceso a datos
# ─────────────────────────────────────────────────────────────────────────────

def cargar_env() -> dict[str, str]:
    env: dict[str, str] = {}
    ruta = REPO / ".env"
    if not ruta.exists():
        sys.exit(f"No encuentro {ruta}. Corré el script desde el repo del panel.")
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            k, v = linea.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


class Panel:
    """Cliente minimo de PostgREST. Usa la service role key, asi que ignora RLS:
    solo para uso local del coordinador, nunca desde el navegador."""

    def __init__(self) -> None:
        env = cargar_env()
        self.url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
        self.key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.url or not self.key:
            sys.exit("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")

    def _req(self, metodo: str, path: str, cuerpo: dict | None = None) -> list[dict]:
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}",
            data=datos,
            method=metodo,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        with urllib.request.urlopen(req, timeout=45) as r:
            crudo = r.read().decode()
            return json.loads(crudo) if crudo.strip() else []

    def get(self, path: str) -> list[dict]:
        return self._req("GET", path)

    def patch(self, path: str, cuerpo: dict) -> list[dict]:
        return self._req("PATCH", path, cuerpo)


# ─────────────────────────────────────────────────────────────────────────────
# Normalizacion
# ─────────────────────────────────────────────────────────────────────────────

def solo_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def normalizar_telefono(crudo) -> str | None:
    """Devuelve el numero en el formato que espera WhatsApp (E.164 sin '+'), o None.

    El panel guarda los telefonos como los escribio quien cargo la solicitud:
    '2984695992', '+5492994331411', '0298 15 469-5992'. Mandar el numero mal
    formado abre un chat vacio con un desconocido, asi que esta funcion es el
    punto donde ese desorden se termina.

    Movil argentino en E.164: 54 + 9 + area + abonado, con area+abonado = 10.
    """
    d = solo_digitos(crudo)
    if not d:
        return None

    if d.startswith("00"):
        d = d[2:]

    # Ya viene con pais.
    if d.startswith("54"):
        resto = d[2:]
        if resto.startswith("9"):
            resto = resto[1:]
        resto = _sacar_prefijos_locales(resto)
        return f"549{resto}" if len(resto) == 10 else None

    d = _sacar_prefijos_locales(d)
    if len(d) == 10:
        return f"549{d}"

    # Numeros extranjeros u otras longitudes: los devolvemos tal cual si son
    # plausibles, pero sin inventarles el 9 argentino.
    return d if 11 <= len(d) <= 15 else None


def _sacar_prefijos_locales(d: str) -> str:
    """Saca el 0 de larga distancia y el 15 de celular que se escriben a mano.

    '0298154695992' -> '2984695992'. Solo se toca el 15 cuando quitarlo deja un
    numero de largo valido: hay areas que empiezan con 15 y no hay que romperlas.
    """
    if d.startswith("0"):
        d = d[1:]
    for largo_area in (2, 3, 4):
        if len(d) > largo_area + 2 and d[largo_area:largo_area + 2] == "15":
            candidato = d[:largo_area] + d[largo_area + 2:]
            if len(candidato) == 10:
                return candidato
    return d


def normalizar_texto(s) -> str:
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def tokens_distintivos(nombre) -> set[str]:
    return {t for t in normalizar_texto(nombre).split() if len(t) > 3 and t not in GENERICOS}


def parse_ts(ts):
    if not ts:
        return None
    try:
        d = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# Enriquecimiento
# ─────────────────────────────────────────────────────────────────────────────

def buscar_en_catalogo(nombre, instituciones) -> list[tuple[dict, float]]:
    """Candidatos del catalogo para el nombre que escribio el estudiante.

    Devuelve pares (institucion, confianza) ordenados. Es deliberadamente
    conservador: exige al menos un token distintivo compartido, porque el
    matcheo por similitud de texto suelta 'Instituto X' contra 'Instituto Y' y
    eso hace tratar como conocida a una institucion nueva.
    """
    objetivo = normalizar_texto(nombre)
    tok = tokens_distintivos(nombre)
    if not objetivo:
        return []

    salida = []
    for inst in instituciones:
        cand = normalizar_texto(inst.get("nombre"))
        if not cand:
            continue
        compartidos = tok & tokens_distintivos(inst.get("nombre"))
        if not compartidos:
            continue
        ratio = SequenceMatcher(None, objetivo, cand).ratio()
        confianza = min(1.0, ratio + 0.15 * len(compartidos))
        salida.append((inst, round(confianza, 2)))

    return sorted(salida, key=lambda x: -x[1])[:4]


def indexar_whatsapp(panel: Panel) -> dict[str, list[dict]]:
    """Agrupa los mensajes por los ultimos 10 digitos del chat.

    Los ultimos 10 digitos son la parte estable del numero argentino: sobreviven
    al 0, al 15, al +54 y al 9. Es la unica clave que matchea de forma confiable
    contra lo que se cargo a mano en el panel.
    """
    msgs = panel.get(
        "whatsapp_mensajes?select=chat_jid,from_me,autor,texto,timestamp"
        "&order=timestamp.desc&limit=5000"
    )
    idx: dict[str, list[dict]] = {}
    for m in msgs:
        jid = (m.get("chat_jid") or "").split("@")[0]
        clave = solo_digitos(jid)[-10:]
        if clave:
            idx.setdefault(clave, []).append(m)
    return idx


# Con menos de esta cobertura, la ausencia de mensajes no dice nada.
COBERTURA_MINIMA = 0.5
# Mas de esto sin un mensaje nuevo y la copia que se esta ingiriendo esta vieja.
DIAS_INGESTA_FRESCA = 2


def salud_ingesta(panel: Panel, wa_idx: dict[str, list[dict]]) -> dict:
    """¿Se puede creer lo que dice (y lo que NO dice) `whatsapp_mensajes`?

    Existe porque el 2026-09-02 esta pregunta tuvo una respuesta cara: la base
    no tenia ni un mensaje de una conversacion activa con una institucion, el
    script la declaro "primer contacto", y el mensaje de presentacion que se
    iba a mandar habria caido sobre alguien con quien ya se venia coordinando
    una reunion.

    El cron reporta `wa_sync.done` todos los dias aunque ingiera una copia
    vieja, asi que el estado del cron no sirve como senal. Estas dos si:
    cuan reciente es el mensaje mas nuevo, y que fraccion de los telefonos que
    nos importan tiene alguna conversacion. Cuando cualquiera de las dos falla,
    la ausencia de mensajes deja de significar "no hubo contacto" y pasa a
    significar "no sabemos".
    """
    ahora = dt.datetime.now(dt.timezone.utc)

    ultimo = None
    for msgs in wa_idx.values():
        for m in msgs:
            t = parse_ts(m.get("timestamp"))
            if t and (ultimo is None or t > ultimo):
                ultimo = t
    atraso = (ahora - ultimo).days if ultimo else None

    sols = panel.get(
        "solicitudes_pps?select=telefono_institucion&telefono_institucion=not.is.null")
    esperados = {t[-10:] for t in
                 (normalizar_telefono(s.get("telefono_institucion")) for s in sols) if t}
    con_datos = esperados & set(wa_idx)
    cobertura = len(con_datos) / len(esperados) if esperados else 0.0

    confiable = (
        atraso is not None
        and atraso <= DIAS_INGESTA_FRESCA
        and cobertura >= COBERTURA_MINIMA
    )

    motivos = []
    if atraso is None:
        motivos.append("no hay ningún mensaje ingerido")
    elif atraso > DIAS_INGESTA_FRESCA:
        motivos.append(f"el mensaje más nuevo es de hace {atraso} días")
    if cobertura < COBERTURA_MINIMA:
        motivos.append(
            f"solo {len(con_datos)} de {len(esperados)} teléfonos de solicitudes "
            f"tienen conversación ingerida")

    return {
        "confiable": confiable,
        "atraso_dias": atraso,
        "cobertura": round(cobertura, 3),
        "telefonos_esperados": len(esperados),
        "telefonos_con_datos": len(con_datos),
        "motivos": motivos,
    }


def evaluar(sol: dict, instituciones: list[dict], wa_idx: dict[str, list[dict]],
            ingesta_confiable: bool = True) -> dict:
    """Arma la ficha de trabajo de una solicitud: canal, antiguedad real y estado."""
    ahora = dt.datetime.now(dt.timezone.utc)

    tel = normalizar_telefono(sol.get("telefono_institucion"))
    email = (sol.get("email_institucion") or sol.get("email") or "").strip() or None

    conversacion = wa_idx.get(tel[-10:], []) if tel else []
    conversacion = sorted(conversacion, key=lambda m: str(m.get("timestamp") or ""))
    ultimo_msg = parse_ts(conversacion[-1]["timestamp"]) if conversacion else None

    # La antiguedad se mide contra lo ultimo que paso de verdad, no contra la
    # ultima vez que alguien toco la fila: una institucion que contesto ayer no
    # esta estancada, aunque nadie haya actualizado el panel.
    referencia = parse_ts(sol.get("actualizacion")) or parse_ts(sol.get("created_at"))
    if ultimo_msg and (not referencia or ultimo_msg > referencia):
        referencia = ultimo_msg
    dias = (ahora - referencia).days if referencia else None

    # Quien debe responder es la pregunta que ordena el tablero. Un mensaje
    # presente prueba que hubo contacto; su ausencia no prueba lo contrario, y
    # solo se puede leer como "no hubo contacto" si la ingesta esta sana.
    if conversacion:
        quien = "ellos" if conversacion[-1].get("from_me") else "nosotros"
    elif ingesta_confiable:
        quien = "sin_contacto"
    else:
        quien = "desconocido"

    canal = "whatsapp" if tel else ("email" if email else "ninguno")
    candidatos = buscar_en_catalogo(sol.get("nombre_institucion"), instituciones)

    return {
        "id": sol.get("id"),
        "alumno": sol.get("nombre_alumno"),
        "legajo": sol.get("legajo"),
        "institucion": sol.get("nombre_institucion"),
        "estado": sol.get("estado_seguimiento"),
        "referente": sol.get("referente_institucion") or sol.get("contacto_tutor"),
        "telefono_crudo": sol.get("telefono_institucion"),
        "telefono": tel,
        "email": email,
        "canal": canal,
        "dias": dias,
        "estancada": dias is not None and dias >= DIAS_ESTANCADA,
        "quien_responde": quien,
        "mensajes": len(conversacion),
        "ultimos": [
            {
                "de_mi": bool(m.get("from_me")),
                "autor": m.get("autor"),
                "texto": (m.get("texto") or "")[:300],
                "fecha": str(m.get("timestamp"))[:16],
            }
            for m in conversacion[-6:]
        ],
        "catalogo": [{"nombre": c["nombre"], "id": c["id"],
                      "telefono": c.get("telefono"), "confianza": conf}
                     for c, conf in candidatos],
        "link_whatsapp": f"https://web.whatsapp.com/send?phone={tel}" if tel else None,
        "localidad": sol.get("localidad"),
        "direccion": sol.get("direccion_completa"),
        "orientacion": sol.get("orientacion_sugerida"),
        "tipo_practica": sol.get("tipo_practica"),
        "convenio_uflo": sol.get("convenio_uflo"),
        "tutor_disponible": sol.get("tutor_disponible"),
        "descripcion": sol.get("descripcion_institucion"),
        "notas": sol.get("notas"),
    }


def cargar_abiertas(panel: Panel) -> tuple[list[dict], dict]:
    excl = urllib.parse.quote(
        "(" + ",".join(f'"{e}"' for e in ESTADOS_CERRADOS) + ")", safe="()\","
    )
    sols = panel.get(
        f"solicitudes_pps?select=*&estado_seguimiento=not.in.{excl}&order=created_at.desc"
    )
    insts = panel.get("instituciones?select=id,nombre,telefono,orientaciones&limit=2000")
    wa = indexar_whatsapp(panel)
    salud = salud_ingesta(panel, wa)
    fichas = [evaluar(s, insts, wa, salud["confiable"]) for s in sols]
    # Lo mas viejo primero: es lo que se cae del radar.
    return sorted(fichas, key=lambda f: -(f["dias"] or 0)), salud


# ─────────────────────────────────────────────────────────────────────────────
# Salida
# ─────────────────────────────────────────────────────────────────────────────

ETIQUETA_DEUDA = {
    "sin_contacto": "SIN CONTACTO",
    "nosotros": "TE TOCA A VOS",
    "ellos": "esperando a ellos",
    "desconocido": "SIN DATOS ⚠",
}


def aviso_ingesta(salud: dict) -> None:
    """Encabezado que impide leer el tablero como si fuera completo."""
    if salud["confiable"]:
        return
    print("\n" + "!" * 74)
    print("  LA INGESTA DE WHATSAPP NO ES CONFIABLE — el tablero está incompleto.")
    for m in salud["motivos"]:
        print(f"    · {m}")
    print("  «SIN DATOS» no significa que no hubo contacto: significa que hay que")
    print("  abrir el chat y mirarlo antes de escribir una sola palabra.")
    print("!" * 74)


def imprimir_listado(fichas: list[dict], salud: dict) -> None:
    if not fichas:
        print("No hay solicitudes abiertas.")
        return

    aviso_ingesta(salud)
    print(f"\n{len(fichas)} solicitud(es) de espacio abiertas\n")
    for f in fichas:
        marca = "!" if f["estancada"] else " "
        dias = f"{f['dias']}d" if f["dias"] is not None else "—"
        print(f" {marca} [{dias:>5}] {ETIQUETA_DEUDA[f['quien_responde']]:<14} "
              f"{(f['institucion'] or '—')[:38]:<40} · {f['alumno'] or '—'}")
        detalle = f"        canal: {f['canal']}"
        if f["telefono"]:
            detalle += f" (+{f['telefono']})"
        if f["catalogo"]:
            mejor = f["catalogo"][0]
            detalle += f" · catálogo: {mejor['nombre'][:34]} ({mejor['confianza']})"
        else:
            detalle += " · institución nueva"
        print(detalle)
    print(f"\n  ! = sin movimiento hace {DIAS_ESTANCADA} días o más\n")


def imprimir_ficha(f: dict) -> None:
    print("=" * 74)
    print(f"{f['institucion'] or '—'}")
    print(f"solicitud {f['id']}")
    print("=" * 74)
    filas = [
        ("Alumno", f"{f['alumno']} · legajo {f['legajo']}"),
        ("Estado", f"{f['estado']}  ({f['dias']} días sin movimiento)"),
        ("Debe responder", ETIQUETA_DEUDA[f["quien_responde"]]),
        ("Referente", f["referente"]),
        ("Teléfono", f"{f['telefono_crudo']}  →  +{f['telefono']}" if f["telefono"]
         else f"{f['telefono_crudo']}  →  NO NORMALIZABLE"),
        ("Email", f["email"]),
        ("Localidad", f"{f['localidad'] or '—'} · {f['direccion'] or '—'}"),
        ("Orientación", f["orientacion"]),
        ("Tipo de práctica", f["tipo_practica"]),
        ("Convenio UFLO", f["convenio_uflo"]),
        ("Tutor disponible", f["tutor_disponible"]),
    ]
    for k, v in filas:
        if v not in (None, "", "None"):
            print(f"  {k:<18}: {v}")

    if f["descripcion"]:
        print(f"  {'Actividades':<18}: {f['descripcion'][:400]}")
    if f["notas"]:
        print(f"  {'Notas':<18}: {f['notas'][:400]}")

    print(f"\n  Catálogo de instituciones:")
    if f["catalogo"]:
        for c in f["catalogo"]:
            print(f"    · {c['nombre'][:50]:<52} confianza {c['confianza']}")
        print("    (verificá: confianza alta no es lo mismo que es la misma institución)")
    else:
        print("    · sin candidatos — es una institución nueva")

    print(f"\n  Conversación de WhatsApp: {f['mensajes']} mensaje(s)")
    for m in f["ultimos"]:
        quien = "VOS" if m["de_mi"] else (m["autor"] or "Ellos")
        print(f"    [{m['fecha']}] {quien}: {m['texto'][:140]}")
    if not f["mensajes"]:
        if f["quien_responde"] == "sin_contacto":
            print("    · ninguno — es primer contacto por este canal")
        else:
            print("    · ninguno EN LA BASE — pero la ingesta no es confiable.")
            print("      NO asumas primer contacto: abrí el chat y leelo.")

    if f["link_whatsapp"]:
        print(f"\n  Abrir chat:  {f['link_whatsapp']}")
    print("\n  Antes de redactar: abrí el chat y revisá también el correo.")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Comandos
# ─────────────────────────────────────────────────────────────────────────────

def cmd_listar(args) -> None:
    fichas, salud = cargar_abiertas(Panel())
    if args.solo_estancadas:
        fichas = [f for f in fichas if f["estancada"]]
    if args.json:
        print(json.dumps({"salud_ingesta": salud, "solicitudes": fichas},
                         ensure_ascii=False, indent=2))
    else:
        imprimir_listado(fichas, salud)


def cmd_ficha(args) -> None:
    fichas, salud = cargar_abiertas(Panel())
    clave = normalizar_texto(args.referencia)
    elegidas = [
        f for f in fichas
        if str(f["id"]) == args.referencia
        or str(f["legajo"] or "") == args.referencia
        or clave in normalizar_texto(f["institucion"])
        or clave in normalizar_texto(f["alumno"])
    ]
    if not elegidas:
        sys.exit(f"No encontré ninguna solicitud abierta que coincida con «{args.referencia}».")
    if args.json:
        print(json.dumps({"salud_ingesta": salud, "solicitudes": elegidas},
                         ensure_ascii=False, indent=2))
        return
    aviso_ingesta(salud)
    for f in elegidas:
        imprimir_ficha(f)


def cmd_registrar(args) -> None:
    """Deja constancia de que se contactó a la institución.

    Toca `actualizacion` — que es lo que mira el panel para decidir si la
    gestión está frenada — y opcionalmente el estado. Sin esto, una solicitud
    recién contactada sigue apareciendo como estancada al día siguiente.
    """
    panel = Panel()
    filas = panel.get(f"solicitudes_pps?select=*&id=eq.{args.solicitud_id}")
    if not filas:
        sys.exit(f"No existe la solicitud {args.solicitud_id}.")
    sol = filas[0]

    # `actualizacion` es lo que mira el panel para decidir si la gestion esta
    # frenada, asi que tiene que apuntar al ultimo movimiento REAL. Sellarla con
    # hoy al registrar un contacto viejo esconde la gestion justo cuando hay que
    # verla: una conversacion trabada hace ocho dias volveria a arrancar de cero.
    if args.fecha:
        try:
            cuando = dt.datetime.strptime(args.fecha, "%Y-%m-%d").replace(
                tzinfo=dt.timezone.utc)
        except ValueError:
            sys.exit("--fecha va como AAAA-MM-DD.")
    else:
        cuando = dt.datetime.now(dt.timezone.utc)

    sello = cuando.strftime("%d/%m/%Y")
    linea = f"[{sello}] Contacto por {args.canal}."
    if args.nota:
        linea += f" {args.nota}"

    previas = (sol.get("notas") or "").strip()
    cambios = {
        "actualizacion": cuando.isoformat(),
        "notas": f"{previas}\n{linea}".strip() if previas else linea,
    }
    if args.estado:
        cambios["estado_seguimiento"] = args.estado

    print(f"Solicitud : {sol.get('nombre_institucion')} · {sol.get('nombre_alumno')}")
    print(f"Estado    : {sol.get('estado_seguimiento')}"
          + (f"  →  {args.estado}" if args.estado else "  (sin cambio)"))
    print(f"Nota      : {linea}")

    if args.dry_run:
        print("\n(dry-run: no se escribió nada)")
        return

    panel.patch(f"solicitudes_pps?id=eq.{args.solicitud_id}", cambios)
    print("\nRegistrado.")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Gestión de solicitudes de nuevos espacios de PPS.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("listar", help="Tablero de solicitudes abiertas.")
    pl.add_argument("--solo-estancadas", action="store_true")
    pl.add_argument("--json", action="store_true")
    pl.set_defaults(func=cmd_listar)

    pf = sub.add_parser("ficha", help="Dossier de una solicitud (id, legajo, institución o alumno).")
    pf.add_argument("referencia")
    pf.add_argument("--json", action="store_true")
    pf.set_defaults(func=cmd_ficha)

    pr = sub.add_parser("registrar", help="Registrar que se contactó a la institución.")
    pr.add_argument("solicitud_id")
    pr.add_argument("--canal", required=True, choices=["whatsapp", "email", "telefono"])
    pr.add_argument("--nota", default="")
    pr.add_argument("--fecha", default=None,
                    help="AAAA-MM-DD del contacto real. Sin esto usa hoy — no lo "
                         "omitas al registrar algo que pasó antes.")
    pr.add_argument("--estado", default=None,
                    help="Nuevo estado_seguimiento (ej: 'En conversaciones').")
    pr.add_argument("--dry-run", action="store_true")
    pr.set_defaults(func=cmd_registrar)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
