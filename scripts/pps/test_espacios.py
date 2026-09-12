#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Pruebas de la paginacion de `Panel.get`.

PostgREST corta cada respuesta en `max-rows` y no avisa, asi que el helper
pagina solo. Esa logica es facil de romper en silencio —un offset que se pisa,
un orden que empata— y el sintoma no es un error sino una lectura incompleta,
que es justo lo que no se nota. Por eso se prueba sin red: `PanelFalso` sirve
filas de una tabla en memoria y ademas registra que consultas se emitieron.

    python -m unittest discover -s scripts/pps
"""

from __future__ import annotations

import sys
import unittest
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import espacios  # noqa: E402
from espacios import Panel  # noqa: E402


class PanelFalso(Panel):
    """Panel con la red reemplazada por una tabla en memoria."""

    def __init__(self, filas: list[dict], cap: int = espacios.PAGINA,
                 falla_en: int | None = None):
        self.url = "http://test"
        self.key = "test"
        self.filas = filas
        self.cap = cap
        self.falla_en = falla_en
        self.consultas: list[str] = []

    def _req(self, metodo: str, path: str, cuerpo: dict | None = None) -> list[dict]:
        self.consultas.append(path)
        if self.falla_en is not None and len(self.consultas) == self.falla_en:
            raise RuntimeError("se cayo la red en la pagina 2")

        q = dict(urllib.parse.parse_qsl(path.partition("?")[2]))
        filas = list(self.filas)
        if q.get("order"):
            for campo in reversed(q["order"].split(",")):
                nombre, _, direccion = campo.partition(".")
                filas.sort(key=lambda f: f[nombre], reverse=(direccion == "desc"))
        desde = int(q.get("offset", 0))
        cuantas = min(int(q.get("limit", self.cap)), self.cap)
        return filas[desde:desde + cuantas]

    def orden_emitido(self) -> str | None:
        ultima = dict(urllib.parse.parse_qsl(self.consultas[-1].partition("?")[2]))
        return ultima.get("order")


def tabla(n: int, timestamp=lambda i: i) -> list[dict]:
    return [{"id": f"{i:06d}", "timestamp": timestamp(i)} for i in range(n)]


class TestPaginacion(unittest.TestCase):
    def test_consulta_chica_no_pagina(self):
        """Si entra en una pagina, se devuelve tal cual y con una sola consulta."""
        panel = PanelFalso(tabla(10))
        self.assertEqual(len(panel.get("t?select=id")), 10)
        self.assertEqual(panel.consultas, ["t?select=id"])

    def test_trae_todas_las_filas(self):
        panel = PanelFalso(tabla(2500))
        filas = panel.get("t?select=id")
        self.assertEqual(len(filas), 2500)
        self.assertEqual(len({f["id"] for f in filas}), 2500, "hubo saltos o repetidos")

    def test_limit_es_tope(self):
        panel = PanelFalso(tabla(2500))
        self.assertEqual(len(panel.get("t?select=id&limit=1200")), 1200)

    def test_respeta_offset(self):
        """El offset de quien llama es el punto de partida, no se pisa."""
        panel = PanelFalso(tabla(2500))
        filas = panel.get("t?select=id&offset=200&limit=1000")
        self.assertEqual(len(filas), 1000)
        self.assertEqual(filas[0]["id"], "000200")

    def test_offset_con_paginacion(self):
        panel = PanelFalso(tabla(2500))
        filas = panel.get("t?select=id&offset=1500")
        self.assertEqual([f["id"] for f in filas], [f["id"] for f in tabla(2500)[1500:]])

    def test_agrega_desempate_a_orden_ambiguo(self):
        """Ordenar solo por fecha no define un orden total: el corte entre
        paginas queda al azar y una fila puede repetirse o perderse."""
        panel = PanelFalso(tabla(2500, timestamp=lambda i: i // 10))
        filas = panel.get("t?select=id&order=timestamp.desc")
        self.assertEqual(panel.orden_emitido(), "timestamp.desc,id")
        self.assertEqual(len({f["id"] for f in filas}), 2500)

    def test_no_duplica_el_desempate(self):
        panel = PanelFalso(tabla(2500))
        panel.get("t?select=id&order=id.desc")
        self.assertEqual(panel.orden_emitido(), "id.desc")

    def test_sin_orden_ordena_por_id(self):
        panel = PanelFalso(tabla(2500))
        panel.get("t?select=id")
        self.assertEqual(panel.orden_emitido(), "id")

    def test_falla_de_pagina_no_devuelve_resultado_parcial(self):
        """Preferible que explote a que devuelva media tabla como si fuera toda."""
        panel = PanelFalso(tabla(2500), falla_en=3)
        with self.assertRaises(RuntimeError):
            panel.get("t?select=id")

    def test_preserva_filtros_al_paginar(self):
        panel = PanelFalso(tabla(2500))
        panel.get("t?select=id,timestamp&estado=eq.pendiente")
        ultima = dict(urllib.parse.parse_qsl(panel.consultas[-1].partition("?")[2]))
        self.assertEqual(ultima["estado"], "eq.pendiente")
        self.assertEqual(ultima["select"], "id,timestamp")


if __name__ == "__main__":
    unittest.main()
