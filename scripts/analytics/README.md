# Utilidades de reconstrucción analítica

## WhatsApp PPS 2024

El parser lee una exportación de WhatsApp sin copiar el archivo fuente al
repositorio. Soporta mensajes multilínea y marcas Unicode invisibles presentes en
algunos encabezados.

```powershell
node .\scripts\analytics\parse-whatsapp-pps-history.mjs `
  --input 'C:\ruta\_chat.txt' `
  --year 2024 `
  --candidate-out '.\scratch\whatsapp-pps-2024-candidate-messages.csv' `
  --message-out '.\scratch\whatsapp-pps-2024-all-messages.csv' `
  --message-json-out '.\scratch\whatsapp-pps-2024-all-messages.json'
```

Los archivos de trabajo deben permanecer en `scratch/`, que está ignorado por
Git. El parser reemplaza teléfonos, correos y URLs, y usa un hash irreversible
para el remitente. La matriz publicada en `docs/analytics/reconstruction/` no
incluye remitentes ni texto conversacional completo.

La conciliación preliminar usa extractos sin datos personales y consultas
agregadas de Supabase guardadas temporalmente:

```powershell
node .\scripts\analytics\reconcile-whatsapp-pps-2024.mjs `
  --messages '.\scratch\whatsapp-pps-2024-all-messages.json' `
  --launches '.\scratch\db-2024-launches.json' `
  --institutions '.\scratch\db-institutions.json' `
  --out '.\scratch\whatsapp-pps-2024-preliminary-matches.csv'
```

La coincidencia automática sólo propone candidatos. Las decisiones finales están
curadas en
`docs/analytics/reconstruction/whatsapp_2024_launch_candidates.csv` y requieren
revisión humana cuando el estado no es inequívoco.
