# R1 · Nombre dividido y control de personas repetidas

## Qué cambia
1. **El nombre se escribe en partes** en todos los formularios de personas (Nuevo docente, Editar docente, Nuevo acceso, Roles y nombre):
   **Título** (lista de abreviaturas: Lic., Licda., Ing., Inga., Dr., Dra., Arq., Arqa., MSc., Mag., Prof., Profa., Lcdo., Lcda.),
   **Nombre(s)**, **1.er apellido** y **2.º apellido (opcional)**. El título es opcional.
   El nombre completo que se ve en pantalla se arma solo: `Lic. María José Pérez Gómez`.
2. **Una persona no se crea dos veces.** Al dar un acceso, el paso **¿Quién es?** busca en los docentes y en los accesos del centro:
   - Si ya existe como **docente sin acceso**, aparece "¿Es alguna de ellas?" con el botón **Sí, es esta persona**: se usa ese docente (no se crea otro) y se activa el rol Docente.
   - Si existe pero **ya tiene acceso** o está **de baja**, se muestra y hay que marcar **"es otra persona con el mismo nombre"** para continuar.
   - Si no existe nadie parecido, se crea normal.
   - El mismo control está en **Nuevo docente**: avisa si ya hay alguien parecido y pide confirmar que es otra persona.

## Reglas (por qué no se bloquea por nombre)
- Puede haber **homónimos reales** (dos personas con el mismo nombre), así que el sistema **avisa y pide confirmar**, no prohíbe.
- Dos cosas **sí se bloquean siempre**: un **usuario repetido** y vincular un docente que **ya tiene acceso**.
- Se compara sin tildes, sin mayúsculas y sin títulos. "Parecida" = mismo primer nombre y mismo 1.er apellido; "mismo nombre" = mismas palabras.
- La base de datos aplica la regla además de la pantalla: aunque alguien la saltara, el servidor responde con el aviso.
- Cuando el centro entregue la cédula, se puede usar como clave única (pendiente, depende del Excel oficial).

## Registros anteriores
Los docentes y accesos creados antes de este cambio solo tienen el nombre completo. Al editarlos, el formulario **propone** cómo dividirlo
(título, nombres y apellidos) y se corrige a mano si hace falta. Mientras no se editen siguen funcionando igual.
Cambiar el nombre de un acceso también cambia el de su docente ligado (y al revés al editar el docente).

## Archivos
- `supabase/migrations/20261018000100_nombres_personas.sql`: columnas `titulo, nombres, apellido1, apellido2` (docentes y perfiles), funciones
  `crear_docente_persona`, `actualizar_docente_persona`, `buscar_personas`, `sugerir_usuario_partes`, `actualizar_persona_acceso`;
  `validar_nuevo_acceso` / `registrar_acceso` / `listar_accesos` ampliadas. Las funciones anteriores se conservan.
- `supabase/tests/nombres_personas.sql` (41 comprobaciones).
- `supabase/functions/accesos/index.ts`: pasa las partes del nombre y `otraPersona`. **Hay que volver a desplegarla.**
- `src/modules/administracion/`: `partesNombre.ts`, `CamposNombre.tsx`, `Docentes.tsx`, `Accesos.tsx`, `apiAccesos.ts`, `apiEstructura.ts`, `reglasAcceso.ts`, `tiposEstructura.ts` (+ pruebas).

## Pasos para aplicarlo
1. Copiar los archivos del zip sobre el proyecto (no incluye `administracion/index.tsx`).
2. `npx supabase db push`
3. `npx supabase functions deploy accesos`
4. Pegar `supabase/tests/nombres_personas.sql` en el SQL Editor: debe terminar con "TODAS LAS PRUEBAS DE NOMBRES Y PERSONAS PASARON".
5. `npm test` y `npm run build`.
6. Probar en pantalla:
   - Nuevo docente con título, nombres y un solo apellido; con dos apellidos.
   - Intentar crear otra vez el mismo docente: debe avisar y pedir confirmar.
   - Nuevo acceso escribiendo el nombre de un docente existente sin acceso: elegirlo con "Sí, es esta persona" y comprobar que **no aparece un docente duplicado**.
   - Editar un acceso viejo: el formulario propone las partes del nombre.
