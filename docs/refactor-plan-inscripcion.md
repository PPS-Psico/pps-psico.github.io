# Plan Ajustado de Refactor: Flujo de Inscripcion y Convocatorias

## Veredicto rapido

Si, **vale la pena implementarlo**, pero **no completo ni en el orden original**.

Lo que mas valor tiene hoy es:

1. limpiar codigo muerto;
2. extraer la logica de estado de inscripcion a una funcion pura;
3. cubrir esa logica con tests;
4. dividir la card monolitica en partes mas legibles;
5. tipar mejor los RPCs criticos.

Lo que **no conviene encarar todavia como estaba planteado** es la validacion backend de "ya realizada" mediante un RPC previo llamado desde frontend, porque eso **no cierra realmente el bypass**. Si se hace, tiene que hacerse como enforcement real en la base.

---

## Estado actual

### Hallazgos confirmados

1. Hay contextos y hooks muertos u obsoletos que ya no participan del flujo real.
2. `StudentDashboard` sigue pasando demasiadas props a `HomeView` y `ConvocatoriasList`.
3. La logica para determinar si una PPS ya fue realizada esta duplicada.
4. El tipado de varios RPCs sigue siendo debil y depende de `as any`.
5. `ConvocatoriaCardPremium` concentra demasiada responsabilidad visual y funcional.
6. `completedLanzamientoIds` mezcla conceptos distintos: IDs reales y nombres normalizados.
7. El flujo de inscripcion todavia no tiene una base minima de tests sobre la logica sensible.

### Lectura tecnica

La deuda mas importante no esta en la UI superficial sino en esto:

- reglas de negocio duplicadas;
- mezcla de responsabilidades;
- dificultad para tocar el flujo sin miedo;
- poca capacidad de verificar rapido si una refactorizacion rompio el criterio de inscripcion.

---

## Principio de implementacion

Este refactor debe buscar:

- **menos ambiguedad**, no mas abstraccion por si acaso;
- **menos codigo repetido**, no mas indireccion innecesaria;
- **mas facilidad para probar**, no solo "codigo mas prolijo";
- **cero regresiones funcionales** en estudiante y admin.

Por eso, el orden correcto no es "mover cosas de lugar" primero, sino:

1. aislar la logica;
2. probarla;
3. recien despues simplificar componentes.

---

## Fases recomendadas

### FASE 1: Limpieza de codigo muerto

**Riesgo: bajo** | **Valor: medio** | **Cambios funcionales: no**

#### Objetivo

Eliminar piezas que ya no tienen uso real y que solo agregan ruido al mantenimiento.

#### Tareas

- borrar:
  - `src/hooks/useStudentPanelContext.tsx`
  - `src/contexts/StudentAcademicContext.tsx`
  - `src/contexts/StudentDataContext.tsx`
- revisar imports residuales;
- limpiar referencias de configuracion vieja en `.gitignore` y validar `.env.example`.

#### Verificacion

- `npx tsc --noEmit`
- `npm run build`
- login estudiante
- inscripcion
- admin viendo estudiante

#### Recomendacion

Esta fase si vale la pena hacerla ya.

---

### FASE 2: Extraer la logica de inscripcion a funcion pura

**Riesgo: bajo** | **Valor: alto** | **Cambios funcionales: no**

#### Correccion importante del plan original

No conviene crear un hook `useEnrollmentStatus` para una logica que, segun lo descripto, es pura.

Lo correcto es crear algo como:

```ts
getEnrollmentStatus(...)
```

o

```ts
resolveEnrollmentStatus(...)
```

y que retorne:

```ts
{
  (isCompleted, completedOrientaciones, allOrientationsCompleted);
}
```

#### Objetivo

Que haya una sola fuente de verdad para saber si una PPS debe mostrarse como ya realizada o parcialmente disponible.

#### Tareas

- crear una funcion pura en `src/utils/` o `src/domain/`;
- extraer:
  - normalizacion por nombre de institucion;
  - cruce por ID de lanzamiento;
  - cruce por nombre normalizado;
  - manejo de orientaciones completas/parciales;
- separar en `dataLinker.ts`:
  - `completedLanzamientoIds`
  - `completedLanzamientoNames`

#### Verificacion

- `npx tsc --noEmit`
- test manual:
  - PPS single orientacion completada
  - PPS multi orientacion parcial
  - PPS multi orientacion completa

#### Recomendacion

Esta es probablemente la fase con mejor relacion valor/riesgo de todo el plan.

---

### FASE 3: Tests unitarios de la logica de inscripcion

**Riesgo: bajo** | **Valor: muy alto** | **Cambios funcionales: no**

#### Objetivo

Poder refactorizar sin depender solo de pruebas manuales.

#### Tareas

- tests de `dataLinker`
- tests de `getEnrollmentStatus(...)`
- cubrir al menos:
  - practica finalizada por ID
  - practica finalizada por nombre
  - practica no finalizada
  - multi orientacion parcial
  - multi orientacion completa
  - sin practicas previas

#### Verificacion

- `npm run test`
- cobertura significativa sobre la logica de inscripcion

#### Recomendacion

En el plan original estaba muy tarde. Yo la subiria inmediatamente despues de extraer la logica.

---

### FASE 4: Dividir `ConvocatoriaCardPremium`

**Riesgo: medio** | **Valor: alto** | **Cambios funcionales: no**

#### Objetivo

Bajar la fragilidad del componente mas cargado del flujo de convocatorias.

#### Alcance recomendado

No intentar dejar la card en 100 lineas "porque si". Eso suele terminar en sobrefragmentacion.

Conviene extraer solo los bloques que ya son naturalmente separables:

- logica de boton principal
- vista expandida
- tags de orientacion
- timeline o secciones de informacion complementaria

#### Tareas

- extraer `getButtonConfig()` a una funcion o hook realmente justificado;
- mover el render expandido a un subcomponente;
- extraer las tags de orientacion a un componente chico y testeable;
- mantener `ConvocatoriaCardPremium` como orquestador, no como contenedor gigante.

#### Precauciones

- validar preview admin:
  - `LanzadorConvocatorias`
  - `PreviewModal`
  - `DesignSystemView`
- no asumir contexto donde hoy la card recibe datos mock;
- preservar props opcionales.

#### Verificacion

- `npx tsc --noEmit`
- preview admin
- estudiante con estados:
  - disponible
  - inscripto
  - seleccionado
  - realizada

#### Recomendacion

Si, vale la pena. Pero hacerlo despues de aislar y testear la logica.

---

### FASE 5: Reducir props drilling con criterio

**Riesgo: medio** | **Valor: medio** | **Cambios funcionales: no**

#### Ajuste importante

El plan original proponia que `HomeView` y `ConvocatoriasList` lean mas cosas directamente del contexto.

Eso puede simplificar `StudentDashboard`, pero tambien:

- aumenta el acoplamiento al provider;
- hace mas dificil montar componentes aislados;
- complica previews y tests.

#### Recomendacion de implementacion

No mover todo al contexto.

Hacer solo esto:

- que el contexto exponga lo verdaderamente transversal;
- mantener como props los callbacks y la data que define el render puntual;
- evitar que componentes de presentacion queden completamente atados al provider.

#### Verificacion

- admin viendo perfil estudiante
- estudiante normal
- modo simulacion / AdminTester

#### Recomendacion

Vale la pena solo si, al terminar la Fase 4, el props drilling sigue siendo una molestia real. No lo pondria como prioridad temprana.

---

### FASE 6: Tipado de RPCs y llamadas sensibles

**Riesgo: bajo-medio** | **Valor: medio-alto** | **Cambios funcionales: no**

#### Ajuste importante

No mezclar "regenerar todo `src/types/supabase.ts`" con "tipar RPCs criticos".

Eso deberia separarse:

#### Fase 6A

Tipar RPCs que hoy importan para login, inscripcion y convocatorias:

- `verify_student_identity`
- `reset_student_password_verified`
- `get_student_email_by_legajo`
- los RPCs o helpers que use `useConvocatorias.ts`

#### Fase 6B

Revisar aparte si conviene regenerar por completo `src/types/supabase.ts`.

Solo hacerlo si:

- el schema local ya cambio bastante;
- hay una razon concreta;
- se puede revisar el diff con cuidado.

#### Verificacion

- `npx tsc --noEmit`
- login real
- flujo de inscripcion

#### Recomendacion

Si vale la pena, pero de forma incremental.

---

### FASE 7: Validacion backend de "ya realizada"

**Riesgo: medio-alto** | **Valor: alto** | **Cambios funcionales: si**

#### Correccion importante del plan original

Llamar un RPC `can_enroll_in_launch(...)` desde frontend **antes** del insert no alcanza como proteccion real.

Eso solo agrega otra validacion de aplicacion.

Si se quiere enforcement real, hay que resolverlo de una de estas formas:

1. policy `WITH CHECK` en `convocatorias`;
2. trigger `BEFORE INSERT`;
3. reemplazar el alta directa por una RPC server-side que haga:
   - validacion
   - insercion
   - respuesta final

todo en una sola operacion atomica.

#### Recomendacion concreta

Para este repo, yo haria primero:

- una funcion pura equivalente en app para sostener la UX;
- y despues decidiria si vale la pena llevar esa regla a trigger o RPC atomica.

No haria un RPC "consultivo" suelto como solucion final.

#### Cuando vale la pena

Vale la pena si queres cerrar de verdad el bypass por API directa.

No vale la pena hacerla a medias.

---

## Orden recomendado

```text
FASE 1 Limpieza
  ->
FASE 2 Logica pura unificada
  ->
FASE 3 Tests unitarios de esa logica
  ->
FASE 4 Dividir ConvocatoriaCardPremium
  ->
FASE 6A Tipado incremental de RPCs criticos
  ->
FASE 5 Revisar props drilling solo si sigue doliendo
  ->
FASE 7 Enforcement real backend si sigue siendo prioridad
```

---

## Implementacion recomendada de verdad

### Haria ahora

1. Fase 1
2. Fase 2
3. Fase 3
4. Fase 4

### Haria despues

5. Fase 6A

### Dejaria en decision posterior

6. Fase 5
7. Fase 7

---

## Vale la pena o no

### Si vale la pena

Porque el flujo de inscripcion es un lugar sensible del producto y hoy tiene una combinacion peligrosa de:

- reglas duplicadas;
- componente grande;
- poca cobertura de tests;
- tipado flojo.

Eso no necesariamente explota hoy, pero hace que tocarlo en unos meses sea mucho mas caro y arriesgado.

### No vale la pena hacerlo entero de una

Porque:

- algunas fases mezclan mantenimiento con cambios de arquitectura;
- la Fase 7, como estaba planteada, no resolvia realmente el problema;
- la Fase 5 puede no devolverte tanto valor como parece.

### Mi recomendacion final

Si queres una decision ejecutiva simple:

- **si, implementarlo vale la pena**;
- **pero solo las fases 1, 2, 3 y 4 como bloque prioritario**;
- **la parte backend de enforcement solo si la hacemos bien, no a medias**.

---

## Estimacion mas realista

| Bloque            | Tiempo estimado |
| ----------------- | --------------- |
| Fase 1            | 15-30 min       |
| Fase 2            | 1 h             |
| Fase 3            | 1-2 h           |
| Fase 4            | 2-3 h           |
| Fase 6A           | 1 h             |
| Fase 7 bien hecha | 2-4 h           |

Total recomendable inmediato:

- **4 a 6 horas** para el bloque que realmente conviene hacer ya.
