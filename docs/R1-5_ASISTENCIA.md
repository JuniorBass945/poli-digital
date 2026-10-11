# R1 · Clase de trabajo, asistencia y avisos a tutores (primera versión)

## Qué hace
**Asistencia** (módulo para docente y coordinación)
1. El docente elige su **clase de trabajo** (aula + materia). El sistema la recuerda en ese navegador.
2. Elige la fecha (hoy por defecto) y ve la lista del aula con **todos presentes**. Marca *Ausente*, *Tarde* o *Excusa* a quien corresponda y pulsa **Guardar asistencia**.
3. Si ya había una lista ese día, se carga y se puede **corregir**.
4. Al guardar, por cada **ausente** con tutor se prepara un **aviso** pendiente. Si se corrige a "no ausente", el aviso pendiente se cancela; si vuelve a ausente, se reactiva.

**Avisos a tutores** (docente, coordinación; dirección y orientación solo consultan)
- Lista de avisos por estado (Pendientes, Enviados, Omitidos, Cancelados), con búsqueda.
- **Enviar por WhatsApp** abre WhatsApp con el número del tutor y el mensaje ya escrito, y marca el aviso como enviado. Si no se envió, **Volver a pendiente**.
- **Omitir** (con una nota opcional) cuando no hace falta avisar.
- Sin teléfono válido, el botón de enviar queda desactivado.

## Reglas
- Un **docente** solo pasa lista en **sus** clases y de **hoy hasta 3 días atrás**. **Coordinación** y administración pueden cualquier clase y fecha. No se admiten fechas futuras.
- La lista debe incluir a **todos** los estudiantes activos del aula (el sistema la envía completa).
- **Un aviso por estudiante y día**, aunque falte a varias clases: queda el de la primera clase en que se marcó ausente. *Tarde* y *Excusa* no generan aviso.
- El aviso va al **tutor principal** del estudiante. Si no tiene tutor, se avisa al docente en pantalla y no se crea.
- Un aviso ya **enviado u omitido** no cambia si se vuelve a guardar la lista. Uno **cancelado** ya no se puede enviar.
- Nadie escribe directamente en estas tablas: todo pasa por las funciones `guardar_asistencia` y `gestionar_aviso`, que comprueban rol, clase y fecha.
- Las correcciones de asistencia y los cambios de avisos quedan en la **auditoría** con su autor.

## Supuestos pendientes de confirmar con el centro
1. ¿El aviso de ausencia es **uno al día** por estudiante (como está ahora) o **uno por clase**?
2. ¿Quién envía el aviso: el docente que pasó lista (como está ahora), coordinación o se automatiza?
3. ¿Cuántos días puede corregir un docente su lista (ahora 3)? ¿Quién aprueba una **excusa** (ahora solo se marca)?
4. ¿Se avisa también de las **tardanzas**? (ahora no)
5. El consentimiento de WhatsApp de los tutores (formulario firmado) todavía no se exige para este envío manual. Será obligatorio cuando se active el envío automático (R2).

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto y el `CLAUDE.md` a la raíz. Acepta reemplazar: cambian `src/app/App.test.tsx` y los marcadores `src/modules/asistencia/index.tsx` y `src/modules/avisos/index.tsx`.
2. `npx supabase db push` (migración nueva: `20261013000100_asistencia_avisos`).
3. En el SQL Editor de Supabase ejecuta `supabase/tests/asistencia.sql`. Debe terminar con **TODAS LAS PRUEBAS DE ASISTENCIA PASARON**.
4. `npm test` y `npm run build`.
5. `npm run dev` y prueba (lista de abajo).
6. `git add .`, `git commit`, `git push`.

## Lista de pruebas manuales
Entra con `docente@polidemo.test` (Prof. Carmen Peña):
- [ ] En Asistencia aparecen sus clases. Elige una: se ve la lista del aula con todos presentes.
- [ ] Marca 2 ausentes y 1 tarde; los contadores cambian. Guarda: aparece "Se prepararon 2 avisos".
- [ ] Recarga la página: la clase de trabajo sigue elegida y la lista guardada se carga con "Lista ya registrada".
- [ ] Cambia un ausente a presente y guarda de nuevo: ese aviso se cancela.
- [ ] En Avisos a tutores, pestaña Pendientes: aparecen los avisos. **Enviar por WhatsApp** abre el chat con el mensaje escrito; el aviso pasa a Enviados.
- [ ] Un aviso enviado: **Volver a pendiente**. Otro: **Omitir** con una nota.
- [ ] Prueba una fecha de hace 4 días: el sistema no deja (3 días máximo).
Entra con `coordinacion@polidemo.test`:
- [ ] Ve las clases de todos los docentes (con el nombre del docente) y puede elegir fechas anteriores.
Entra con `orientacion@polidemo.test` o `direccion@polidemo.test`:
- [ ] En Avisos solo consulta: no hay botones de envío.
Entra con `tutor@polidemo.test`:
- [ ] No ve Asistencia ni Avisos.

## Límites conocidos
- El envío es **manual** (enlace de WhatsApp). El automático llega en R2.
- Los avisos usan el tutor principal; el mensaje no se puede editar antes de enviar.
- No hay todavía historial ni estadísticas de asistencia: eso es el panel de asistencia, la siguiente parte.
- La hora "de hoy" se calcula con la zona horaria del centro (America/Santo_Domingo).

## Registro de horas
Anota en el Excel del plan (fase 3) el tiempo que te tome aplicar y probar, y el de la conversación.
