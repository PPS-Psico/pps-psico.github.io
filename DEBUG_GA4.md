# Debug de GA4

Guia corta para verificar que Google Analytics 4 esta enviando eventos.

## Antes de empezar

- Verificar que `VITE_GA4_MEASUREMENT_ID` este configurado.
- Ejecutar la app localmente o usar un entorno desplegado donde GA4 este habilitado.

## Verificacion rapida

1. Abrir la aplicacion.
2. Abrir DevTools.
3. Ir a la pestana `Network`.
4. Filtrar por `google-analytics` o `collect`.
5. Navegar por la app o ejecutar la accion que dispara el evento.

Si esta funcionando, deberias ver requests a endpoints de medicion de Google Analytics.

## DebugView

Para inspeccion mas fina:

1. Abrir la propiedad en Google Analytics.
2. Ir a `Admin` o `Configure`, segun la UI vigente.
3. Entrar a `DebugView`.
4. Activar el modo debug de la app o disparar eventos desde un entorno de prueba.

## Que evitar

- no hardcodear puertos locales en la documentacion;
- no asumir una URL fija de desarrollo;
- no usar este archivo como checklist total de monitoreo.

Para dashboards y lectura de negocio, ver [GA4_DASHBOARDS_UFLO.md](./GA4_DASHBOARDS_UFLO.md).
