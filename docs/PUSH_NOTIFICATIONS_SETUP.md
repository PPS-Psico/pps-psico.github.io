# Notificaciones push

## Estado actual

El proyecto usa una implementacion basada en Firebase Cloud Messaging y un service worker unificado, no una implementacion puramente "web push nativo" como indicaba documentacion vieja.

Piezas observadas en el repo:

- `public/firebase-messaging-sw.js`
- registro del service worker en `src/main.tsx`
- suscripcion y baja desde `src/components/student/ProfileView.tsx`
- funciones auxiliares FCM en `src/lib/fcm`
- almacenamiento de tokens y RPCs asociados del lado Supabase

## Como funciona hoy

### En el frontend

- el service worker registrado es `firebase-messaging-sw.js`;
- el perfil del estudiante permite activar o desactivar notificaciones;
- la UI verifica tanto la suscripcion local como la persistencia del token en base;
- la activacion completa depende de que ambas cosas salgan bien.

### En backend

La documentacion y el repo muestran uso de:

- `send-fcm-notification`
- referencias legacy a `send-push`
- tablas o funciones relacionadas con `fcm_tokens`

Eso sugiere una transicion o convivencia de mecanismos. Para decisiones nuevas, conviene tomar FCM como flujo principal observado en codigo.

## Variables y configuracion

### Frontend

- `VITE_VAPID_PUBLIC_KEY`
- `VITE_ONESIGNAL_APP_ID` y `VITE_ONESIGNAL_SAFARI_WEB_ID` pueden seguir existiendo como legado o integracion secundaria

### Supabase / server-side

- secretos privados del proveedor de mensajeria segun el flujo activo

No documentar ni pegar claves reales en el repo.

## Verificacion minima

1. Confirmar soporte del navegador para notificaciones y service worker.
2. Confirmar que `firebase-messaging-sw.js` queda registrado.
3. Activar notificaciones desde el perfil del estudiante.
4. Verificar que se persiste el token en base.
5. Ejecutar una prueba controlada de envio.

## Riesgos y observaciones

- hay señales de deuda historica entre FCM, Web Push y referencias a OneSignal;
- la documentacion debe mantenerse alineada con el flujo realmente activo;
- cualquier cambio en proveedor, service worker o almacenamiento de tokens debe actualizar este archivo.
