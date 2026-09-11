#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
concurrencia_resoluciones.py — Competencia real entre dos conexiones sobre las
RPC de resolucion de solicitudes de PPS.

Por que existe: el FOR UPDATE de las RPC es lo unico que impide que un doble clic
acredite dos veces. Eso no se puede observar desde una sola conexion —las
llamadas salen una despues de la otra y nunca compiten—, asi que era la ultima
propiedad del sistema afirmada y no demostrada.

Como fuerza la competencia:

  · A abre una transaccion y llama a la RPC SIN confirmar. La RPC toma sus
    bloqueos de fila y los retiene mientras la transaccion siga abierta.
  · B llama a la suya y queda esperando esos bloqueos.
  · El arnes NO deduce el bloqueo de un tiempo sin respuesta: lo comprueba con
    pg_blocking_pids(pid_b), que tiene que contener el pid de A. Si no lo logra
    dentro del plazo, el escenario es NO CONCLUYENTE, no un aprobado.
  · Recien entonces A confirma y B sigue. Se captura lo que le paso a B.

No usa SELECT ... FOR UPDATE desde el arnes: ese comando exige privilegio UPDATE
y `authenticated` no lo tiene sobre estas tablas —se le revoco a proposito para
que la resolucion solo se escriba por RPC—. Tomar el bloqueo desde adentro de la
RPC, que es SECURITY DEFINER, es ademas mas fiel a lo que pasa en produccion.

ESCRIBE EN LA BASE. Todo lo que crea es sintetico y propio (institucion,
estudiante, practica, solicitudes), marcado con un id de corrida para poder
barrer residuos si el proceso muere. No toca ningun dato real. Aun asi exige
--confirmo-entorno-de-prueba.

Uso:
    export SUPABASE_DB_URL='postgresql://postgres:...@...:5432/postgres'
    python scripts/pps/concurrencia_resoluciones.py --confirmo-entorno-de-prueba

La cadena de conexion no esta en el .env del repo (ahi solo vive la service role
key, que va por PostgREST y no sirve para abrir dos sesiones). Sale del dashboard
de Supabase, en Project Settings > Database.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field

try:
    import psycopg
except ImportError:
    sys.exit("Falta psycopg: pip install 'psycopg[binary]'")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Plazo para demostrar que B quedo esperando un bloqueo de A.
PLAZO_BLOQUEO = 5.0
# Tope duro de cada sentencia: si algo se traba, el arnes falla en vez de colgarse.
TIMEOUT_MS = 15_000


@dataclass
class Resultado:
    nombre: str
    estado: str  # ok | falla | no concluyente | observado
    detalle: str = ""


def _error(exc: psycopg.Error) -> tuple:
    return ("error", exc.sqlstate, str(exc).strip().splitlines()[0])


@dataclass
class Arnes:
    dsn: str
    corrida: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    admin_uid: str = ""
    estudiante_id: str = ""
    institucion_id: str = ""
    practica_id: str = ""

    def marca(self) -> str:
        return f"[arnes {self.corrida}]"

    # ── Conexiones ──────────────────────────────────────────────────────────
    def conectar(self, como_admin: bool = True) -> psycopg.Connection:
        """Sesion equivalente a la del navegador: rol authenticated y JWT simulado.
        Con el rol de servicio is_admin() no pasa y las RPC rechazan todo."""
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

    def servicio(self) -> psycopg.Connection:
        """Conexion sin cambiar de rol: fixtures, limpieza y observacion de locks."""
        return psycopg.connect(self.dsn, autocommit=True)

    # ── Fixtures, todos propios ─────────────────────────────────────────────
    def preparar(self) -> None:
        with self.servicio() as conn, conn.cursor() as cur:
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
                "insert into public.instituciones (nombre) values (%s) returning id",
                (f"Institucion sintetica {self.marca()}",),
            )
            self.institucion_id = str(cur.fetchone()[0])

            # Estudiante sintetico, sin user_id: nunca es una persona real.
            cur.execute(
                """
                insert into public.estudiantes (nombre, legajo, correo)
                values (%s, %s, %s) returning id
                """,
                (
                    f"Estudiante sintetico {self.marca()}",
                    f"ARNES{self.corrida}",
                    f"arnes-{self.corrida}@ejemplo.invalido",
                ),
            )
            self.estudiante_id = str(cur.fetchone()[0])

            cur.execute(
                """
                insert into public.practicas
                  (estudiante_id, institucion_id, especialidad, fecha_inicio,
                   fecha_finalizacion, horas_realizadas, estado, nombre_institucion)
                values (%s, %s, 'Clinica', '2026-01-01', '2026-02-01', 80,
                        'Finalizada', %s)
                returning id
                """,
                (self.estudiante_id, self.institucion_id, f"Practica sintetica {self.marca()}"),
            )
            self.practica_id = str(cur.fetchone()[0])

    def verificar_identidad(self) -> None:
        """Sin esto, un fallo de autenticacion se veria como seis escenarios
        rotos con 42501 y el diagnostico seria confuso."""
        conn = self.conectar()
        try:
            with conn.cursor() as cur:
                cur.execute("select current_user, auth.uid()::text, public.is_admin()")
                usuario, uid, es_admin = cur.fetchone()
            if usuario != "authenticated":
                sys.exit(f"La sesion no corre como authenticated sino como {usuario}.")
            if uid != self.admin_uid:
                sys.exit(f"auth.uid() devolvio {uid}, se esperaba {self.admin_uid}.")
            if not es_admin:
                sys.exit("is_admin() es falso: el JWT simulado no esta siendo reconocido.")
        finally:
            conn.close()

    # ── Estado observable ───────────────────────────────────────────────────
    def practicas_del_alumno(self) -> list[tuple]:
        """Todas las practicas del estudiante sintetico. Como es propio, cualquier
        practica que aparezca la creo este arnes: una segunda practica creada y
        abandonada fuera del vinculo con la solicitud tambien se ve aca."""
        with self.servicio() as conn, conn.cursor() as cur:
            cur.execute(
                """
                select p.id::text, p.horas_realizadas, p.estado,
                       (select count(*) from public.solicitudes_nueva_pps s
                        where s.practica_id = p.id)
                from public.practicas p
                where p.estudiante_id = %s
                order by p.created_at
                """,
                (self.estudiante_id,),
            )
            return cur.fetchall()

    def nueva_solicitud(self) -> str:
        with self.servicio() as conn, conn.cursor() as cur:
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
            return str(cur.fetchone()[0])

    def nueva_modificacion(self, tipo: str = "horas", practica_id: str | None = None) -> str:
        practica_id = practica_id or self.practica_id
        with self.servicio() as conn, conn.cursor() as cur:
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
                    (self.estudiante_id, practica_id),
                )
            else:
                cur.execute(
                    """
                    insert into public.solicitudes_modificacion_pps
                      (estudiante_id, practica_id, tipo_modificacion, horas_nuevas, estado)
                    values (%s, %s, 'horas', 90, 'pendiente')
                    returning id
                    """,
                    (self.estudiante_id, practica_id),
                )
            return str(cur.fetchone()[0])

    def limpiar(self) -> None:
        """Borra por estudiante e institucion sinteticos, no por ids acumulados:
        si el proceso murio en el medio, esto barre igual lo que haya quedado."""
        with self.servicio() as conn, conn.cursor() as cur:
            if not self.estudiante_id:
                if self.institucion_id:
                    cur.execute("delete from public.instituciones where id = %s", (self.institucion_id,))
                return
            cur.execute(
                "delete from public.solicitudes_nueva_pps where estudiante_id = %s",
                (self.estudiante_id,),
            )
            cur.execute(
                "delete from public.solicitudes_modificacion_pps where estudiante_id = %s",
                (self.estudiante_id,),
            )
            cur.execute("delete from public.practicas where estudiante_id = %s", (self.estudiante_id,))
            # La aprobacion de una baja crea una penalizacion, y penalizaciones
            # tiene una FK NO ACTION hacia estudiantes: sin esto el borrado del
            # estudiante sintetico falla y queda residuo.
            cur.execute(
                "delete from public.penalizaciones where estudiante_id = %s", (self.estudiante_id,)
            )
            cur.execute(
                "delete from public.convocatorias where estudiante_id = %s", (self.estudiante_id,)
            )
            cur.execute("delete from public.estudiantes where id = %s", (self.estudiante_id,))
            cur.execute(
                "delete from public.lanzamientos_pps where institucion_uuid = %s",
                (self.institucion_id,),
            )
            cur.execute("delete from public.instituciones where id = %s", (self.institucion_id,))


# ── Motor de competencia ────────────────────────────────────────────────────

def _pid(conn: psycopg.Connection) -> int:
    with conn.cursor() as cur:
        cur.execute("select pg_backend_pid()")
        return int(cur.fetchone()[0])


def competir(arnes: Arnes, op_a, op_b) -> tuple:
    """A retiene los bloqueos de su RPC con la transaccion abierta; B compite.

    El bloqueo se demuestra con pg_blocking_pids, no con un tiempo de espera.
    Devuelve (resultado_a, resultado_b, demostrado).
    """
    conn_a = arnes.conectar()
    conn_b = arnes.conectar()
    vigia = arnes.servicio()
    caja_b: dict = {}
    arranco_b = threading.Event()

    def correr_b():
        arranco_b.set()
        try:
            with conn_b.cursor() as cur:
                caja_b["valor"] = ("ok", op_b(cur))
        except psycopg.Error as exc:
            caja_b["valor"] = _error(exc)

    try:
        pid_a, pid_b = _pid(conn_a), _pid(conn_b)
        conn_a.autocommit = False
        demostrado = False

        with conn_a.cursor() as cur_a:
            try:
                resultado_a = ("ok", op_a(cur_a))
            except psycopg.Error as exc:
                conn_a.rollback()
                return _error(exc), ("error", None, "A fallo: B no llego a correr"), False

            # A ya aplico su resolucion y retiene los locks: la transaccion sigue abierta.
            hilo = threading.Thread(target=correr_b, daemon=True)
            hilo.start()
            arranco_b.wait(timeout=5)

            limite = time.monotonic() + PLAZO_BLOQUEO
            while time.monotonic() < limite:
                if "valor" in caja_b:
                    break  # B contesto sin esperar: no hubo competencia
                with vigia.cursor() as cur_v:
                    cur_v.execute("select pg_blocking_pids(%s)", (pid_b,))
                    bloqueantes = cur_v.fetchone()[0] or []
                if pid_a in bloqueantes:
                    demostrado = True
                    break
                time.sleep(0.05)

        conn_a.commit()
        hilo.join(timeout=TIMEOUT_MS / 1000 + 5)
        return resultado_a, caja_b.get("valor", ("error", None, "B nunca termino")), demostrado
    finally:
        try:
            conn_a.rollback()
        except psycopg.Error:
            pass
        conn_a.close()
        conn_b.close()
        vigia.close()


def leer(arnes: Arnes, sql: str, params: tuple = ()):
    with arnes.servicio() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def _sin_competencia(nombre: str) -> Resultado:
    return Resultado(nombre, "no concluyente",
                     "no se pudo demostrar con pg_blocking_pids que B esperara a A")


# ── Escenarios ──────────────────────────────────────────────────────────────

def _op_aprobar_nueva(sid: str, horas: int):
    def op(cur):
        cur.execute(
            "select id from public.aprobar_solicitud_nueva_pps(%s, %s, 'arnes')", (sid, horas)
        )
        return str(cur.fetchone()[0])

    return op


def _op_rechazar_nueva(sid: str, motivo: str):
    def op(cur):
        cur.execute(
            "select estado from public.rechazar_solicitud_nueva_pps(%s, %s)", (sid, motivo)
        )
        return cur.fetchone()[0]

    return op


def _op_aprobar_mod(sid: str, horas: int, horas_vistas=None):
    """`horas_vistas` son las que mostraba la pantalla al abrir la solicitud.
    Cuando se mandan, la RPC rechaza con 45001 si la practica cambio desde
    entonces, en vez de pisar una decision tomada desde otra pantalla."""

    def op(cur):
        cur.execute(
            "select estado from public.aprobar_solicitud_modificacion_pps(%s, %s, 'arnes', %s)",
            (sid, horas, horas_vistas),
        )
        return cur.fetchone()[0]

    return op


def _op_resolver_baja(sid: str, decision: str, tipo, comentario):
    def op(cur):
        cur.execute(
            "select estado from public.resolver_solicitud_baja_pps_v1(%s, %s, %s, 'arnes', %s)",
            (sid, decision, tipo, comentario),
        )
        return cur.fetchone()[0]

    return op


def escenario_aprobaciones_iguales(arnes: Arnes) -> Resultado:
    nombre = "dos aprobaciones identicas"
    antes = {p[0] for p in arnes.practicas_del_alumno()}
    sid = arnes.nueva_solicitud()

    ra, rb, ok = competir(arnes, _op_aprobar_nueva(sid, 70), _op_aprobar_nueva(sid, 70))
    if not ok:
        return _sin_competencia(nombre)

    nuevas = [p for p in arnes.practicas_del_alumno() if p[0] not in antes]
    if ra[0] != "ok" or rb[0] != "ok":
        return Resultado(nombre, "falla", f"A={ra} B={rb}")
    if ra[1] != rb[1]:
        return Resultado(nombre, "falla", "devolvieron practicas distintas")
    if len(nuevas) != 1:
        return Resultado(nombre, "falla",
                         f"se crearon {len(nuevas)} practicas: {nuevas}")
    pid_, horas, estado, vinculos = nuevas[0]
    if horas != 70 or estado != "Finalizada" or vinculos != 1:
        return Resultado(nombre, "falla",
                         f"practica en {horas} h, estado {estado}, {vinculos} vinculos")
    return Resultado(nombre, "ok",
                     "B espero el lock y devolvio la misma practica; una sola creada")


def escenario_aprobaciones_distintas(arnes: Arnes) -> Resultado:
    nombre = "aprobaciones con decisiones distintas"
    antes = {p[0] for p in arnes.practicas_del_alumno()}
    sid = arnes.nueva_solicitud()

    ra, rb, ok = competir(arnes, _op_aprobar_nueva(sid, 70), _op_aprobar_nueva(sid, 90))
    if not ok:
        return _sin_competencia(nombre)

    nuevas = [p for p in arnes.practicas_del_alumno() if p[0] not in antes]
    if ra[0] != "ok":
        return Resultado(nombre, "falla", f"la primera fallo: {ra}")
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado(nombre, "falla", f"la segunda no informo conflicto: {rb}")
    if len(nuevas) != 1 or nuevas[0][1] != 70:
        return Resultado(nombre, "falla", f"practicas resultantes: {nuevas}")
    return Resultado(nombre, "ok",
                     "gano la primera, la segunda dio conflicto y no quedo practica de mas")


def escenario_aprobacion_contra_rechazo(arnes: Arnes) -> Resultado:
    nombre = "aprobacion contra rechazo"
    antes = {p[0] for p in arnes.practicas_del_alumno()}
    sid = arnes.nueva_solicitud()

    ra, rb, ok = competir(
        arnes, _op_aprobar_nueva(sid, 70), _op_rechazar_nueva(sid, "motivo del arnes")
    )
    if not ok:
        return _sin_competencia(nombre)

    estado, practica_vinculada = leer(
        arnes,
        "select estado, practica_id::text from public.solicitudes_nueva_pps where id = %s",
        (sid,),
    )
    nuevas = [p for p in arnes.practicas_del_alumno() if p[0] not in antes]
    if ra[0] != "ok":
        return Resultado(nombre, "falla", f"la aprobacion fallo: {ra}")
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado(nombre, "falla", f"el rechazo piso una aprobacion: {rb}")
    if estado != "aprobada" or len(nuevas) != 1 or practica_vinculada != nuevas[0][0]:
        return Resultado(nombre, "falla",
                         f"estado={estado}, practicas={nuevas}, vinculo={practica_vinculada}")
    return Resultado(nombre, "ok", "una sola decision final, sin practica huerfana")


def escenario_dos_rechazos(arnes: Arnes) -> Resultado:
    nombre = "dos rechazos"
    sid = arnes.nueva_solicitud()

    ra, rb, ok = competir(
        arnes, _op_rechazar_nueva(sid, "primero"), _op_rechazar_nueva(sid, "segundo")
    )
    if not ok:
        return _sin_competencia(nombre)

    estado, comentario = leer(
        arnes,
        "select estado, comentario_rechazo from public.solicitudes_nueva_pps where id = %s",
        (sid,),
    )
    if ra[0] != "ok" or rb[0] != "error" or rb[1] != "P0001":
        return Resultado(nombre, "falla", f"A={ra} B={rb}")
    if estado != "rechazada" or comentario != "primero":
        return Resultado(nombre, "falla", f"el motivo quedo en {comentario!r}")
    return Resultado(nombre, "ok", "quedo el motivo del primero, sin pisarse")


def escenario_dos_resoluciones_misma_modificacion(arnes: Arnes) -> Resultado:
    nombre = "dos resoluciones sobre la misma solicitud de horas"
    sid = arnes.nueva_modificacion("horas")
    horas_previas = leer(
        arnes, "select horas_realizadas from public.practicas where id = %s", (arnes.practica_id,)
    )[0]

    ra, rb, ok = competir(arnes, _op_aprobar_mod(sid, 100), _op_aprobar_mod(sid, 120))
    if not ok:
        return _sin_competencia(nombre)

    horas, aprobadas = leer(
        arnes,
        """
        select p.horas_realizadas, s.horas_aprobadas
        from public.practicas p
        join public.solicitudes_modificacion_pps s on s.practica_id = p.id
        where s.id = %s
        """,
        (sid,),
    )
    if ra[0] != "ok":
        return Resultado(nombre, "falla", f"la primera fallo: {ra}")
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado(nombre, "falla", f"la segunda no informo conflicto: {rb}")
    if horas != 100 or aprobadas != 100:
        return Resultado(nombre, "falla",
                         f"practica en {horas} h (venia de {horas_previas}), decision {aprobadas}")
    return Resultado(nombre, "ok", "se aplico una sola decision y quedo registrada")


def escenario_bajas_concurrentes_aprobando(arnes: Arnes) -> Resultado:
    nombre = "dos aprobaciones de la misma baja"
    # La baja exige En curso y elimina la práctica. Usar una propia evita
    # invalidar la precondición y destruir la que usan los otros escenarios.
    practica_baja = leer(
        arnes,
        """
        insert into public.practicas
          (estudiante_id, institucion_id, especialidad, estado, horas_realizadas, nombre_institucion)
        values (%s, %s, 'Clinica', 'En curso', 80, %s) returning id::text
        """,
        (arnes.estudiante_id, arnes.institucion_id, f"Baja sintetica {arnes.marca()}"),
    )[0]
    sid = arnes.nueva_modificacion("eliminacion", practica_id=practica_baja)

    ra, rb, ok = competir(
        arnes,
        _op_resolver_baja(sid, "aprobar", "Baja Administrativa / Sin Penalización", None),
        _op_resolver_baja(sid, "aprobar", "Abandono durante la PPS", None),
    )
    if ra[0] != "ok":
        return Resultado(nombre, "falla", f"la primera fallo antes de competir: {ra}")
    if not ok:
        return _sin_competencia(nombre)

    estado, penalizaciones = leer(
        arnes,
        """
        select s.estado,
               (select count(*) from public.penalizaciones pe
                 where pe.estudiante_id = s.estudiante_id)
        from public.solicitudes_modificacion_pps s where s.id = %s
        """,
        (sid,),
    )
    if rb[0] != "error" or rb[1] != "P0001":
        return Resultado(nombre, "falla", "la segunda resolvio una baja ya resuelta")
    if estado != "aprobada" or penalizaciones != 1:
        return Resultado(nombre, "falla",
                         f"estado={estado}, penalizaciones={penalizaciones} (deberia ser 1)")
    if leer(arnes, "select count(*) from public.practicas where id = %s", (practica_baja,))[0] != 0:
        return Resultado(nombre, "falla", "la baja no eliminó su práctica")
    return Resultado(nombre, "ok", "una sola baja y una sola penalizacion")


def escenario_dos_solicitudes_misma_practica(arnes: Arnes) -> Resultado:
    """Caso distinto de la idempotencia: DOS solicitudes distintas sobre la misma
    practica. Compiten por el lock de la practica, no por el de la solicitud.

    Las dos aprobaciones salen de pantallas que veian las mismas horas. La
    segunda tiene que avisar (45001) en vez de pisar a la primera en silencio, y
    la practica tiene que quedar con la decision de la primera.
    """
    nombre = "dos solicitudes distintas sobre la misma practica"
    sid_a = arnes.nueva_modificacion("horas")
    sid_b = arnes.nueva_modificacion("horas")
    vistas = leer(
        arnes, "select horas_realizadas from public.practicas where id = %s", (arnes.practica_id,)
    )[0]

    ra, rb, ok = competir(
        arnes,
        _op_aprobar_mod(sid_a, 100, int(vistas)),
        _op_aprobar_mod(sid_b, 120, int(vistas)),
    )
    if not ok:
        return _sin_competencia(nombre)

    horas = leer(
        arnes, "select horas_realizadas from public.practicas where id = %s", (arnes.practica_id,)
    )[0]
    if ra[0] != "ok":
        return Resultado(nombre, "falla", f"la primera fallo: {ra}")
    if rb[0] != "error" or rb[1] != "45001":
        return Resultado(nombre, "falla",
                         f"la segunda piso a la primera sin avisar: {rb}")
    if horas != 100:
        return Resultado(nombre, "falla",
                         f"la practica quedo en {horas} h, deberia tener la decision de la primera")
    return Resultado(nombre, "ok",
                     "la segunda aviso que la practica habia cambiado y no la piso")


ESCENARIOS = [
    escenario_aprobaciones_iguales,
    escenario_aprobaciones_distintas,
    escenario_aprobacion_contra_rechazo,
    escenario_dos_rechazos,
    escenario_dos_resoluciones_misma_modificacion,
    escenario_bajas_concurrentes_aprobando,
    escenario_dos_solicitudes_misma_practica,
]


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--dsn", default=os.environ.get("SUPABASE_DB_URL"),
                   help="Cadena de conexion. Por defecto, SUPABASE_DB_URL.")
    p.add_argument("--confirmo-entorno-de-prueba", action="store_true",
                   help="Requerido: el arnes escribe filas sinteticas en la base.")
    args = p.parse_args()

    if not args.dsn:
        sys.exit("Falta la cadena de conexion (--dsn o SUPABASE_DB_URL).\n"
                 "No esta en el .env del repo: sale del dashboard de Supabase, "
                 "en Project Settings > Database.")
    if not args.confirmo_entorno_de_prueba:
        sys.exit("Este arnes ESCRIBE en la base (crea una institucion, un estudiante, "
                 "una practica y solicitudes sinteticas, los resuelve y los borra).\n"
                 "Correlo contra un entorno de prueba y volve a pasar "
                 "--confirmo-entorno-de-prueba.")

    arnes = Arnes(dsn=args.dsn)
    print(f"\n  corrida {arnes.corrida}")
    resultados: list[Resultado] = []
    try:
        arnes.preparar()
        arnes.verificar_identidad()
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
    print(f"  {len(resultados)} escenarios · {len(fallas)} fallas · "
          f"{len(dudosos)} no concluyentes")
    print()

    # Un "no concluyente" no es un aprobado: significa que no se llego a competir.
    sys.exit(1 if fallas or dudosos else 0)


if __name__ == "__main__":
    main()
