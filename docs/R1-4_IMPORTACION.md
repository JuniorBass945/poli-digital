# R1 · Administración: importación de estudiantes desde Excel

## Qué hace
En **Gestión de datos > Importar Excel** se carga un archivo `.xlsx` con los estudiantes y sus tutores:
1. **Descarga la plantilla** (`public/plantilla_importacion_estudiantes.xlsx`, con una hoja de instrucciones).
2. **Elige el archivo.** El sistema lo revisa completo y **no guarda nada**.
3. **Revisión:** resumen (filas leídas, listas, con advertencia, con error) y una tabla con el detalle de cada fila con problemas. Se puede descargar un CSV con esas filas.
4. **Confirma.** Se guardan juntas todas las filas válidas (una sola transacción). Las filas con error se omiten y se explican.

## Columnas (se reconocen sin importar tildes, mayúsculas ni el orden)
Obligatorias: Matrícula, Nombres, Apellidos, Grado, Sección, Nombre del tutor, Teléfono del tutor.
Opcionales: Fecha de nacimiento, Especialidad, Parentesco, Correo del tutor.
También se reconocen títulos alternativos (por ejemplo "Curso", "Grupo", "Celular", "Representante").

## Reglas
- **El aula debe existir** (grado, sección y especialidad) y estar activa en el año escolar actual. Si no se escribe especialidad y solo hay un aula con ese grado y sección, se usa esa. El grado acepta `4`, `4to`, `4.º`. La sección se acepta en minúscula.
- **La matrícula** no puede existir ya en el sistema ni repetirse en el archivo.
- **Teléfono del tutor:** 10 dígitos (se acepta `(809) 555-1234`, `8095551234` o `1-809-555-1234`) y se guarda como `809-555-1234`.
- **Tutores:** si dos filas tienen el mismo nombre y el mismo teléfono (hermanos) se crea **un solo tutor**. Si el tutor ya existe en el sistema (mismo nombre y teléfono) se reutiliza. Los tutores nuevos quedan con el consentimiento de WhatsApp pendiente.
- **Advertencias** (la fila sí se importa): correo con formato inválido (se ignora) y mismo teléfono usado por otra persona (se crea un tutor nuevo; conviene revisarlo).
- **Errores** (la fila se omite): falta un dato obligatorio, teléfono inválido, fecha inválida, aula inexistente o ambigua, matrícula repetida o ya existente.
- Máximo 2,000 filas y 5 MB por archivo. Se lee la primera hoja.

## Cómo aplicarlo
1. En la terminal del proyecto: `npm install read-excel-file`
2. Copia las carpetas `src`, `supabase`, `public` y `docs` del zip dentro de tu proyecto, y `CLAUDE.md` a la raíz. **No reemplaza `index.tsx`:** agrégale a mano 3 líneas (ver abajo).
3. `npx supabase db push` (migración nueva: `20261012000100_importar_estudiantes`).
4. En el SQL Editor de Supabase ejecuta `supabase/tests/importar_estudiantes.sql`. Debe terminar con **TODAS LAS PRUEBAS DE IMPORTACIÓN PASARON**.
5. `npm test` y `npm run build`.
6. `npm run dev`, entra con `admin@polidemo.test` y prueba (ver abajo).
7. `git add .`, `git commit`, `git push`.

**Cambio en `src/modules/administracion/index.tsx`** (si ya agregaste la pestaña Tutores, conserva tus cambios):
```tsx
import Importar from './Importar';                                      // 1) con los demás imports
{ id: 'importar', etiqueta: 'Importar Excel' },                         // 2) en la lista de tabs, después de 'estudiantes'
{tab === 'importar' && <Importar />}                                    // 3) junto a los demás {tab === ... && ...}
```

## Prueba con el Excel simulado
El archivo `docs/ejemplos/estudiantes_simulados.xlsx` trae 102 estudiantes ficticios (matrículas `S26-...`) con problemas puestos a propósito. Súbelo en la pestaña Importar Excel. **Resultado esperado de la revisión** (con los datos de demostración y las aulas 4.º A Informática, 4.º B Electricidad y 4.º C Contabilidad):

| Concepto | Esperado |
|---|---|
| Filas leídas | 102 |
| Listas | 89 |
| Con advertencia | 4 |
| Con error (se omiten) | 9 |
| Se importarían | 93 estudiantes |
| Tutores nuevos / repetidos o ya existentes | 85 / 8 |

Filas con problema (número de fila de Excel):
| Fila | Estado | Motivo |
|---|---|---|
| 90 | Advertencia | Mismo teléfono que otro tutor con distinto nombre |
| 91 | Advertencia | Correo inválido |
| 92 | Error | Faltan los apellidos |
| 93 | Error | Teléfono inválido |
| 94 | Error | Falta el teléfono |
| 95 | Error | Falta el nombre del tutor |
| 96 | Error | Fecha de nacimiento inválida (31/02/2010) |
| 97 | Error | Matrícula repetida en el archivo |
| 98 y 99 | Error | Aula 6.º Z inexistente |
| 101 | Advertencia | Correo inválido |
| 102 | Advertencia | Mismo teléfono que otro tutor con distinto nombre |
| 103 | Error | La matrícula P26-1100 ya existe (estudiante de demostración) |

Después de confirmar deben aparecer 93 estudiantes nuevos en la pestaña Estudiantes (en total 129 con los 36 de demostración), y 85 tutores nuevos.

**Para volver al estado de demostración:** en el SQL Editor ejecuta `supabase/scripts/limpiar_estudiantes_simulados.sql`. Borra solo los estudiantes `S26-...` y sus tutores; debe dejar 36 estudiantes y 35 tutores. **Úsalo únicamente en el proyecto de pruebas.**

## Cuando llegue el Excel oficial del centro
1. Subirlo tal cual. Si las columnas tienen otros títulos, se reconocen los más comunes; los que no, se agregan a la lista `SINONIMOS` de `src/modules/administracion/importacion.ts`.
2. Si trae datos distintos (cédula del tutor, dirección, sexo, nacionalidad, orden de apellidos, una hoja por aula, etc.), se amplía la plantilla, la función de base de datos y esta guía.
3. Ver con el centro cómo escriben el grado y la especialidad, para que coincidan con las aulas creadas.

## Límites conocidos
- Solo se leen archivos `.xlsx` de la primera hoja; para `.xls` o `.csv` hay que guardarlos como `.xlsx`.
- La importación solo crea estudiantes nuevos: no actualiza a los que ya existen (eso se hace en la pestaña Estudiantes).
- Los estudiantes se matriculan en el año escolar actual. La promoción de grado se hará en otra parte.

## Registro de horas
Anota en el Excel del plan (fase 2) lo que te tome aplicar y probar, y el tiempo de la conversación.
