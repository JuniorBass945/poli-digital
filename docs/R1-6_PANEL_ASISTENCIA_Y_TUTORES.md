# R1 · Panel de asistencia y pestaña Tutores

## 1. Panel de asistencia (pestaña "Resumen" del módulo Asistencia)
**Quién lo ve:** coordinación y docentes (junto a "Pasar lista") y **dirección** (solo el resumen). Cada rol ve lo que le permite la seguridad: un docente, solo sus clases; coordinación y dirección, todo el centro.

**Qué muestra** (para un período: últimos 7 días, últimos 30, este mes o fechas a elegir; y un aula o todas):
- **Indicadores:** % de asistencia, ausencias, tardanzas, excusas, listas pasadas y estudiantes en riesgo.
- **Asistencia por día:** barras de colores (verde 90 % o más, amarillo de 80 a 90, rojo menos de 80). Al pasar el cursor se ve el detalle del día.
- **Por aula:** ordenadas de menor a mayor asistencia, para ver primero las que necesitan atención.
- **Estudiantes en riesgo:** con X o más días con ausencia (X se elige: 2, 3, 5, 7 o 10; por defecto 3), con su aula, tardanzas y última ausencia. Se pueden **descargar en CSV**.
- **Clases que hoy no han pasado lista** (solo en días de semana): para que coordinación sepa a quién recordarle.

**Cómo se calcula**
- **% de asistencia = (presentes + tardanzas) / todos los registros.** Las ausencias y las excusas no suman. Cada registro es un estudiante en una clase en un día.
- **Día con ausencia:** un día cuenta si el estudiante faltó a **al menos una clase** ese día.
- Estos criterios (90/80 para los colores, umbral 3, qué cuenta como asistencia) son supuestos que conviene **confirmar con el centro**.

**Datos de demostración:** `supabase/seed_asistencia_demo.sql` genera unas 3 semanas de listas para las clases del Politécnico Demo (con unos pocos estudiantes que faltan mucho). Pégalo en el SQL Editor para ver el panel con datos. Para borrarlos: `supabase/scripts/limpiar_asistencia_demo.sql`. **Solo en el proyecto de pruebas.**

## 2. Pestaña Tutores (Gestión de datos)
- Lista de tutores con sus hijos, contacto y el **estado de WhatsApp**: *Consentimiento pendiente*, *Otorgado sin verificar*, *Otorgado y verificado* o *Sin teléfono*. Filtros con conteo y búsqueda por tutor, teléfono o nombre de un hijo.
- **Editar** nombre, parentesco, teléfono (se guarda como `809-555-1234`) y correo. Si el tutor tiene varios hijos, el cambio vale para todos.
- **WhatsApp:** registrar que el tutor **aceptó recibir mensajes** (con su **evidencia**, obligatoria: por ejemplo "formulario firmado en la matrícula") y si el **número fue verificado**. Se guarda la fecha. Retirar el consentimiento limpia la fecha y la verificación. Todo queda en la auditoría.
- Los tutores no se crean ni se borran aquí: se crean al registrar o importar estudiantes.

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto y el `CLAUDE.md` a la raíz. Acepta reemplazar: cambian `src/modules/registry.ts` (dirección ve Asistencia), `src/modules/asistencia/index.tsx` y `src/modules/asistencia/api.ts`.
2. **No reemplaza `src/modules/administracion/index.tsx`** (para no pisar tus cambios). Hazle estos 3 cambios:
   ```tsx
   import Tutores from './Tutores';                                  // 1) con los demás imports
   { id: 'tutores', etiqueta: 'Tutores' },                           // 2) quita "proximamente: true" de la pestaña Tutores
   {tab === 'tutores' && <Tutores />}                                // 3) junto a los demás {tab === ... && ...}
   ```
3. `npx supabase db push` (2 migraciones nuevas: `20261014000100_panel_asistencia` y `20261014000200_admin_tutores`).
4. En el SQL Editor ejecuta, uno por uno, `supabase/tests/panel_asistencia.sql` y `supabase/tests/admin_tutores.sql`. Deben terminar con **TODAS LAS PRUEBAS DEL PANEL DE ASISTENCIA PASARON** y **TODAS LAS PRUEBAS DE TUTORES PASARON**.
5. Para ver el panel con datos, ejecuta `supabase/seed_asistencia_demo.sql`.
6. `npm test` y `npm run build`.
7. `npm run dev` y prueba (lista de abajo).
8. `git add .`, `git commit`, `git push`.

## Lista de pruebas manuales
- [ ] Con `coordinacion@polidemo.test`: Asistencia > Resumen muestra indicadores, barras por día, aulas y estudiantes en riesgo (con los datos de demostración). Cambia el período, el aula y el umbral: los números cambian. Descarga el CSV.
- [ ] Con `direccion@polidemo.test`: aparece Asistencia con solo el resumen (sin "Pasar lista").
- [ ] Con `docente@polidemo.test`: en Resumen solo ve sus clases (sin filtro de aula).
- [ ] Con `tutor@polidemo.test` y `orientacion@polidemo.test`: no ven Asistencia.
- [ ] Con `admin@polidemo.test` > Gestión de datos > Tutores: se ve la lista con sus hijos. Filtra por "Pendientes". Edita un teléfono. Registra el consentimiento de un tutor (primero sin evidencia: debe pedirla), verifícalo y comprueba que el estado cambia.
- [ ] En Supabase, tabla `auditoria`: aparecen los cambios de tutores y consentimientos.
- [ ] Para volver a empezar con los datos de demostración de asistencia: `supabase/scripts/limpiar_asistencia_demo.sql`.

## Límites conocidos
- El panel cuenta lo que se registró en las listas; si un docente no pasa lista, esos días no aparecen (para eso está "clases sin lista hoy").
- Los rangos máximos son de un año. Las listas de tutores cargan hasta 1,000 registros.
- Aún no hay estadísticas de calificaciones ni comparación entre períodos: eso es del Panel del centro (R7).

## Registro de horas
Anota en el Excel del plan (fase 5 para el panel, fase 2 para Tutores) lo que te tome aplicar y probar, y el de la conversación.
