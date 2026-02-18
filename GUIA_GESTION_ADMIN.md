# 📘 Guía de Gestión Administrativa - Panel PPS

## 1. El Dashboard de Inicio (Centro de Mando)

El tablero de inicio funciona como un "semáforo" de tareas urgentes. No es solo información visual; cada tarjeta es un filtro inteligente que te lleva a la carga de trabajo real.

### Tarjetas de Operatividad:

- **🔴 Instituciones Vencidas**: Son PPS que terminaron su ciclo (ej: 2025) y no han tenido ninguna gestión de relanzamiento aún. Es la "bandeja de entrada" de lo que falta empezar.
- **🟠 Demoradas**: Son gestiones activas que llevan **más de 2 días sin movimiento**. El sistema detecta esto automáticamente comparando la fecha de hoy con la última nota o cambio de estado que hiciste.
- **🔵 Próximas a Vencer**: Alerta preventiva. Muestra PPS que finalizan en los próximos **5 días**. Sirve para preparar el terreno antes de que pasen a "Vencidas".
- **🟢 Solicitudes Pendientes**: El número "quemante" del día. Suma 3 áreas críticas:
  1.  **PPS Nuevas**: Alumnos que subieron un proyecto y esperan aprobación.
  2.  **Acreditaciones (Egresos)**: Estudiantes que terminaron sus horas. El sistema **ignora automáticamente** las que están "En Proceso SAC", para que solo veas las que tú debes gestionar.
  3.  **Correcciones**: Solicitudes de modificación de proyectos (Solicitudes de Modificación).

---

## 2. El Panel de Gestión (Flujo de Trabajo)

Aquí es donde ocurre la comunicación con las instituciones. Se divide en etapas claras:

1.  **Instituciones Vencidas**: Todo lo que hay que contactar.
2.  **En Gestión**:
    - **Esperando Respuesta**: Ya les escribiste (o usaste el botón de WhatsApp) y estás esperando que te contesten.
    - **En Conversación**: Estás negociando cupos, horarios o detalles de la práctica.
3.  **Confirmadas / Lanzadas**: Ya pasaron por el proceso y están listas o activas para el ciclo actual.

---

## 3. Blindaje de Tiempos (Sistema de Historial)

Una parte crítica del sistema es el **Historial de Gestión**.

### ¿Cómo funciona?

Debido a que los sistemas de base de datos a veces se actualizan solos (por backups o ráfagas técnicas), implementamos un **blindaje manual**:

- Cada vez que cambias un estado o escribes una nota y guardas, se genera una entrada en el historial con fecha (ej: `18/02: Cambio de estado...`).
- **El contador de "Sin Movimiento" siempre prioriza tu historial manual.** Si el historial dice que lo tocaste hace 3 días, dirá "3 d", aunque la base de datos se haya actualizado hoy por un proceso de fondo.

---

## 4. Consejos para el Coordinador

- **WhatsApp Directo**: Usa el botón de chat de la tarjeta para agilizar.
- **Notas Rápidas**: El sistema genera notas automáticas al cambiar estados, pero poner una nota manual (ej: "Hablé con RRHH, llaman el lunes") blinda la fecha de gestión personal.
- **Solicitudes**: Si una acreditación está en estado "En Proceso SAC", el panel la oculta de tus pendientes porque ya no requiere tu intervención.
