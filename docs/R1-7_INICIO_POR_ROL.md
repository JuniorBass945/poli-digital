# R1 · Inicio útil por rol

La pantalla de **Inicio** deja de ser una lista de contadores técnicos: cada persona ve primero **lo que le importa hoy**, con botones directos a la acción. El saludo y la lista de "Módulos de tu centro" se mantienen al final para todos.

## Qué ve cada rol
| Rol | Qué ve al entrar |
|---|---|
| **Dirección** | Asistencia de la semana con su tendencia frente a la semana anterior (▲/▼), ausencias de la semana, estudiantes en riesgo y avisos por enviar. Gráfico de asistencia de las últimas 2 semanas, las 3 aulas con menor asistencia y los estudiantes con más ausencias. Todo lleva al resumen de Asistencia. |
| **Coordinación** | Clases que **hoy no han pasado lista** (con su docente), avisos por enviar, estudiantes en riesgo y asistencia de la semana. |
| **Docente** | Sus **clases de hoy** con su estado (*Lista pasada* / *Falta pasar lista*), las que faltan primero. **Pasar lista** deja elegida esa clase de trabajo y abre Asistencia. Su asistencia de la semana y sus avisos por enviar. |
| **Administración** | Totales (estudiantes activos, tutores, docentes, aulas) y **pendientes de datos**: estudiantes sin tutor, estudiantes sin aula, tutores sin teléfono, aulas sin materias, docentes sin clases y tutores sin consentimiento de WhatsApp. Cada uno explica qué provoca. Si no falta nada, dice "Todo en orden". |
| **Orientación** | Estudiantes para dar seguimiento (ausencias y tardanzas), avisos por enviar y tardanzas de 2 semanas. Los casos y alertas llegarán con el módulo de orientación (R5). |
| **Tutor** | La vista básica de siempre (el acceso de las familias será el portal, más adelante). |

## Reglas y supuestos (por confirmar con el centro)
- La comparación usa las **últimas 2 semanas**: "esta semana" son los últimos 7 días hasta hoy.
- **En riesgo:** 3 o más días con ausencia en esas 2 semanas (un día cuenta si faltó a al menos una clase).
- **Colores:** verde 90 % o más, amarillo de 80 a 90, rojo menos de 80.
- En **fin de semana** no se muestran clases pendientes.
- Si un módulo no está activo para el centro, su parte del Inicio no se muestra.
- Los pendientes de administración cuentan solo registros **activos**.

## Cómo aplicarlo
**Requisito:** ya debes haber aplicado `poli-digital-r1-panel-y-tutores.zip` (este Inicio usa su panel de asistencia).
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto y el `CLAUDE.md` a la raíz. Acepta reemplazar: cambian `src/app/Inicio.tsx` y `src/app/App.test.tsx`.
2. `npx supabase db push` (migración nueva: `20261015000100_pendientes_datos`).
3. En el SQL Editor ejecuta `supabase/tests/pendientes_datos.sql`. Debe terminar con **TODAS LAS PRUEBAS DE PENDIENTES DE DATOS PASARON**.
4. Si no cargaste los datos de demostración de asistencia, ejecuta `supabase/seed_asistencia_demo.sql` para ver los gráficos y listas.
5. `npm test` y `npm run build`.
6. `npm run dev` y prueba (lista de abajo).
7. `git add .`, `git commit`, `git push`.

## Lista de pruebas manuales
- [ ] `direccion@polidemo.test`: aparecen los indicadores con la tendencia, el gráfico, las aulas y los estudiantes en riesgo. Toca un indicador: abre Asistencia o Avisos.
- [ ] `coordinacion@polidemo.test`: aparecen las clases sin lista hoy (en día de semana) con su docente.
- [ ] `docente@polidemo.test`: aparecen sus clases de hoy. Toca **Pasar lista** en una: abre Asistencia con esa clase elegida. Pasa lista y vuelve al Inicio: esa clase aparece como *Lista pasada*.
- [ ] `admin@polidemo.test`: aparecen los pendientes de datos. Corrige uno (por ejemplo, completa un teléfono en Tutores), vuelve al Inicio y comprueba que baja.
- [ ] `orientacion@polidemo.test`: aparece la lista de estudiantes para dar seguimiento.
- [ ] `tutor@polidemo.test`: ve la vista básica.
- [ ] En sábado o domingo: coordinación y docentes ven que hoy no hay clases.

## Límites conocidos
- Las cifras se calculan al abrir el Inicio; para actualizarlas hay que recargar la página.
- "Esta semana" son los últimos 7 días, no la semana de lunes a domingo.
- Los botones llevan al módulo (no a una pestaña o filtro exacto).
- No se muestran calificaciones ni casos de orientación: esos módulos llegan en R3 y R5.

## Registro de horas
Anota en el Excel del plan (fase 1) el tiempo que te tome aplicar y probar, y el de la conversación.
