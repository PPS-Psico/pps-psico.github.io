# 🚀 INSTRUCCIONES PARA PROBAR MONITORING

## 🌐 ACCESO A LA APLICACIÓN
**URL ahora:** http://localhost:5176
(El puerto cambió a 5176)

## 🔐 PASO 1: INICIAR SESIÓN
1. Ve a http://localhost:5176
2. Inicia sesión con:
   - **Legajo:** `testing`
   - **Contraseña:** `testing`

## 🛠️ PASO 2: IR A HERRAMIENTAS DE MONITORING
1. Una vez logueado como admin, haz clic en **"Herramientas"**
2. Busca la pestaña **"🆕 MONITORING"** (está al final)
3. Click en **"🆕 MONITORING"**

## 🧪 PASO 3: EJECUTAR PRUEBAS
Dentro de la pestaña Monitoring, haz click en:

### 🚀 **"Run All Tests"**
Esto ejecutará todas las pruebas automáticamente:
- ✅ Test Error Tracking
- ✅ Test Analytics 
- ✅ Test Performance
- ✅ Test API Monitoring
- ✅ Test Web Vitals
- ✅ Test Health Checks

## 📊 PASO 4: VERIFICAR EN GOOGLE ANALYTICS

### Método 1: Real-time (Recomendado)
1. Abre otra pestaña: https://analytics.google.com
2. Ve a tu propiedad **"PPS UFLO"**
3. En el menú izquierdo, haz clic en **"Real-time"**
4. Deberías ver eventos apareciendo cuando ejecutes las pruebas

### Método 2: DebugView
1. En Google Analytics, ve a **Admin → DebugView**
2. Pega esta URL para debugear:
   ```
   https://pps-psico.github.io/consulta-pps-uflo/?firebase_debug_mode=true
   ```

## 🔍 PASO 5: VERIFICAR EN CONSOLA

Abre la consola del navegador (F12) y deberías ver:
```
🧪 Monitoring Test Component Loaded
📊 Available monitoring functions: {...}
📈 Web Vitals: CLS: 0.023 (good) ✓
⚡ Performance: test_operation took 1001.23ms
🌐 API call: test_api_call took 245.67ms
✅ Error enviado a Sentry
✅ Eventos enviados a GA4
```

## 📋 PASO 6: VERIFICAR EN NETWORK TAB
1. Abre DevTools (F12)
2. Ve a la pestaña **"Network"**
3. Ejecuta las pruebas
4. Busca llamadas a:
   - `google-analytics.com/g/collect` ✅
   - `analytics.google.com` ✅

## 🎯 RESULTADOS ESPERADOS

### ✅ **ÉXITO TOTAL:**
- ✅ Verás logs en consola
- ✅ Verás resultados en UI
- ✅ Verás eventos en Google Analytics Real-time
- ✅ Verás llamadas en Network tab

### ❌ **Si NO funciona:**
1. Revisa que el ID en `.env` sea exactamente: `G-DBTR34692E`
2. Limpia cache del navegador (Ctrl+Shift+R)
3. Espera 2-3 minutos después de ejecutar pruebas
4. Revisa en Google Analytics si está en "Real-time"

## 🆘 SOPORTE RÁPIDO

### Si no ves eventos en GA4 después de 5 minutos:
1. Ve a Google Analytics → Admin → Data Streams
2. Haz clic en tu stream web
3. Revisa que **"Medición mejorada"** esté activada
4. Revisa que no haya advertencias de configuración

### Si la pestaña Monitoring no aparece:
1. Revisa que estés logueado como admin
2. Refresca la página (F5)
3. Limpia cache y vuelve a intentar

---

## 🎯 ¡LISTO PARA PROBAR!

**Acceso:** http://localhost:5176 → Herramientas → 🆕 MONITORING

¡El sistema está completamente configurado con tu Measurement ID real!