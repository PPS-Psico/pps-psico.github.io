#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
correcciones.py — Revision de solicitudes de cambio y de alta de PPS.

Dos cosas distintas que el alumno pide desde su panel:

  · `solicitudes_nueva_pps`        — "agregar una PPS que hice por fuera".
    Al aprobarla se CREA una fila en `practicas` con estado Finalizada.
  · `solicitudes_modificacion_pps` — "cambiar las horas de esta PPS".
    Al aprobarla se PISA `practicas.horas_realizadas`.

(Las de baja, `tipo_modificacion = eliminacion`, quedan afuera a proposito: ya
tienen su RPC con la logica de penalizacion, y son una decision disciplinaria,
no documental.)

Las dos terminan tocando el legajo academico, y de ahi pasan al SAC y a la
titulacion. Un "aprobado" equivocado es el error mas caro del sistema.

Este script hace la CAPA 1: todo lo que se puede verificar con aritmetica y con
lo que ya esta en la base, sin leer un solo documento y sin modelo de lenguaje.
Alcanza para cazar duplicados, solapamientos, fechas imposibles y — lo mas
importante — si el cambio empuja al alumno por encima de un umbral de
titulacion, que suele ser el motivo real del pedido.

Lo que este script NO hace, y hay que hacer aparte antes de aprobar nada:
leer la planilla de asistencia y el informe. `descargar` los baja para eso.

**El veredicto nunca dice "aprobar".** Lo mejor que dice es `limpio`, que
significa: la capa 1 no encontro nada, ahora hay que mirar los papeles.

Uso:
    python scripts/pps/correcciones.py listar
    python scripts/pps/correcciones.py revisar <id|legajo|apellido>
    python scripts/pps/correcciones.py revisar --todas
    python scripts/pps/correcciones.py descargar <id>
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from espacios import Panel, normalizar_texto, parse_ts  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HORAS_TOTAL = 250
HORAS_ORIENTACION = 70
ROTACION = 3
TOPE_HORAS_MODIFICACION = 120

# Estados de practica que no aportan nada a los requisitos (espeja studentRules).
NO_COMPUTABLES = {"desaprobada", "no se pudo concretar"}
ACTIVAS = {"en curso", "pendiente", "en proceso"}

# Una PPS de un solo dia con muchas horas es valida hasta 2024 (se otorgaban
# horas por el trabajo final). De 2025 en adelante hay que preguntar.
ANIO_CORTE_DIA_UNICO = 2025
# Por encima de esto, un solo dia de practica deja de ser plausible.
HORAS_MAX_POR_DIA = 12


# ─────────────────────────────────────────────────────────────────────────────
# Hallazgos
# ─────────────────────────────────────────────────────────────────────────────

class Hallazgo:
    """Algo que la capa 1 encontro. `nivel` ordena la atencion, no la decision."""

    def __init__(self, nivel: str, titulo: str, detalle: str):
        assert nivel in ("bloqueante", "atencion", "dato")
        self.nivel = nivel
        self.titulo = titulo
        self.detalle = detalle

    def dict(self) -> dict:
        return {"nivel": self.nivel, "titulo": self.titulo, "detalle": self.detalle}


ICONO = {"bloqueante": "✗", "atencion": "!", "dato": "·"}


# ─────────────────────────────────────────────────────────────────────────────
# Contexto del alumno
# ─────────────────────────────────────────────────────────────────────────────

def horas_efectivas(pr: dict, objetivo_por_lanzamiento: dict[str, int]) -> int:
    """Horas que la practica aporta hoy a los totales.

    Espeja `getEffectiveHours` de studentRules: una practica en curso aporta el
    objetivo del lanzamiento, no las horas ya cargadas (que suelen ser 0). Si se
    contaran las cargadas, el efecto de una solicitud sobre los umbrales daria
    sistematicamente bajo y el chequeo mas util del script seria el mas flojo.
    """
    reales = int(pr.get("horas_realizadas") or 0)
    estado = normalizar_texto(pr.get("estado"))
    if estado in ACTIVAS:
        objetivo = objetivo_por_lanzamiento.get(pr.get("lanzamiento_id") or "", 0)
        return max(reales, objetivo)
    return reales


def criterios(practicas: list[dict], orientacion_elegida: str,
              objetivos: dict[str, int]) -> dict:
    utiles = [p for p in practicas
              if normalizar_texto(p.get("estado")) not in NO_COMPUTABLES]
    total = sum(horas_efectivas(p, objetivos) for p in utiles)
    obj = normalizar_texto(orientacion_elegida)
    de_orientacion = sum(horas_efectivas(p, objetivos) for p in utiles
                         if obj and obj in normalizar_texto(p.get("especialidad")))
    orientaciones = sorted({(p.get("especialidad") or "").strip()
                            for p in utiles if (p.get("especialidad") or "").strip()})
    return {
        "horas_totales": total,
        "horas_orientacion": de_orientacion,
        "orientaciones": orientaciones,
        "cumple_total": total >= HORAS_TOTAL,
        "cumple_orientacion": de_orientacion >= HORAS_ORIENTACION,
        "cumple_rotacion": len(orientaciones) >= ROTACION,
    }


def contexto_alumno(panel: Panel, estudiante_id: str) -> dict:
    est = panel.get(f"estudiantes?select=id,nombre,legajo,correo,estado,"
                    f"orientacion_elegida&id=eq.{estudiante_id}")
    practicas = panel.get(
        f"practicas?select=id,nombre_institucion,institucion_id,especialidad,"
        f"horas_realizadas,estado,fecha_inicio,fecha_finalizacion,lanzamiento_id"
        f"&estudiante_id=eq.{estudiante_id}")

    ids = {p.get("lanzamiento_id") for p in practicas if p.get("lanzamiento_id")}
    objetivos: dict[str, int] = {}
    if ids:
        lote = ",".join(ids)
        for lz in panel.get(
                f"lanzamientos_pps?select=id,horas_acreditadas&id=in.({lote})"):
            objetivos[lz["id"]] = int(lz.get("horas_acreditadas") or 0)

    return {
        "estudiante": est[0] if est else None,
        "practicas": practicas,
        "objetivos": objetivos,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Chequeos
# ─────────────────────────────────────────────────────────────────────────────

def solapan(ini_a, fin_a, ini_b, fin_b) -> bool:
    a1, a2, b1, b2 = parse_ts(ini_a), parse_ts(fin_a), parse_ts(ini_b), parse_ts(fin_b)
    if not (a1 and b1):
        return False
    a2 = a2 or a1
    b2 = b2 or b1
    return a1 <= b2 and b1 <= a2


def chequear_fechas(ini, fin, horas, out: list[Hallazgo]) -> None:
    d1, d2 = parse_ts(ini), parse_ts(fin)
    hoy = dt.datetime.now(dt.timezone.utc)

    if not d1 or not d2:
        out.append(Hallazgo("bloqueante", "Fechas incompletas",
                            f"inicio={ini} · fin={fin}"))
        return

    if d2 < d1:
        out.append(Hallazgo("bloqueante", "Fin anterior al inicio",
                            f"{str(d1)[:10]} → {str(d2)[:10]}"))
    if d2 > hoy:
        out.append(Hallazgo("bloqueante", "La fecha de fin está en el futuro",
                            f"termina el {str(d2)[:10]}; suele ser un año mal tipeado"))

    dias = (d2 - d1).days + 1
    if dias > 400:
        out.append(Hallazgo("atencion", "Período de más de un año",
                            f"{dias} días entre inicio y fin"))

    if horas and dias > 0:
        por_dia = horas / dias
        if dias == 1:
            if d1.year >= ANIO_CORTE_DIA_UNICO:
                out.append(Hallazgo(
                    "atencion", "Un solo día con todas las horas",
                    f"{horas} h en {str(d1)[:10]}. Válido hasta 2024 (horas por "
                    f"trabajo final); de 2025 en adelante hay que preguntar."))
        elif por_dia > HORAS_MAX_POR_DIA:
            out.append(Hallazgo(
                "bloqueante", "Horas por día imposibles",
                f"{horas} h en {dias} días = {por_dia:.1f} h/día"))


def chequear_duplicados(sol: dict, ctx: dict, hermanas: list[dict],
                        ini, fin, out: list[Hallazgo]) -> None:
    inst = normalizar_texto(sol.get("nombre_institucion_manual") or "")
    inst_id = sol.get("institucion_id")

    for otra in hermanas:
        if otra["id"] == sol["id"]:
            continue
        if otra.get("estudiante_id") != sol.get("estudiante_id"):
            continue
        misma_inst = (
            (inst_id and otra.get("institucion_id") == inst_id)
            or (inst and normalizar_texto(otra.get("nombre_institucion_manual") or "") == inst)
        )
        if misma_inst and solapan(ini, fin, otra.get("fecha_inicio"),
                                  otra.get("fecha_finalizacion")):
            out.append(Hallazgo(
                "bloqueante", "Otra solicitud del mismo alumno se pisa con esta",
                f"solicitud {otra['id'][:8]} ({otra.get('estado')}), "
                f"{otra.get('fecha_inicio')} → {otra.get('fecha_finalizacion')}, "
                f"{otra.get('horas_estimadas')} h"))

    for pr in ctx["practicas"]:
        if normalizar_texto(pr.get("estado")) in NO_COMPUTABLES:
            continue
        if solapan(ini, fin, pr.get("fecha_inicio"), pr.get("fecha_finalizacion")):
            mismo_lugar = (inst_id and pr.get("institucion_id") == inst_id) or (
                inst and inst in normalizar_texto(pr.get("nombre_institucion")))
            nivel = "bloqueante" if mismo_lugar else "atencion"
            que = ("Ya tiene cargada una PPS en esa institución y en esas fechas"
                   if mismo_lugar else
                   "Se superpone en el tiempo con otra PPS ya cargada")
            out.append(Hallazgo(nivel, que,
                                f"{pr.get('nombre_institucion')} · "
                                f"{pr.get('fecha_inicio')} → {pr.get('fecha_finalizacion')} · "
                                f"{pr.get('horas_realizadas')} h · {pr.get('estado')}"))


def chequear_efecto(ctx: dict, especialidad: str, horas: int,
                    out: list[Hallazgo], practica_id: str | None = None,
                    horas_previas: int = 0) -> dict:
    """Recalcula los criterios con y sin el cambio. Es el chequeo que importa."""
    est = ctx["estudiante"] or {}
    orient = est.get("orientacion_elegida") or ""
    antes = criterios(ctx["practicas"], orient, ctx["objetivos"])

    simuladas = [dict(p) for p in ctx["practicas"]]
    if practica_id:
        for p in simuladas:
            if p["id"] == practica_id:
                p["horas_realizadas"] = horas
                p["estado"] = "Finalizada"
    else:
        simuladas.append({
            "id": "__nueva__", "especialidad": especialidad,
            "horas_realizadas": horas, "estado": "Finalizada",
            "lanzamiento_id": None, "fecha_inicio": None, "fecha_finalizacion": None,
        })
    despues = criterios(simuladas, orient, ctx["objetivos"])

    delta = despues["horas_totales"] - antes["horas_totales"]
    out.append(Hallazgo(
        "dato", "Efecto sobre el legajo",
        f"horas {antes['horas_totales']} → {despues['horas_totales']} ({delta:+d}) "
        f"de {HORAS_TOTAL} · orientación «{orient or '—'}» "
        f"{antes['horas_orientacion']} → {despues['horas_orientacion']} de {HORAS_ORIENTACION} · "
        f"rotación {len(antes['orientaciones'])} → {len(despues['orientaciones'])} de {ROTACION}"))

    cruces = []
    if not antes["cumple_total"] and despues["cumple_total"]:
        cruces.append(f"las {HORAS_TOTAL} horas totales")
    if not antes["cumple_orientacion"] and despues["cumple_orientacion"]:
        cruces.append(f"las {HORAS_ORIENTACION} de la orientación elegida")
    if not antes["cumple_rotacion"] and despues["cumple_rotacion"]:
        cruces.append(f"la rotación de {ROTACION} orientaciones")
    if cruces:
        out.append(Hallazgo(
            "atencion", "Con este cambio el alumno pasa a cumplir un requisito",
            "cruza " + ", ".join(cruces) + ". Suele ser el motivo real del pedido: "
            "verificá los papeles con más cuidado, no menos."))

    return {"antes": antes, "despues": despues}


# ─────────────────────────────────────────────────────────────────────────────
# Revision por tipo
# ─────────────────────────────────────────────────────────────────────────────

def revisar_nueva(panel: Panel, sol: dict, hermanas: list[dict],
                  instituciones: dict[str, dict]) -> dict:
    out: list[Hallazgo] = []
    ctx = contexto_alumno(panel, sol["estudiante_id"])
    horas = int(sol.get("horas_estimadas") or 0)

    chequear_fechas(sol.get("fecha_inicio"), sol.get("fecha_finalizacion"), horas, out)
    chequear_duplicados(sol, ctx, hermanas, sol.get("fecha_inicio"),
                        sol.get("fecha_finalizacion"), out)

    # Institucion
    inst = instituciones.get(sol.get("institucion_id") or "")
    if inst:
        out.append(Hallazgo("dato", "Institución del catálogo", inst.get("nombre") or "—"))
    elif sol.get("nombre_institucion_manual"):
        out.append(Hallazgo(
            "atencion", "Institución cargada a mano, fuera del catálogo",
            f"«{sol['nombre_institucion_manual']}». Sin convenio verificable: esto "
            f"en realidad es una solicitud de espacio nuevo disfrazada de corrección."))
    else:
        out.append(Hallazgo("bloqueante", "Sin institución",
                            "no tiene ni institucion_id ni nombre manual"))

    # Archivos, segun modalidad (misma regla que valida el formulario del alumno)
    online = bool(sol.get("es_online"))
    if online and not sol.get("informe_final_url"):
        out.append(Hallazgo("bloqueante", "PPS online sin informe final",
                            "el informe es obligatorio cuando es a distancia"))
    if not online and not sol.get("planilla_asistencia_url"):
        out.append(Hallazgo("bloqueante", "PPS presencial sin planilla de asistencia",
                            "la planilla es obligatoria cuando es presencial"))

    if horas <= 0:
        out.append(Hallazgo("bloqueante", "Horas en cero o ausentes", str(horas)))

    chequear_efecto(ctx, sol.get("orientacion") or "", horas, out)
    return armar(sol, "nueva", ctx, out)


def revisar_modificacion(panel: Panel, sol: dict) -> dict:
    out: list[Hallazgo] = []
    ctx = contexto_alumno(panel, sol["estudiante_id"])
    nuevas = int(sol.get("horas_nuevas") or 0)

    practica = next((p for p in ctx["practicas"] if p["id"] == sol.get("practica_id")), None)
    if not practica:
        out.append(Hallazgo(
            "bloqueante", "La práctica que se quiere modificar ya no existe",
            f"practica_id={sol.get('practica_id')}"))
        return armar(sol, "modificacion", ctx, out)

    actuales = int(practica.get("horas_realizadas") or 0)
    delta = nuevas - actuales
    out.append(Hallazgo(
        "dato", "Cambio pedido",
        f"{practica.get('nombre_institucion')} · {actuales} h → {nuevas} h ({delta:+d})"))

    if nuevas <= 0:
        out.append(Hallazgo("bloqueante", "Horas nuevas en cero o negativas", str(nuevas)))
    if nuevas > TOPE_HORAS_MODIFICACION:
        out.append(Hallazgo("bloqueante", f"Supera el tope de {TOPE_HORAS_MODIFICACION} h",
                            f"pide {nuevas} h"))
    if delta == 0:
        out.append(Hallazgo("atencion", "No cambia nada",
                            "las horas pedidas son las que ya tiene"))
    if not sol.get("planilla_asistencia_url"):
        out.append(Hallazgo("bloqueante", "Sin planilla de asistencia",
                            "es el único respaldo del cambio"))

    chequear_fechas(practica.get("fecha_inicio"), practica.get("fecha_finalizacion"),
                    nuevas, out)
    chequear_efecto(ctx, practica.get("especialidad") or "", nuevas, out,
                    practica_id=practica["id"], horas_previas=actuales)
    return armar(sol, "modificacion", ctx, out)


def armar(sol: dict, tipo: str, ctx: dict, out: list[Hallazgo]) -> dict:
    est = ctx["estudiante"] or {}
    niveles = {h.nivel for h in out}
    if "bloqueante" in niveles:
        veredicto = "bloqueante"
    elif "atencion" in niveles:
        veredicto = "atencion"
    else:
        veredicto = "limpio"
    return {
        "id": sol["id"],
        "tipo": tipo,
        "creada": str(sol.get("created_at"))[:10],
        "alumno": est.get("nombre"),
        "legajo": est.get("legajo"),
        "correo": est.get("correo"),
        "veredicto": veredicto,
        "hallazgos": [h.dict() for h in out],
        "planilla": sol.get("planilla_asistencia_url"),
        "informe": sol.get("informe_final_url") or None,
    }


def revisar_todas(panel: Panel) -> list[dict]:
    mods = panel.get("solicitudes_modificacion_pps?select=*&estado=eq.pendiente"
                     "&tipo_modificacion=neq.eliminacion&order=created_at")
    nuevas = panel.get("solicitudes_nueva_pps?select=*&order=created_at")
    insts = {i["id"]: i for i in
             panel.get("instituciones?select=id,nombre,telefono&limit=2000")}

    salida = [revisar_modificacion(panel, m) for m in mods]
    salida += [revisar_nueva(panel, n, nuevas, insts)
               for n in nuevas if n.get("estado") == "pendiente"]
    orden = {"bloqueante": 0, "atencion": 1, "limpio": 2}
    return sorted(salida, key=lambda r: (orden[r["veredicto"]], r["creada"]))


# ─────────────────────────────────────────────────────────────────────────────
# Salida
# ─────────────────────────────────────────────────────────────────────────────

SELLO = {"bloqueante": "BLOQUEANTE", "atencion": "ATENCIÓN  ", "limpio": "limpio    "}


def imprimir(rev: dict, completo: bool = True) -> None:
    print(f"\n{SELLO[rev['veredicto']]}  {rev['tipo'].upper():<12} {rev['id'][:8]}  "
          f"{rev['alumno'] or '—'} · leg {rev['legajo'] or '—'}  (pedida {rev['creada']})")
    if not completo:
        return
    for h in rev["hallazgos"]:
        print(f"     {ICONO[h['nivel']]} {h['titulo']}")
        print(f"       {h['detalle']}")
    print(f"     documentos: planilla={'sí' if rev['planilla'] else 'NO'} · "
          f"informe={'sí' if rev['informe'] else 'NO'}")


def cierre() -> None:
    print("\n" + "─" * 74)
    print("  «limpio» NO significa aprobable: significa que la capa 1 no encontró")
    print("  nada. Falta leer la planilla y el informe, y contrastar la suma de la")
    print("  planilla contra las horas declaradas. Usá `descargar <id>` para eso.")
    print("─" * 74 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# Comandos
# ─────────────────────────────────────────────────────────────────────────────

def cmd_listar(args) -> None:
    revs = revisar_todas(Panel())
    if args.json:
        print(json.dumps(revs, ensure_ascii=False, indent=2))
        return
    conteo = {}
    for r in revs:
        conteo[r["veredicto"]] = conteo.get(r["veredicto"], 0) + 1
    print(f"\n{len(revs)} solicitud(es) pendiente(s): "
          + " · ".join(f"{v} {k}" for k, v in conteo.items()))
    for r in revs:
        imprimir(r, completo=False)
    cierre()


def cmd_revisar(args) -> None:
    revs = revisar_todas(Panel())
    if not args.todas:
        clave = normalizar_texto(args.referencia or "")
        revs = [r for r in revs
                if r["id"].startswith(args.referencia or "\0")
                or str(r["legajo"] or "") == args.referencia
                or (clave and clave in normalizar_texto(r["alumno"]))]
        if not revs:
            sys.exit(f"Nada coincide con «{args.referencia}».")
    if args.json:
        print(json.dumps(revs, ensure_ascii=False, indent=2))
        return
    for r in revs:
        imprimir(r)
    cierre()


def bajar_documento(panel: Panel, url: str) -> bytes:
    """Baja un documento del storage del panel.

    Las URLs guardadas se armaron con `getPublicUrl`, pero el bucket
    `documentos_estudiantes` es privado: pedirlas tal cual devuelve HTTP 400. Hay
    que ir al endpoint autenticado con la service key. Es la misma razon por la
    que el panel envuelve estos enlaces en `SecureStorageLink`.
    """
    import re
    m = re.search(r"/storage/v1/object/(?:public/)?(.+)$", url.split("?")[0])
    if not m:
        raise ValueError(f"No reconozco la URL de storage: {url[:80]}")
    destino = f"{panel.url}/storage/v1/object/{m.group(1)}"
    req = urllib.request.Request(
        destino, headers={"apikey": panel.key, "Authorization": f"Bearer {panel.key}"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def cmd_descargar(args) -> None:
    """Baja los documentos de una solicitud para poder leerlos.

    Los deja en disco y muestra las rutas: leerlos es un paso aparte y
    deliberadamente humano/supervisado, no una llamada automatica a ninguna API.
    """
    revs = revisar_todas(Panel())
    elegida = next((r for r in revs if r["id"].startswith(args.referencia)), None)
    if not elegida:
        sys.exit(f"No encontré una solicitud pendiente que empiece con «{args.referencia}».")

    destino = Path(args.destino).expanduser()
    destino.mkdir(parents=True, exist_ok=True)

    panel = Panel()
    for etiqueta in ("planilla", "informe"):
        url = elegida.get(etiqueta)
        if not url:
            print(f"  {etiqueta}: no tiene")
            continue
        ext = Path(url.split("?")[0]).suffix or ".bin"
        salida = destino / f"{elegida['id'][:8]}_{etiqueta}{ext}"
        try:
            with open(salida, "wb") as f:
                f.write(bajar_documento(panel, url))
            print(f"  {etiqueta}: {salida}  ({salida.stat().st_size // 1024} KB)")
        except Exception as exc:  # noqa: BLE001
            print(f"  {etiqueta}: no se pudo bajar — {exc}")

    print(f"\n  Alumno: {elegida['alumno']} · legajo {elegida['legajo']}")
    print("  Contrastá contra lo declarado: suma de horas de la planilla, fechas,")
    print("  nombre del alumno, institución, y firma/sello del tutor.")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Revisión (capa 1) de solicitudes de cambio y alta de PPS.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("listar", help="Todas las pendientes con su veredicto.")
    pl.add_argument("--json", action="store_true")
    pl.set_defaults(func=cmd_listar)

    pr = sub.add_parser("revisar", help="Detalle de una solicitud (id, legajo o apellido).")
    pr.add_argument("referencia", nargs="?")
    pr.add_argument("--todas", action="store_true")
    pr.add_argument("--json", action="store_true")
    pr.set_defaults(func=cmd_revisar)

    pd = sub.add_parser("descargar", help="Baja planilla e informe de una solicitud.")
    pd.add_argument("referencia")
    pd.add_argument("--destino", default="tmp/correcciones")
    pd.set_defaults(func=cmd_descargar)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
