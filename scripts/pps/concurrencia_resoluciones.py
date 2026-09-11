#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
concurrencia_resoluciones.py — Competencia real entre dos conexiones sobre las
RPC de resolucion de solicitudes de PPS.

Por que existe: las RPC bloquean la fila con FOR UPDATE, y eso es lo unico que
impide que un doble clic acredite dos veces. Ese bloqueo no se puede observar
desde una sola conexion —las llamadas salen una despues de la otra y nunca
compiten—, asi que hasta ahora era la unica propiedad del sistema que estaba
afirmada y no demostrada.

Como fuerza la competencia: no alcanza con lanzar dos llamadas "al mismo tiempo"
y confiar en que se solapen. La conexion A abre una transaccion y toma el lock de
la solicitud con SELECT ... FOR UPDATE; recien entonces la conexion B llama a la
RPC, que queda esperando ese lock. El arnes verifica que B efectivamente quedo
bloqueada antes de continuar: si B contesta enseguida, el escenario se reporta
como NO CONCLUYENTE en vez de pasar. Un verde que no compitio no prueba nada.

ESCRIBE EN LA BASE. Crea solicitudes sinteticas, las resuelve y las borra al
terminar. No usa las solicitudes reales de la cola. Aun asi, correr contra
produccion deja rastros si el proceso muere en el medio, por eso exige
--confirmo-entorno-de-prueba.

Uso:
    export SUPABASE_DB_URL='postgresql://postgres:...@...:5432/postgres'
    python scripts/pps/concurrencia_resoluciones.py --confirmo-entorno-de-prueba

La cadena de conexion no esta en el .env del repo (ahi solo vive la service role
key, que va por PostgREST y no sirve para abrir dos sesiones). Se saca del
dashboard de Supabase, en Project Settings > Database.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from dataclasses import dataclass, field

try:
    import psycopg
except ImportError:
    sys.exit("Falta psycopg: pip install 'psycopg[binary]'")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Cuanto se espera para dar por hecho que la segunda conexion quedo bloqueada.
ESPERA_BLOQUEO = 1.0
# Tope duro de cada sentencia: si algo se traba, el arnes falla en vez de colgarse.
TIMEOUT_MS = 15_000


@dataclass
class Resultado:
    nombre: str
    estado: str  # "ok" | "falla" | "no concluyente"
    detalle: str = ""


@dataclass
class Arnes:
    dsn: str
    admin_uid: str = ""
    estudiante_id: str = ""
    institucion_id: str = ""
    practica_id: str = ""
    solicitudes_creadas: list[str] = field(default_factory=list)
    modificaciones_creadas: list[str] = field(default_factory=list)
    practicas_creadas: list[str] = field(default_factory=list)

    # ── Conexiones ──────────────────────────────────────────────────────────
    def conectar(self, como_admin: bool = True) -> psycopg.Connection:
        """Sesion que se comporta como el navegador: rol authenticated y un JWT
        simulado. Con el rol de servicio, is_admin() no pasa y las RPC rechazan."""
        conn = psycopg.connect(self.dsn, autocommit=True)
        with conn.cursor() as cur:
            cur.execute(f"set statement_timeout = {TIMEOUT_MS}")
            cur.execute(f"set lock_timeout = {TIMEOUT_MS}")
            if como_admin:
                cur.execute(
                    "select set_config('request.jwt.claims', %s, false)",
                    (json.dumps({"sub": self.admin_uid}),),
                )
                cur.execute("set role authenticated")
        return conn

    # ── Fixtures ────────────────────────────────────────────────────────────
    def preparar(self) -> None:
        with psycopg.connect(self.dsn, autocommit=True) as conn, conn.cursor() as cur:
            cur.execute(
                """
                select user_id from public.estudiantes
                where role in ('SuperUser','Jefe','Directivo','AdminTester')
                  and user_id is not null limit 1
                """
            )
            fila = cur.fetchone()
            if not fila:
                sys.exit("No hay ningun usuario con rol de coordinacion para actuar.")
            self.admin_uid = str(fila[0])

            cur.execute(
                """
                select id from public.estudiantes
                where coalesce(role,'') not in
                      ('SuperUser','Jefe','Directivo','AdminTester')
                limit 1
                """
            )
            fila = cur.fetchone()
            if not fila:
                sys.exit("No hay un estudiante para armar los fixtures.")
            self.estudiante_id = str(fila[0])

            cur.execute("select id from public.instituciones limit 1")
            self.institucion_id = str(cur.fetchone()[0])

            # Practica sintetica propia. Los escenarios de modificacion y baja le
            # cambian las horas y la borran: usar la practica real de un alumno
            # dejaria su legajo alterado si el proceso muere en el medio.
            cur.execute(
                """
                insert into public.practicas
                  (estudiante_id, institucion_id, especialidad, fecha_inicio,
                   fecha_finalizacion, horas_realizadas, estado, nombre_institucion)
                values (%s, %s, 'Clinica', '2026-01-01', '2026-02-01', 80,
                        'Finalizada', 'Practica sintetica del arnes')
                returning id
                """,
                (self.estudiante_id, self.institucion_id),
            )
            self.practica_id = str(cur.fetchone()[0])
            self.practicas_creadas.append(self.practica_id)

    def nueva_solicitud(self) -> str:
        """Solicitud de alta sintetica, pendiente. No toca la cola real."""
        with psycopg.connect(self.dsn, autocommit=True) as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into public.solicitudes_nueva_pps
                  (estudiante_id, institucion_id, orientacion, fecha_inicio,
                   fecha_finalizacion, horas_estimadas, es_online,
                   informe_final_url, planilla_asistencia_url)
                values (%s, %s, 'Clinica', '2026-01-01', '2026-02-01', 80, false,
                        'http://prueba/informe', 'http://prueba/planilla')
                returning id
                """,
                (self.estudiante_id, self.institucion_id),
            )
            sid = str(cur.fetchone()[0])
        self.solicitudes_creadas.append(sid)
        return sid

    def nueva_modificacion(self, tipo: str = "horas") -> str:
        with psycopg.connect(self.dsn, autocommit=True) as conn, conn.cursor() as cur:
            if tipo == "eliminacion":
                cur.execute(
                    """
                    insert into public.solicitudes_modificacion_pps
                      (estudiante_id, practica_id, tipo_modificacion, estado,
                       motivo_baja, motivo_baja_detalle)
                    values (%s, %s, 'eliminacion', 'pendiente', 'otro',
                            'baja sintetica del arnes de concurrencia')
                    returning id
                    """,
                    (self.estudiante_id, self.practica_id),
                )
            else:
                cur.execute(
                    """
                    insert into public.solicitudes_modificacion_pps
                      (estudiante_id, practica_id, tipo_modificacion, horas_nuevas, estado)
                    values (%s, %s, 'horas', 90, 'pendiente')
                    returning id
                    """,
                    (self.estudiante_id, self.practica_id),
                )
            sid = str(cur.fetchone()[0])
        self.modificaciones_creadas.append(sid)
        return sid

    def limpiar(self) -> None:
        """Borra todo lo sintetico. Las practicas creadas por una aprobacion se
        borran primero: la solicitud las referencia."""
        with psycopg.connect(self.dsn, autocommit=True) as conn, conn.cursor() as cur:
            for sid in self.solicitudes_creadas:
                cur.execute(
                    "select practica_id from public.solicitudes_nueva_pps where id = %s",
                    (sid,),
                )
                fila = cur.fetchone()
                if fila and fila[0]:
                    self.practicas_creadas.append(str(fila[0]))
                cur.execute("delete from public.solicitudes_nueva_pps where id = %s", (sid,))
            for sid in self.modificaciones_creadas:
                cur.execute(
                    "delete from public.solicitudes_modificacion_pps where id = %s", (sid,)
                )
            for pid in self.practicas_creadas:
                cur.execute("delete from public.practicas where id = %s", (pid,))


# ── Motor de competencia ────────────────────────────────────────────────────

def competir(arnes: Arnes, tabla: str, solicitud_id: str, op_a, op_b) -> tuple:
    """Garantiza que B compita de verdad contra A.

    A abre transaccion y toma el lock de la fila. B llama su operacion y deberia
    quedar esperando. Recien cuando se comprueba que B esta bloqueada, A hace lo
    suyo y commitea; entonces B sigue y se captura su resultado.

    Devuelve (resultado_a, resultado_b, hubo_bloqueo). Cada resultado es
    ("ok", valor) o ("error", sqlstate, mensaje).
    """
    conn_a = arnes.conectar()
    conn_b = arnes.conectar()
    caja_b: dict = {}
    arrancó_b = threading.Event()

    def correr_b():
        arrancó_b.set()
        try:
            with conn_b.cursor() as cur:
                caja_b["valor"] = ("ok", op_b(cur))
        except psycopg.Error as exc:
            caja_b["valor"] = ("error", exc.sqlstate, str(exc).strip().splitlines()[0])

    try:
        conn_a.autocommit = False
        with conn_a.cursor() as cur_a:
            cur_a.execute(
                f"select id from public.{tabla} where id = %s for update", (solicitud_id,)
            )

            hilo = threading.Thread(target=correr_b, daemon=True)
            hilo.start()
            arrancó_b.wait(timeout=5)
            time.sleep(ESPERA_BLOQUEO)

            # Si B ya contesto, nunca compitio: el escenario no prueba nada.
            hubo_bloqueo = "valor" not in caja_b

            try:
                resultado_a = ("ok", op_a(cur_a))
            except psycopg.Error as exc:
                resultado_a = ("error", exc.sqlstate, str(exc).strip().splitlines()[0])
        conn_a.commit()

        hilo.join(timeout=TIMEOUT_MS / 1000 + 5)
        return resultado_a, caja_b.get("valor", ("error", None, "B nunca termino")), hubo_bloqueo
    finally:
        try:
            conn_a.rollback()
        except psycopg.Error:
            pass
        conn_a.close()
        conn_b.close()


def leer(arnes: Arnes, sql: str, params: tuple = ()):
    with psycopg.connect(arnes.dsn, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


# ── Escenarios ──────────────────────────────────────────────────────────────

def _aprobar_nueva(horas: int):
    def op(cur):
        cur.execute(
            "select id from public.aprobar_solicitud_nueva_pps(%s, %s, %s)",
            (op.solicitud, horas, "arnes de concurrencia"),
        )
        return str(cur.fetchone()[0])

    return op


def escenario_dos_aprobaciones_iguales(arnes: Arnes) -> Resultado:
    sid = arnes.nueva_solicitud()
    a, b = _aprobar_nueva(70), _aprobar_nueva(70)
    a.solicitud = b.solicitud = sid

    ra, rb, bloqueo = competir(arnes, "solicitudes_nueva_pps", sid, a, b)
    practicas = leer(
        arnes,
        """
        select count(*) from public.practicas p
        join public.solicitudes_nueva_pps s on s.practica_id = p.id
        where s.id = %s
        """,
        (sid,),
    )[0]

    if not bloqueo:
        return Resultado("dos aprobaciones identicas", "no concluyente",
                         "la segunda no llego a competir")
    if ra[0] != "ok" or rb[0] != "ok":
        return Resultado("dos aprobaciones identicas", "falla",
                         f"una de las dos fallo: A={ra} B={rb}")
    if ra[1] != rb[1]:
        return Resultado("dos aprobaciones identicas", "falla",
                         "devolvieron practicas distintas")
    if practicas != 1:
        return Resultado("dos aprobaciones identicas", "falla",
                         f"quedaron {practicas} practicas, deberia haber 1")
    return Resultado("dos aprobaciones identicas", "ok",
                     "la segunda espero el lock y devolvio la misma practica")


def escenario_aprobaciones_distintas(arnes: Arnes) -> Resultado:
    sid = arnes.nueva_solicitud()
    a, b = _aprobar_nueva(70), _aprobar_nueva(90)
    a.solicitud = b.solicitud = sid

    ra, rb, bloqueo = competir(arnes, "solicitudes_nueva_pps", sid, a, b)
    horas = leer(
        arnes,
        """
        select p.horas_realizadas from public.practicas p
        join public.solicitudes_nueva_pps s on s.practica_id = p.id where s.id = %s
        """,
        (sid,),
    )
    horas = horas[0] if horas else None

    if not bloqueo:
        return Resultado("aprobaciones con decisiones distintas", "no concluyente",
                         "la segunda no llego a competir")
    if ra[0] != "ok":
        return Resultado("aprobaciones con decisiones distintas", "falla",
                         f"la primera fallo: {ra}")
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado("aprobaciones con decisiones distintas", "falla",
                         f"la segunda no informo conflicto: {rb}")
    if horas != 70:
        return Resultado("aprobaciones con decisiones distintas", "falla",
                         f"la practica quedo con {horas} h, deberia ser 70")
    return Resultado("aprobaciones con decisiones distintas", "ok",
                     "gano la primera y la segunda informo conflicto, no exito falso")


def escenario_aprobacion_contra_rechazo(arnes: Arnes) -> Resultado:
    sid = arnes.nueva_solicitud()

    def aprobar(cur):
        cur.execute(
            "select id from public.aprobar_solicitud_nueva_pps(%s, 70, 'arnes')", (sid,)
        )
        return str(cur.fetchone()[0])

    def rechazar(cur):
        cur.execute(
            "select estado from public.rechazar_solicitud_nueva_pps(%s, 'motivo del arnes')",
            (sid,),
        )
        return cur.fetchone()[0]

    ra, rb, bloqueo = competir(arnes, "solicitudes_nueva_pps", sid, aprobar, rechazar)
    estado, practicas = leer(
        arnes,
        """
        select s.estado, (select count(*) from public.practicas p where p.id = s.practica_id)
        from public.solicitudes_nueva_pps s where s.id = %s
        """,
        (sid,),
    )

    if not bloqueo:
        return Resultado("aprobacion contra rechazo", "no concluyente",
                         "el rechazo no llego a competir")
    if ra[0] != "ok":
        return Resultado("aprobacion contra rechazo", "falla", f"la aprobacion fallo: {ra}")
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado("aprobacion contra rechazo", "falla",
                         f"el rechazo piso una solicitud ya aprobada: {rb}")
    if estado != "aprobada" or practicas != 1:
        return Resultado("aprobacion contra rechazo", "falla",
                         f"estado={estado}, practicas={practicas}")
    return Resultado("aprobacion contra rechazo", "ok",
                     "una sola decision final y la practica no quedo huerfana")


def escenario_dos_rechazos(arnes: Arnes) -> Resultado:
    sid = arnes.nueva_solicitud()

    def rechazar(motivo):
        def op(cur):
            cur.execute(
                "select estado from public.rechazar_solicitud_nueva_pps(%s, %s)", (sid, motivo)
            )
            return cur.fetchone()[0]

        return op

    ra, rb, bloqueo = competir(
        arnes, "solicitudes_nueva_pps", sid, rechazar("primero"), rechazar("segundo")
    )
    estado, comentario = leer(
        arnes,
        "select estado, comentario_rechazo from public.solicitudes_nueva_pps where id = %s",
        (sid,),
    )

    if not bloqueo:
        return Resultado("dos rechazos", "no concluyente", "el segundo no llego a competir")
    if ra[0] != "ok" or rb[0] != "error" or rb[1] != "P0001":
        return Resultado("dos rechazos", "falla", f"A={ra} B={rb}")
    if estado != "rechazada" or comentario != "primero":
        return Resultado("dos rechazos", "falla",
                         f"el segundo motivo piso al primero: {comentario!r}")
    return Resultado("dos rechazos", "ok", "quedo el motivo del primero, sin pisarse")


def escenario_bajas_concurrentes(arnes: Arnes) -> Resultado:
    sid = arnes.nueva_modificacion("eliminacion")

    def resolver(decision, comentario):
        def op(cur):
            cur.execute(
                "select estado from public.resolver_solicitud_baja_pps_v1(%s, %s, %s, %s, %s)",
                (sid, decision, None, "arnes", comentario),
            )
            return cur.fetchone()[0]

        return op

    ra, rb, bloqueo = competir(
        arnes,
        "solicitudes_modificacion_pps",
        sid,
        resolver("rechazar", "primero"),
        resolver("rechazar", "segundo"),
    )
    estado = leer(
        arnes, "select estado from public.solicitudes_modificacion_pps where id = %s", (sid,)
    )[0]

    if not bloqueo:
        return Resultado("bajas concurrentes", "no concluyente", "la segunda no compitio")
    if ra[0] != "ok":
        return Resultado("bajas concurrentes", "falla", f"la primera fallo: {ra}")
    if rb[0] != "error":
        return Resultado("bajas concurrentes", "falla",
                         "la segunda resolvio una baja ya resuelta")
    if estado != "rechazada":
        return Resultado("bajas concurrentes", "falla", f"estado final inesperado: {estado}")
    return Resultado("bajas concurrentes", "ok", "una sola resolucion")


def escenario_dos_solicitudes_misma_practica(arnes: Arnes) -> Resultado:
    """Caso distinto de la idempotencia: DOS solicitudes distintas sobre la misma
    practica. Hoy no hay contrato definido —no existe control de version— asi que
    esto no afirma que este bien ni mal: observa y reporta que pasa, para que
    coordinacion decida si la segunda debe detectar una decision ya aplicada.
    """
    sid_a = arnes.nueva_modificacion("horas")
    sid_b = arnes.nueva_modificacion("horas")

    def aprobar(sid, horas):
        def op(cur):
            cur.execute(
                "select estado from public.aprobar_solicitud_modificacion_pps(%s, %s, 'arnes')",
                (sid, horas),
            )
            return cur.fetchone()[0]

        return op

    ra, rb, bloqueo = competir(
        arnes, "solicitudes_modificacion_pps", sid_a, aprobar(sid_a, 100), aprobar(sid_b, 120)
    )
    horas = leer(
        arnes, "select horas_realizadas from public.practicas where id = %s", (arnes.practica_id,)
    )[0]

    return Resultado(
        "dos solicitudes distintas sobre la misma practica",
        "observado",
        f"A={ra[0]} B={rb[0]} · la practica quedo en {horas} h. "
        f"{'Compitieron.' if bloqueo else 'No compitieron por el mismo lock (son filas distintas).'} "
        "Sin contrato definido: decidir si la segunda debe ver la decision previa.",
    )


ESCENARIOS = [
    escenario_dos_aprobaciones_iguales,
    escenario_aprobaciones_distintas,
    escenario_aprobacion_contra_rechazo,
    escenario_dos_rechazos,
    escenario_bajas_concurrentes,
    escenario_dos_solicitudes_misma_practica,
]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dsn", default=os.environ.get("SUPABASE_DB_URL"),
                   help="Cadena de conexion. Por defecto, SUPABASE_DB_URL.")
    p.add_argument("--confirmo-entorno-de-prueba", action="store_true",
                   help="Requerido: el arnes escribe filas sinteticas en la base.")
    args = p.parse_args()

    if not args.dsn:
        sys.exit("Falta la cadena de conexion (--dsn o SUPABASE_DB_URL).\n"
                 "No esta en el .env del repo: se saca del dashboard de Supabase, "
                 "en Project Settings > Database.")
    if not args.confirmo_entorno_de_prueba:
        sys.exit("Este arnes ESCRIBE en la base (crea solicitudes sinteticas, las "
                 "resuelve y las borra).\nCorrelo contra un entorno de prueba y "
                 "volve a pasar --confirmo-entorno-de-prueba.")

    arnes = Arnes(dsn=args.dsn)
    arnes.preparar()

    resultados: list[Resultado] = []
    try:
        for escenario in ESCENARIOS:
            try:
                resultados.append(escenario(arnes))
            except Exception as exc:  # noqa: BLE001
                resultados.append(Resultado(escenario.__name__, "falla", repr(exc)))
    finally:
        arnes.limpiar()

    print()
    sello = {"ok": "OK        ", "falla": "FALLA     ",
             "no concluyente": "NO CONCL. ", "observado": "OBSERVADO "}
    for r in resultados:
        print(f"  {sello.get(r.estado, r.estado)} {r.nombre}")
        if r.detalle:
            print(f"             {r.detalle}")

    fallas = [r for r in resultados if r.estado == "falla"]
    dudosos = [r for r in resultados if r.estado == "no concluyente"]
    print()
    print(f"  {len(resultados)} escenarios · {len(fallas)} fallas · {len(dudosos)} no concluyentes")
    print()

    # Un "no concluyente" no es un aprobado: significa que no se llego a competir.
    sys.exit(1 if fallas or dudosos else 0)


if __name__ == "__main__":
    main()
