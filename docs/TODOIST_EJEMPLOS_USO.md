# 📱 Integración Todoist - Ejemplos Visuales

## 🎯 Flujo de Uso Completo

### Paso 1: Confirmar Lanzamiento (Desktop)

**En el sistema de gestión:**

```
Institución: Clínica Demo - Sede A
Estado: Pendiente de Gestión → Relanzamiento Confirmado
Fecha de relanzamiento: 15/03/2026
```

**Al hacer clic en "Guardar":**

```
✅ Guardado correctamente.
✅ Tarea creada en Todoist 📱
```

### Paso 2: Recibir Notificación (Celular)

**En tu celular, verás:**

```
📱 Notificación de Todoist
━━━━━━━━━━━━━━━━━━━━━━
📌 Tarea para hoy
Lanzar Clínica Demo - Sede A
Vence en 1 día

[Ver tarea →] [Posponer →]
```

### Paso 3: Ver Detalles en Todoist (Celular)

**Abriendo la tarea:**

```
┌─────────────────────────────────┐
│  Lanzar Clínica Demo - Sede A   │
├─────────────────────────────────┤
│  📅 Vence: Mar 15, 2026        │
│  🏷️ Convocatoria, Lanzamiento     │
│  ⭐ Prioridad: Media              │
├─────────────────────────────────┤
│  📝 Descripción:                 │
│                                   │
│  🎓 Orientación: Clínica         │
│  👥 Cupos: 5                     │
│  ⏰ Horario: Lunes 14hs          │
│  📱 WhatsApp: +54911123456       │
│                                   │
│  💬 Comentarios:                  │
│  [Agregar comentario...]            │
├─────────────────────────────────┤
│  [✓ Completar]  [📅 Posponer]   │
│  [✏️ Editar]    [🗑️ Eliminar]    │
└─────────────────────────────────┘
```

## 🔁 Escenarios de Uso

### Escenario 1: Lanzamiento Próximo (Urgente)

**En el sistema:**

- Fecha de lanzamiento: 2026-03-15
- Fecha actual: 2026-03-14

**En Todoist:**

```
⚠️ Tarea vence HOY
━━━━━━━━━━━━━━━━━━━━━━
📌 Lanzar Clínica Demo - Sede A
¡Vence en menos de 24 horas!

Prioridad: 🔴 URGENTE (Nivel 4)
```

### Escenario 2: Múltiples Lanzamientos

**Sistema:** Confirmas 5 lanzamientos en un día

**Todoist:** Se crean 5 tareas con el mismo formato

```
📋 Tareas de lanzamiento (5 nuevas)

1. Lanzar Clínica Demo - Sede A
2. Lanzar Hospital Modelo - Taller B
3. Lanzar Escuela Primaria - Centro
4. Lanzar CAPS - Sede Norte
5. Lanzar Jardín Maternal - Sur

Ordenar por:
📅 Fecha de vencimiento
⭐ Prioridad
🏷️ Etiqueta
```

### Escenario 3: Gestión de Contactos

**En el sistema:**

- Institución: "Hospital Modelo"
- Estado: "Por Contactar"
- Click en "Contactar" → WhatsApp → Estado: "Esperando Respuesta"

**Opción A:** Crear tarea de seguimiento manual

```
📌 Tarea creada manualmente:
"Seguimiento: Hospital Modelo"
Etiqueta: Gestión
Descripción: Contactado por WhatsApp el 15/02/2026
Estado: Esperando respuesta
```

### Escenario 4: Lanzamiento Finalizado

**En el sistema:**

- Completas el lanzamiento (los estudiantes están en práctica)

**En Todoist (futuro):**

```
✅ Marcar como completada
───────────────────────────
La tarea "Lanzar Clínica Demo - Sede A"
se marca automáticamente como completada

📊 Se podría crear siguiente tarea:
"Evaluación: Clínica Demo - Sede A"
Fecha: 30 días después del lanzamiento
```

## 🎨 Visualización de Etiquetas en Todoist

**Etiquetas creadas automáticamente:**

| Etiqueta        | Color    | Uso                           |
| --------------- | -------- | ----------------------------- |
| 🔴 Convocatoria | Rojo     | Tareas de lanzamiento de PPS  |
| 🟡 Gestión      | Amarillo | Contacto con instituciones    |
| 🟢 Lanzamiento  | Verde    | Todas las tareas relacionadas |
| 🔵 Urgente      | Azul     | Lanzamientos prioritarios     |

**Filtro rápido en Todoist:**

```
Mostrar solo:
☑️ Etiqueta "Convocatoria"
☑️ Etiqueta "Lanzamiento"
☑️ Prioridad alta (3-4)
☑️ Vencen esta semana
```

## 📅 Ejemplo de Semana de Trabajo

### Lunes:

```
📱 Lunes por la mañana:
   [ ] Lanzar Clínica Demo - Sede A  (HOY)
   [ ] Lanzar Hospital Modelo - Taller B  (HOY + 2 días)
   [ ] Lanzar Escuela Primaria - Centro  (HOY + 5 días)

📱 Lunes por la tarde:
   [ ] Lanzar Clínica Demo - Sede A  ✓ Completado
   [ ] Seguimiento: Institución X
   [ ] Preparar materiales Institución Y
```

### Martes:

```
📱 Martes:
   [ ] Lanzar Hospital Modelo - Taller B  (MAÑANA)
   [ ] Revisión: Clínica Demo - Sede A  ✓
   [ ] Coordinar con tutores Institución Z
```

## 🔄 Ciclo de Vida de una Tarea

```
┌─────────────────────────────────────┐
│  1️⃣ Creación Automática           │
│     Sistema → Todoist              │
│     "Lanzar Institución X"        │
├─────────────────────────────────────┤
│  2️⃣ Recordatorios                │
│     Notificación 7 días antes      │
│     Notificación 1 día antes       │
│     Notificación el mismo día       │
├─────────────────────────────────────┤
│  3️⃣ Acción                         │
│     Preparas desde el celular       │
│     Marcas como completada          │
├─────────────────────────────────────┤
│  4️⃣ Siguiente (opcional)          │
│     "Evaluación: Institución X"    │
│     O seguimiento post-lanzamiento │
└─────────────────────────────────────┘
```

## 💡 Tips para Máxima Productividad

### Desde el sistema (Desktop):

1. **Confirma varios lanzamientos de una vez**
   → Se crean todas las tareas automáticamente

2. **Usa notas internas relevantes**
   → Se agregan como descripción en Todoist

3. **Establece prioridades visuales**
   → Lanzamientos urgentes (menos de 30 días)
   → Lanzamientos normales (más de 30 días)

### Desde el celular (Todoist):

1. **Configura notificaciones**
   - Recordatorio 1 día antes (9:00 AM)
   - Recordatorio el mismo día (8:00 AM)

2. **Usa el widget de Today**
   - Vista rápida de lanzamientos del día
   - Swipe rápido para completar

3. **Agrega comentarios**
   - "Confirmado con institución por teléfono"
   - "Se necesita enviar seguro"

4. **Filtra por etiquetas**
   - #Convocatoria → Solo lanzamientos
   - #Gestión → Solo seguimientos
   - #Urgente → Solo prioridades

## 🎯 Resumen del Flujo

```
┌─────────────────────────────────────────────────┐
│  SISTEMA DE GESTIÓN (Desktop)           │
│                                         │
│  • Confirmar lanzamiento                  │
│  • Establecer fecha                       │
│  • Agregar horarios/cupos                │
│              │                           │
│              ▼                           │
│  INTEGRACIÓN AUTOMÁTICA                   │
│  • Crea tarea en Todoist              │
│  • Formato estándar                     │
│  • Etiquetas automáticas                 │
│              │                           │
│              ▼                           │
│  TODOIST (Celular)                      │
│                                         │
│  • Recibes notificación                │
│  • Ves detalles completos                │
│  • Marcas como completada                │
│  • Agregas comentarios                 │
│                                         │
└─────────────────────────────────────────────────┘
```

## ✅ Beneficios

✅ **Todo centralizado** - Lanzamientos, gestión y vida personal
✅ **Acceso móvil** - Gestiona desde cualquier lugar
✅ **Recordatorios automáticos** - Nunca olvides un lanzamiento
✅ **Organización visual** - Etiquetas y colores claros
✅ **Colaboración** - Comparte proyectos con otros coordinadores
✅ **Historial** - Ve todos los lanzamientos pasados
✅ **Flexibilidad** - Reprograma fechas fácilmente
✅ **Offline** - Trabaja sin conexión
✅ **Sincronización** - Cambios en tiempo real
