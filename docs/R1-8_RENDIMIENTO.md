# R1 · Rendimiento: Inicio y panel de asistencia más rápidos

## Qué pasaba
En los Inicios de **dirección, coordinación y orientación** (y en el Resumen de Asistencia) los datos tardaban en aparecer. Todos usan `panel_asistencia`, que lee miles de registros de asistencia.

**La causa estaba en la base de datos:** las reglas de seguridad por fila llamaban a `app.centro_actual()`, `app.tiene_rol(...)` y `auth.uid()` **una vez por cada fila leída**, y cada llamada consulta la tabla de perfiles. Además, el panel leía los registros del período cuatro veces.

## Qué cambia
1. **Seguridad por fila:** las 32 políticas ahora llaman a esas funciones **una sola vez por consulta** (envueltas en `(select ...)`). El resultado de seguridad es exactamente el mismo: cambia *cuándo* se calcula, no *qué* se permite.
2. **Panel de asistencia:** lee los registros del período **una sola vez** y de ahí saca todos los datos.
3. **Pantalla:** mientras llegan los datos se ve un **esqueleto** gris con la forma del Inicio (en vez de un "Cargando…" vacío). Y al **volver al Inicio** se muestra al instante lo último que se vio y se actualiza en segundo plano. La memoria es por usuario y dura 5 minutos; si la actualización falla, se conserva lo que ya se mostraba.
4. **Protección a futuro:** la prueba `supabase/tests/rendimiento.sql` falla si alguna política (hoy o en el futuro) vuelve a llamar a esas funciones fila por fila.

## Medidas (en mi base de pruebas, sin contar la red)
| Registros de asistencia | Antes | Después |
|---|---|---|
| ~2,700 (la demostración) | ~300 ms | ~26 ms |
| ~34,000 (un centro de tamaño real, 14 días de ~31,000) | ~945 ms | ~280 ms |

En tu Supabase se suma la distancia de red (el servidor suele estar fuera del país), así que la mejora se notará más en las visitas repetidas, que ahora son instantáneas.

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto y el `CLAUDE.md` a la raíz. Acepta reemplazar: cambian los archivos de `src/app/inicio/` y `src/app/Inicio.test.tsx`.
2. `npx supabase db push` (migración nueva: `20261016000100_rendimiento`). Cambia las políticas y reemplaza la función del panel.
3. En el SQL Editor ejecuta `supabase/tests/rendimiento.sql`. Debe terminar con **TODAS LAS PRUEBAS DE RENDIMIENTO PASARON**.
4. **Importante: vuelve a ejecutar las pruebas de seguridad** para confirmar que nada cambió: `rls.sql`, `admin_estudiantes.sql`, `admin_estructura.sql`, `asistencia.sql`, `panel_asistencia.sql`, `admin_tutores.sql` y `pendientes_datos.sql`. Todas deben dar su mensaje de éxito igual que antes.
5. `npm test` y `npm run build`.
6. `npm run dev`: entra como `direccion@polidemo.test` y mide: la primera vez verás el esqueleto y luego los datos. Ve a otro módulo y vuelve al Inicio: los datos deben aparecer al instante.
7. `git add .`, `git commit`, `git push`.

## Si algo falla
Si alguna prueba de seguridad del paso 4 falla después de aplicar la migración, **no sigas**: pásame el mensaje exacto. La migración solo cambia la forma de escribir las políticas, y es reversible reescribiendo las políticas anteriores.

## Límites y siguientes pasos
- El panel aún tarda unos 0.3 s en el servidor con ~30,000 registros en 14 días; es el costo de contar y agrupar. Si un centro crece a cientos de miles de registros, el siguiente paso es guardar totales por día ya calculados (parte del Panel del centro, R7).
- Los datos del Inicio se recuerdan 5 minutos por usuario en el navegador: al volver ves lo anterior un instante y enseguida lo actualizado.

## Regla para el futuro (también en CLAUDE.md)
En toda política de seguridad por fila, las funciones `app.centro_actual()`, `app.tiene_rol(...)` y `auth.uid()` deben ir como `(select ...)`. La prueba `rendimiento.sql` lo verifica.
