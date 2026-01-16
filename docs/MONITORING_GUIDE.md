# 📊 Monitoring y Analytics para Consulta PPS UFLO

Esta guía explica cómo configurar y utilizar el sistema de monitoring y analytics implementado en la aplicación.

## 🎯 ¿Qué está implementado?

### **1. Error Tracking (Sentry)**
- Captura automática de errores de JavaScript
- Monitoreo de performance
- Contexto del usuario en errores
- Filtrado de errores no críticos

### **2. User Analytics (Google Analytics 4)**
- Seguimiento de páginas vistas
- Eventos académicos personalizados
- Métricas de conversión
- Dimensiones personalizadas para UFLO

### **3. Performance Monitoring (Web Vitals)**
- Core Web Vitals (CLS, INP, FCP, LCP, TTFB)
- Monitoreo de rendimiento de componentes
- Seguimiento de llamadas API
- Métricas personalizadas

### **4. Health Checks**
- Verificación de estado de servicios
- Monitoreo de base de datos
- Estado de autenticación
- Métricas del sistema en tiempo real

### **5. Dashboard Académico**
- Métricas de estudiantes y prácticas
- KPIs de rendimiento
- Actividad en tiempo real
- Datos de conversión

## 🚀 Configuración Inicial

### **1. Configurar Sentry**

1. Crear cuenta en [Sentry.io](https://sentry.io)
2. Crear nuevo proyecto React
3. Copiar el DSN (Data Source Name)
4. Agregar al archivo `.env`:

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### **2. Configurar Google Analytics 4**

1. Ir a [Google Analytics](https://analytics.google.com)
2. Crear nueva propiedad GA4
3. Crear Web Stream
4. Copiar Measurement ID
5. Agregar al archivo `.env`:

```bash
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

### **3. Copiar archivo de variables de entorno**

```bash
cp .env.example .env
# Editar .env con tus valores reales
```

## 📈 Uso del Sistema

### **Tracking de Errores**

```typescript
import { trackError, trackMessage } from '../lib/sentry';

// Trackear error con contexto
trackError(error, {
  component: 'StudentDashboard',
  action: 'loadStudentData',
  userId: '12345'
});

// Trackear mensaje personalizado
trackMessage('Operación completada exitosamente', 'info');
```

### **Analytics de Eventos**

```typescript
import { trackAcademicEvents } from '../lib/analytics';

// Eventos académicos
trackAcademicEvents.studentRegistration({
  legajo: '12345',
  orientation: 'Psicología Clínica'
});

trackAcademicEvents.practiceSubmission({
  hours: 120,
  institution: 'Hospital Italiano',
  type: 'Clínica'
});

// Eventos de usuario
trackAcademicEvents.featureUsed('dashboard_view', 'student');
```

### **Performance Monitoring**

```typescript
import { 
  measurePerformance, 
  monitorAPICall, 
  withPerformanceMonitoring 
} from '../lib/webVitals';

// Medir operación
const result = await measurePerformance('loadStudents', async () => {
  return await fetchStudents();
});

// Monitorear API
const data = await monitorAPICall(
  () => api.getStudents(), 
  'getStudents'
);

// Componente con monitoring
const MonitoredComponent = withPerformanceMonitoring(
  MyComponent, 
  'MyComponent'
);
```

### **Health Checks**

```typescript
import { useHealthMonitor } from '../lib/healthCheck';

const MyComponent = () => {
  const { 
    health, 
    metrics, 
    runHealthCheck,
    startMonitoring 
  } = useHealthMonitor();

  useEffect(() => {
    startMonitoring();
  }, []);

  return (
    <div>
      <div>Estado: {health.status}</div>
      <button onClick={runHealthCheck}>
        Verificar Salud
      </button>
    </div>
  );
};
```

## 🎛️ Dashboard Académico

Para ver el dashboard académico:

```typescript
import AcademicDashboard from '../components/AcademicDashboard';

// En tu routing o componente
<AcademicDashboard />
```

El dashboard muestra:
- Total de estudiantes y prácticas activas
- Tasa de finalización y tiempo de respuesta
- Métricas de performance y Web Vitals
- Actividad reciente del sistema

## 📊 Métricas Disponibles

### **Core Web Vitals**
- **CLS**: Cumulative Layout Shift (estabilidad visual)
- **INP**: Interaction to Next Paint (responsividad)
- **FCP**: First Contentful Paint (carga inicial)
- **LCP**: Largest Contentful Paint (carga principal)
- **TTFB**: Time to First Byte (respuesta del servidor)

### **KPIs Académicos**
- **Total Estudiantes**: Número de estudiantes registrados
- **Prácticas Activas**: Prácticas en curso
- **Tasa Finalización**: Porcentaje de prácticas completadas
- **Tiempo Respuesta**: Tiempo de respuesta del sistema
- **Engagement**: Nivel de participación de usuarios
- **Tasa Conversión**: Éxito en procesos académicos

## 🔔 Alertas y Notificaciones

### **Alertas Automáticas**
- Errores críticos se envían a Sentry
- Performance pobre se registra automáticamente
- Health checks fallidos generan warnings
- Tasa de errores alta dispara alertas

### ** umbrales configurados**
- **API Response**: > 2 segundos = warning
- **Web Vitals Poor**: < 50 puntos = critical
- **Error Rate**: > 5% = critical
- **Health Check**: > 2 servicios caídos = warning

## 🛠️ Configuración Avanzada

### **Variables de Entorno Adicionales**

```bash
# Versión de la aplicación
VITE_APP_VERSION=1.0.0

# Habilitar monitoring en desarrollo
VITE_ENABLE_MONITORING_IN_DEV=false

# Nivel de log de Sentry
VITE_SENTRY_DEBUG=false
```

### **Feature Flags**

```typescript
import { FEATURES } from '../constants/monitoringConstants';

if (FEATURES.ERROR_TRACKING) {
  // Código específico para error tracking
}

if (FEATURES.ANALYTICS) {
  // Código específico para analytics
}
```

## 📱 Testing en Desarrollo

### **Desactivar Monitoring Local**

```bash
# En development, el monitoring está desactivado por defecto
# Para activarlo en dev:
VITE_ENABLE_MONITORING_IN_DEV=true
```

### **Simulación de Datos**

El dashboard incluye datos simulados para desarrollo:
- Métricas académicas generadas aleatoriamente
- Web Vitals simulados
- Activity feed con eventos de ejemplo

## 🔍 Debug y Troubleshooting

### **Ver Logs de Monitoring**

```javascript
// En consola del navegador
console.log('Web Vitals Data:', window.getWebVitalsData?.());
console.log('Sentry Context:', window.Sentry?.getCurrentHub?.());
```

### **Verificar Integración**

1. **Sentry**: Buscar "Sentry" en consola
2. **GA4**: Revisar Network tab por llamadas a google-analytics
3. **Web Vitals**: Ver métricas en console.log
4. **Health**: Verificar estado en HealthCheckDisplay

### **Problemas Comunes**

**Sentry no funciona:**
- Verificar DSN correcto
- Confirmar VITE_SENTRY_DSN en .env
- Revisar que sea producción

**GA4 no registra:**
- Verificar Measurement ID
- Confirmar VITE_GA4_MEASUREMENT_ID
- Revisar ad-blocker

**Web Vitals no aparecen:**
- Esperar a que cargue la página completamente
- Verificar que sea producción
- Revisar consola por errores

## 📚 Recursos Adicionales

- [Sentry Documentation](https://docs.sentry.io/)
- [Google Analytics 4](https://support.google.com/analytics/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Performance Monitoring](https://web.dev/performance/)

## 🤝 Soporte

Para problemas o preguntas:
1. Revisar consola del navegador
2. Verificar variables de entorno
3. Consultar logs de Sentry
4. Revisar esta documentación

---

**Nota**: Este sistema de monitoring está diseñado para ser no intrusivo y no afectar el rendimiento de la aplicación en producción.