# Guia de gestion admin

## Proposito

Esta guia resume el uso operativo del panel admin desde la perspectiva de coordinacion diaria. No describe toda la arquitectura, sino la logica de trabajo esperada.

## Que resuelve el panel

El panel admin centraliza tareas de PPS como:

- seguimiento de instituciones y lanzamientos;
- seleccion de estudiantes;
- gestion de solicitudes;
- seguimiento de practicas;
- correccion de informes;
- herramientas operativas adicionales como backups, automatizaciones y reportes.

## Logica de trabajo

### 1. Detectar pendientes

El dashboard deberia ayudarte a identificar rapidamente:

- que esta vencido;
- que esta demorado;
- que requiere decision;
- que puede escalar a problema operativo si no se atiende.

### 2. Gestionar por excepcion

La forma mas util de usar el panel no es recorrer modulos porque si, sino entrar por pendientes reales:

- instituciones sin relanzamiento;
- conversaciones abiertas sin movimiento;
- solicitudes que esperan validacion;
- informes y cierres pendientes.

### 3. Dejar rastro

Cuando un flujo tiene notas, historial o cambio de estado, conviene registrar la accion para que el sistema no dependa de memoria personal.

## Criterios practicos

### Estados y notas

- usar cambios de estado de forma consistente;
- agregar notas cuando una decision o contacto necesite contexto futuro;
- evitar que informacion critica quede solo en WhatsApp o memoria informal.

### Solicitudes y acreditaciones

No todas las solicitudes tienen la misma urgencia. La prioridad real suele estar en:

- PPS nuevas por aprobar;
- acreditaciones pendientes de intervencion humana;
- correcciones o modificaciones que bloquean avance.

### Gestion con instituciones

El panel puede convivir con contacto externo por WhatsApp, mail o llamada, pero el criterio importante es que el avance relevante quede reflejado en el sistema.

## Limites de esta guia

- el panel sigue evolucionando;
- algunos nombres visuales o indicadores pueden cambiar;
- para prioridades estructurales del modulo admin, usar tambien el plan maestro:
  [docs/internal-professionalization-plan.md](./docs/internal-professionalization-plan.md)
