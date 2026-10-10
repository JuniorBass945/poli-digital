# R1 · Administración, parte 2: estructura académica

## Qué incluye (módulo Gestión de datos, solo para administración)
- **Docentes:** registrar (nombre y correo opcional), editar, dar de baja con un motivo de una lista (la nota es obligatoria si el motivo es "Otro") y reactivar.
  No se puede dar de baja a un docente que tenga materias asignadas o sea guía de un aula: primero hay que reasignarlas. Si el docente ya tenía usuario, la baja le quita el acceso y reactivarlo se lo devuelve.
- **Materias:** el catálogo del centro. Crear, editar, archivar (solo si no está asignada a ningún aula) y reactivar.
- **Aulas:** crear en el **año escolar actual** con grado, sección, especialidad opcional y docente guía opcional. Editar, archivar (solo si no tiene estudiantes activos) y reactivar. Se ve cuántos estudiantes y materias tiene cada una.
- **Asignaciones:** por aula, qué materia da qué docente. Agregar una materia con su docente, cambiar el docente al instante y quitar una materia (el historial se conserva; si se vuelve a asignar, se reutiliza la misma fila).
- La pestaña **Tutores** queda como "pronto".

## Decisiones tomadas
- Las bajas de personas (docentes) piden motivo; aulas y materias se **archivan** con confirmación. Nada se borra.
- Un docente solo puede tener la baja si no tiene clases ni es guía: así nunca quedan materias sin responsable.
- Al archivar un aula, sus asignaciones dejan de estar activas; al reactivarla hay que asignar sus materias de nuevo.
- Las secciones se guardan en mayúscula (A, B, C...). No puede haber dos aulas iguales (grado, sección y especialidad) en el mismo año.
- El correo de un docente y el nombre de una materia no se pueden repetir en el centro (sin importar mayúsculas).

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto `poli-digital`, y el archivo `CLAUDE.md` a la raíz. Acepta reemplazar los archivos que pregunte (`api.ts` e `index.tsx` del módulo de administración).
2. `npx supabase db push` (aplica una migración nueva: `20261011000100_admin_estructura`).
3. En el SQL Editor de Supabase pega y ejecuta `supabase/tests/admin_estructura.sql`. Debe terminar con **TODAS LAS PRUEBAS DE ESTRUCTURA PASARON**. (No deja datos.)
4. `npm test` y `npm run build`.
5. `npm run dev`, entra con `admin@polidemo.test`, abre **Gestión de datos** y recorre la lista de abajo.
6. Si todo está bien: `git add .`, `git commit -m "R1: estructura académica"`, `git push`.

## Lista de pruebas manuales
- [ ] Docentes: aparecen los 8 de demostración; a Prof. Carmen Peña se le ven sus clases y que es guía de 4.º A.
- [ ] Crear un docente nuevo (con y sin correo). Repetir el correo: "Ya hay un docente con ese correo."
- [ ] Intentar dar de baja a Prof. Carmen Peña: explica que tiene clases y no deja.
- [ ] Dar de baja al docente nuevo con motivo "Renuncia": desaparece; con "Mostrar dados de baja" aparece. Reactivarlo.
- [ ] Materias: crear "Física". Intentar archivar "Matemática": no deja (está asignada). Archivar "Física": sí.
- [ ] Aulas: crear 6.º A con una especialidad y un guía. Repetirla: "Ya existe un aula...". Intentar archivar 4.º A: no deja (tiene estudiantes).
- [ ] Asignaciones: elegir 6.º A, agregar "Lengua Española" con un docente; cambiarle el docente; quitarla.
- [ ] Entra como `docente@polidemo.test`: no ve Gestión de datos.
- [ ] En Supabase, Table Editor, tabla `auditoria`: aparecen estos cambios con su autor.

## Límites conocidos
- Las listas cargan hasta 1,000 registros por tabla; para centros muy grandes se agregará paginación en el servidor.
- El cambio de año escolar y la promoción de grado se harán en otra parte; hoy solo se crean aulas en el año actual.
- La creación del usuario del docente (invitación por correo) llega cuando haya dominio y correo propio.
- La importación de estudiantes desde Excel y la pestaña Tutores son las siguientes partes de Administración.

## Registro de horas de esta parte
Anota en el Excel del plan (hoja Registro de horas, fase 2) cuánto te toma aplicar, probar y pedir ajustes, y cuánto dura la conversación. Estimado original de la fase de administración: 20 a 32 h en total; esta parte y la anterior suman unas 20 a 25 h del estimado.
