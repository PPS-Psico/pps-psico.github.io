#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Pruebas de la referencia de la convocatoria en la capa 1.

Lo que se cuida acá no es la aritmética sino cuánta certeza afirma el informe.
La solicitud de alta no guarda de qué convocatoria salió, así que lo que se
encuentra cruzando institución y fechas es una *candidata*: presentarla como un
hecho hace que una diferencia de horas parezca demostrada cuando no lo está.

Los casos existen porque cada uno se rompió de una forma distinta:
  · una candidata sin horas se descartaba antes de contar, y dos candidatas
    aparecían como una sola referencia segura;
  · una coincidencia única se informaba como "pide de más", sin más;
  · en una modificación, la falta de referencia no decía nada, y quedarse
    callado se lee igual que una comparación hecha.

    python -m unittest discover -s scripts/pps
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from correcciones import (  # noqa: E402
    Hallazgo,
    referencia_de_la_practica,
    referencia_por_lanzamiento,
)

INST = "inst-1"


def lanzamiento(nombre: str, horas, ini="2026-04-01", fin="2026-08-01", id_="lz-1") -> dict:
    return {
        "id": id_,
        "nombre_pps": nombre,
        "institucion_uuid": INST,
        "horas_acreditadas": horas,
        "fecha_inicio": ini,
        "fecha_finalizacion": fin,
    }


def titulos(out: list[Hallazgo]) -> str:
    return " | ".join(h.titulo for h in out)


class TestReferenciaDeAlta(unittest.TestCase):
    """Cruce por institución y fechas: siempre candidata, nunca certeza."""

    def referencia(self, lanzamientos, pedidas=80):
        out: list[Hallazgo] = []
        referencia_por_lanzamiento(lanzamientos, INST, "2026-04-29", "2026-08-12",
                                   pedidas, out)
        return out

    def test_sin_candidatas_lo_dice(self):
        out = self.referencia([lanzamiento("Otra época", 70, "2023-01-01", "2023-05-01")])
        self.assertIn("Sin convocatoria que coincida", titulos(out))

    def test_candidata_unica_no_se_presenta_como_certeza(self):
        out = self.referencia([lanzamiento("Ministerio", 70)])
        self.assertEqual(len(out), 1)
        self.assertIn("Posible convocatoria", out[0].titulo)
        # Pide más, pero el informe no puede afirmar que sea de esa convocatoria.
        self.assertIn("no está confirmado", out[0].detalle)
        self.assertEqual(out[0].nivel, "atencion")

    def test_pedir_menos_que_la_candidata_no_es_atencion(self):
        out = self.referencia([lanzamiento("Ministerio", 70)], pedidas=65)
        self.assertEqual(out[0].nivel, "dato")

    def test_varias_candidatas_no_elige_ninguna(self):
        out = self.referencia([
            lanzamiento("Barriletes 2026", 173, id_="lz-1"),
            lanzamiento("Barriletes verano", 60, id_="lz-2"),
        ])
        self.assertIn("Más de una convocatoria coincide", titulos(out))
        self.assertIn("173", out[0].detalle)
        self.assertIn("60", out[0].detalle)
        self.assertEqual(out[0].nivel, "atencion")

    def test_una_candidata_sin_horas_no_desaparece(self):
        """Era el agujero: filtrar las que no tienen horas antes de contar hacía
        que esto se informara como una referencia segura de 70."""
        out = self.referencia([
            lanzamiento("Con horas", 70, id_="lz-1"),
            lanzamiento("Sin horas", None, id_="lz-2"),
        ])
        self.assertIn("Más de una convocatoria coincide", titulos(out))
        self.assertIn("sin horas cargadas", out[0].detalle)

    def test_candidata_unica_sin_horas_avisa_que_no_hay_con_que_comparar(self):
        out = self.referencia([lanzamiento("Sin horas", None)])
        self.assertIn("no tiene horas cargadas", titulos(out))
        self.assertEqual(out[0].nivel, "atencion")

    def test_sin_institucion_no_inventa_nada(self):
        out: list[Hallazgo] = []
        referencia_por_lanzamiento([lanzamiento("Ministerio", 70)], None,
                                   "2026-04-29", "2026-08-12", 80, out)
        self.assertEqual(out, [])


class TestReferenciaDeModificacion(unittest.TestCase):
    """Acá la práctica guarda su lanzamiento_id: la referencia es exacta, y
    cuando falta hay que decirlo en vez de callar."""

    def referencia(self, lanzamientos, practica, pedidas=100):
        out: list[Hallazgo] = []
        referencia_de_la_practica(lanzamientos, practica, pedidas, out)
        return out

    def test_vinculo_confirmado_compara_exacto(self):
        out = self.referencia([lanzamiento("Barriletes", 80)], {"lanzamiento_id": "lz-1"})
        self.assertEqual(out[0].titulo, "Referencia de la convocatoria")
        self.assertIn("80 h", out[0].detalle)
        self.assertIn("(+20)", out[0].detalle)
        self.assertEqual(out[0].nivel, "atencion")

    def test_practica_sin_lanzamiento_lo_dice(self):
        out = self.referencia([lanzamiento("Barriletes", 80)], {"lanzamiento_id": None})
        self.assertIn("Sin convocatoria vinculada", titulos(out))

    def test_lanzamiento_que_no_aparece_lo_dice(self):
        out = self.referencia([lanzamiento("Barriletes", 80)], {"lanzamiento_id": "lz-9"})
        self.assertIn("No se encontró la convocatoria vinculada", titulos(out))
        self.assertEqual(out[0].nivel, "atencion")

    def test_lanzamiento_sin_horas_lo_dice(self):
        out = self.referencia([lanzamiento("Barriletes", None)], {"lanzamiento_id": "lz-1"})
        self.assertIn("no tiene horas cargadas", titulos(out))
        self.assertEqual(out[0].nivel, "atencion")


if __name__ == "__main__":
    unittest.main()
