# 📋 Integración de Todoist con Gestión de Lanzamientos

## 🎯 Objetivo

Crear tareas automáticamente en Todoist cuando se confirman lanzamientos, permitiéndote gestionar todo desde tu celular.

## ✨ Posibilidades de Integración

### 1. **Creación Automática de Tareas** ✅

**Cuándo se crea la tarea:**

- Estado cambia a "Relanzamiento Confirmado"
- Se establece una fecha de relanzamiento

**Formato de la tarea:**

```
Título: Lanzar Clínica Demo - Sede A
Etiquetas: Convocatoria, Lanzamiento
Prioridad: 2 (Media)
Fecha: 2026-03-15
```

**Descripción automática:**

```
🎓 Orientación: Clinica
👥 Cupos: 5
⏰ Horario: Lunes 14hs
📱 WhatsApp: +54911123456
```

### 2. **Creación Manual** 📝

Botón adicional en la tarjeta de gestión:

- "Crear tarea en Todoist"
- Útil para cuando quieres crear la tarea antes de confirmar

### 3. **Etiquetas Inteligentes** 🏷️

Sistema de etiquetas organizado:

- `Convocatoria` - Todas las tareas de lanzamiento
- `Gestión` - Tareas de contacto con instituciones
- `Urgente` - Lanzamientos de última hora
- `Lanzamiento` - Tareas relacionadas con lanzamientos

### 4. **Prioridades Dinámicas** 📊

Prioridad según urgencia:

- **Nivel 4 (Urgente):** Lanzamiento en menos de 7 días
- **Nivel 3 (Alta):** Lanzamiento en menos de 30 días
- **Nivel 2 (Media):** Lanzamientos futuros
- **Nivel 1 (Normal):** Lanzamientos sin fecha definida

### 5. **Fechas en Formato Natural** 📅

Todoist soporta múltiples formatos de fecha:

- `2026-03-15` (ISO)
- `15/03/2026` (Latino)
- `next Friday` (Inglés natural)
- `tomorrow`, `next Monday`

## 🔧 Implementación Requerida

### Estado Actual:

- ✅ Servicios creados (`todoistService.ts`, `useTodoistIntegration.ts`)
- ✅ Lógica de negocio implementada
- ❌ Todoist MCP no configurado correctamente (error 404)

### Pasos para completar la integración:

#### Paso 1: Configurar Todoist MCP

El servicio Todoist MCP necesita ser configurado en el servidor. Verificar:

- Token de acceso de Todoist
- Endpoint correcto de la API
- Permisos necesarios

#### Paso 2: Integrar hook en GestionCard

```typescript
// En src/components/admin/GestionCard.tsx
import { useTodoistIntegration } from "../../hooks/useTodoistIntegration";

// Dentro del componente
const { handleGestionChange, createManualTodoistTask } = useTodoistIntegration({
  onToast: setToastInfo,
});

// En handleSave, antes de llamar a onSave:
await handleGestionChange(
  pps,
  {
    [FIELD_ESTADO_GESTION_LANZAMIENTOS]: originalStatus,
    [FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]: originalDate,
  },
  {
    [FIELD_ESTADO_GESTION_LANZAMIENTOS]: status,
    [FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]: relaunchDate,
  }
);
```

#### Paso 3: Agregar botón manual (opcional)

```typescript
// Botón en el header de la tarjeta
{status === "Relanzamiento Confirmado" && relaunchDate && (
  <button
    onClick={() => createManualTodoistTask(pps)}
    className="text-xs text-blue-600 hover:underline"
    title="Crear tarea en Todoist"
  >
    Crear tarea en Todoist
  </button>
)}
```

## 📱 Beneficios del Flujo Integrado

### Para ti como Coordinador:

1. **Todo unificado:** Lanzamientos, gestión de contactos, tareas personales
2. **Recordatorios automáticos:** Notificaciones en el celular
3. **Visibilidad rápida:** Ver lanzamientos pendientes desde cualquier lugar
4. **Priorización clara:** Etiquetas y prioridades visuales

### Flujo de trabajo típico:

```
1. Confirmas lanzamiento en el sistema (desktop)
   ↓
2. Se crea automáticamente tarea en Todoist (celular)
   ↓
3. Recibes notificación un día antes
   ↓
4. Preparas materiales desde el celular
   ↓
5. Realizas el lanzamiento
   ↓
6. Marcas tarea como completada en Todoist
```

## 🔄 Actualizaciones Bidireccionales (Futuro)

Posibles mejoras adicionales:

1. **Marcar como completada desde el sistema:**
   - Si completas el lanzamiento, marcar la tarea en Todoist
   - Mantener sincronización bidireccional

2. **Comentarios de Todoist:**
   - Ver notas que agregues a la tarea desde tu celular
   - Sincronizar con notas de gestión del sistema

3. **Proyectos de Todoist:**
   - Crear proyecto "Lanzamientos 2026"
   - Agrupar tareas por año o período

## 🚀 Próximos Pasos Recomendados

1. **Configurar Todoist MCP** para que el servicio funcione
2. **Probar la integración** con un lanzamiento de prueba
3. **Validar que las tareas se creen correctamente** con formato esperado
4. **Ajustar prioridades y etiquetas** según tus preferencias
5. **Documentar el flujo** para otros coordinadores (si aplica)

## 📊 Ejemplo Completo de Tarea

### Antes:

```json
{
  "estado_gestion": "Relanzamiento Confirmado",
  "fecha_relanzamiento": "2026-03-15",
  "nombre_pps": "Clínica Demo - Sede A",
  "orientacion": "Clinica",
  "cupos_disponibles": 5,
  "horario_seleccionado": "Lunes 14hs"
}
```

### Después (en Todoist):

```
📌 Lanzar Clínica Demo - Sede A
   📅 Vence: 15/03/2026
   🏷️ Convocatoria, Lanzamiento
   ⭐ Prioridad: Media

   📝 Descripción:
   🎓 Orientación: Clinica
   👥 Cupos: 5
   ⏰ Horario: Lunes 14hs
   📱 WhatsApp: +54911123456
```

## 💡 Tips de Uso

1. **Colores de etiquetas en Todoist:**
   - Convocatoria → Rojo (urgente)
   - Lanzamiento → Azul (proceso)
   - Gestión → Amarillo (en curso)

2. **Recordatorios personalizados:**
   - Agregar recordatorio 1 día antes del lanzamiento
   - Agregar recordatorio 1 semana antes para preparación

3. **Filtros en Todoist:**
   - Ver solo tareas de "Convocatoria" hoy
   - Ver lanzamientos de esta semana
   - Ver todas las tareas pendientes

## 🎉 Conclusión

La integración con Todoist te permitirá:

- ✅ Tener todos tus lanzamientos visibles en el celular
- ✅ Recibir recordatorios automáticos
- ✅ Gestionar tareas desde cualquier lugar
- ✅ Mantener un flujo de trabajo unificado

Solo requiere configurar el servicio Todoist MCP para funcionar completamente.
