---
tipo: agent-meta
---

# Decisiones de diseño

Decisiones tomadas durante la construcción del agente que conviene recordar.

## 2026-05-26 — Arquitectura inicial

- Hermes lee desde Supabase, no de Gmail/WhatsApp directo.
- n8n es el único componente con tokens de Gmail y llave de WhatsApp.
- Vault Obsidian vive en el VPS, sincronizado a la compu del usuario por Syncthing.
- Contenedor `hermes-pps` separado del Hermes existente.

## 2026-05-26 — WhatsApp solo lectura vía backups

- Descartadas: Baileys con número personal (riesgo de ban), APKs modificados (malware), API oficial (no backfilea historial).
- Elegida: backup E2E de WhatsApp → desencripción con llave de 64 dígitos del usuario → procesamiento offline.
