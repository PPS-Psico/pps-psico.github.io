# 🔧 Configuración de Todoist MCP - Guía de Solución

## ⚠️ Problema Identificado

Al intentar usar las funciones de Todoist MCP, recibimos:

```
Error: Request failed with status code 404
```

Esto indica que el servidor MCP no está configurado correctamente o no tiene las credenciales necesarias.

## 🎯 Pasos para Configurar Correctamente

### Paso 1: Obtener Token de Acceso de Todoist

1. Ve a https://app.todoist.com/prefs/integrations
2. Desplázate hacia abajo hasta encontrar "Developer / API tokens"
3. Crea un nuevo token con los siguientes permisos:
   - ✅ `data:read` - Leer tareas, proyectos, etiquetas
   - ✅ `data:read_write` - Leer y escribir tareas, proyectos, etiquetas
   - ✅ `data:delete` - Eliminar tareas (opcional)

4. Copia el token generado (empieza con `0123456789...`)

### Paso 2: Configurar el Servidor MCP en tu Cliente AI

La configuración depende del cliente que estés usando:

#### **Si usas Claude Desktop/Web:**

1. Crea o edita el archivo `claude_desktop_config.json`
2. Agrega o actualiza esta sección:

```json
{
  "mcpServers": {
    "todoist": {
      "transport": "sse",
      "url": "https://ai.todoist.net/mcp",
      "headers": {
        "Authorization": "Bearer TU_TOKEN_AQUI"
      }
    }
  }
}
```

**IMPORTANTE:** Reemplaza `TU_TOKEN_AQUI` con el token que copiaste en el Paso 1.

#### **Si usas Cursor:**

Crea el archivo `~/.cursor/mcp.json` o `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ai.todoist.net/mcp"],
      "env": {
        "TODOIST_TOKEN": "TU_TOKEN_AQUI"
      }
    }
  }
}
```

**IMPORTANTE:** Reemplaza `TU_TOKEN_AQUI` con el token que copiaste en el Paso 1.

#### **Si usás VS Code:**

1. Abre Command Palette (Cmd/Ctrl + Shift + P)
2. Escribe: `MCP: Add Server`
3. Selecciona "Type: HTTP"
4. En URL, pon: `https://ai.todoist.net/mcp`
5. En Headers (opcional), agrega:
   ```
   Authorization: Bearer TU_TOKEN_AQUI
   ```
6. Dale un nombre (ej: `todoist-production`)
7. Guarda

### Paso 3: Verificar la Configuración

Para verificar que funciona correctamente, ejecuta este comando en tu terminal:

```bash
npx -y @modelcontextprotocol/create-server@latest
```

O simplemente intenta crear una tarea desde este chat usando las herramientas de Todoist MCP disponibles.

## 🔧 Implementación en el Código

Una vez configurado el MCP, el código ya está listo para usarlo:

### Archivo: `src/hooks/useTodoistIntegration.ts`

Este hook ya tiene la lógica implementada para:

1. **Detectar cuando crear tarea:**
   - Cuando el estado cambia a "Relanzamiento Confirmado"
   - Cuando se establece una fecha de relanzamiento

2. **Formatear la tarea correctamente:**
   - Título: `Lanzar Nombre de la PPS`
   - Etiquetas: `Convocatoria`, `Lanzamiento`
   - Prioridad dinámica según fecha
   - Descripción con orientación, cupos, horarios, WhatsApp

3. **Crear la tarea en Todoist MCP:**
   - Llama a la función de crear tarea
   - Maneja errores correctamente

### Integración en GestionCard

Una vez que el MCP funcione, en `src/components/admin/GestionCard.tsx`:

```typescript
import { useTodoistIntegration } from "../../hooks/useTodoistIntegration";

// Dentro del componente
const { handleGestionChange, createManualTodoistTask } = useTodoistIntegration({
  onToast: setToastInfo,
});

// En handleSave, antes de llamar a onSave
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

## 📱 Flujo Completo de Trabajo

```
1️⃣ Confirmas lanzamiento (Desktop)
   ↓
2️⃣ Se crea tarea automáticamente en Todoist
   ↓
3️⃣ Recibes notificación en celular (1 día antes)
   ↓
4️⃣ Ves la tarea con todos los detalles
   ↓
5️⃣ Marcas como completada cuando haces el lanzamiento
```

## 🔍 Troubleshooting

### Si sigue sin funcionar:

1. **Verificar que el token es correcto:**
   - El token debe empezar con `0123456789...`
   - No debe estar expirado

2. **Verificar los permisos:**
   - El token debe tener `data:read_write`
   - Sin permisos de escritura no se pueden crear tareas

3. **Reiniciar el cliente AI:**
   - Cierra Claude/Cursor completamente
   - Ábrelo de nuevo
   - Intenta usar las herramientas de Todoist

4. **Verificar la conexión:**
   - Ejecuta: `curl https://ai.todoist.net/mcp`
   - Debería recibir un JSON con el servidor disponible

## 📊 Prueba de la Integración

Para probar que funciona, intenta crear una tarea de prueba:

Desde este chat, pregunta: "Crear una tarea de prueba en Todoist con el título 'Tarea de prueba - Integración MCP'"

Si se crea correctamente, la integración está funcionando. Si recibes un error, revisa los pasos de configuración.

## 🎉 Qué Deberías Ver

Una vez configurado correctamente:

✅ Las herramientas de Todoist MCP estarán disponibles
✅ Podrás crear tareas automáticamente
✅ Las tareas aparecerán en tu celular
✅ Recibirás notificaciones automáticas
✅ La integración con la gestión de lanzamientos funcionará

## 📚 Referencias

- Documentación de Todoist MCP: https://developer.todoist.com/api/v1/#tag/Todoist-MCP
- Documentación de API REST de Todoist: https://developer.todoist.com/api/v1/
- Tutorial de configuración: https://developer.todoist.com/api/v1/#tag/Todoist-MCP/Setup-guide

## ⚠️ Nota Importante

El servidor MCP de Todoist (`https://ai.todoist.net/mcp`) solo funciona si:

1. Está configurado correctamente en tu cliente AI
2. Tiene un token válido con los permisos correctos
3. La conexión a internet es estable

Sin estos tres requisitos, las herramientas no funcionarán.
