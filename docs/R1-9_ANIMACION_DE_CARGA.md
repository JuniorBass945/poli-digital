# R1 · Animación de carga en toda la aplicación

## Qué hace
Cada vez que el sistema consulta o guarda algo en la base de datos, **en cualquier pantalla**, se ve que está trabajando:
- Una **barra fina animada arriba** de la pantalla, que se desliza mientras hay peticiones en curso.
- Si algo tarda más de un segundo, además aparece un aviso **"Cargando…" con un círculo que gira**, abajo a la derecha.
- Las respuestas instantáneas **no muestran nada**, para que la pantalla no parpadee.
- Al abrir un módulo por primera vez y al entrar al sistema, el "Cargando…" ahora lleva un círculo animado.
- Respeta la opción "reducir movimiento" del sistema operativo: sin desplazamiento, solo una barra fija.

## Por qué es sencillo y cubre todo
Todas las consultas pasan por un único punto, el cliente de la base de datos (`src/lib/supabase.ts`). Ahí se cuenta cuántas peticiones están en curso (`src/lib/actividad.ts`), y un solo componente (`CargaGlobal`, en `src/ui/Carga.tsx`) muestra la animación. **No hubo que tocar cada módulo**: los módulos actuales y los que vengan (calificaciones, orientación, etc.) la tendrán sin hacer nada.

## Qué incluye el zip
- `src/lib/actividad.ts` y su prueba: el contador de peticiones y el `fetch` que lo alimenta.
- `src/lib/supabase.ts`: el cliente ahora usa ese `fetch`.
- `src/ui/Carga.tsx` y su prueba: `CargaGlobal` (barra y aviso), `Spinner` y `EnCarga` (texto con círculo).
- `src/app/App.tsx` y `src/app/Shell.tsx`: colocan la animación y usan el círculo en la carga inicial y al abrir módulos.
- `src/app/inicio/piezas.tsx`: el "Cargando…" del Inicio usa el círculo.

**Requisito:** ya debes haber aplicado `poli-digital-r1-rendimiento.zip` (este archivo `piezas.tsx` incluye sus cambios).

## Cómo aplicarlo
1. Copia las carpetas `src` y `docs` del zip dentro de tu proyecto y el `CLAUDE.md` a la raíz. Acepta reemplazar. **No hay migraciones ni dependencias nuevas.**
2. `npm test` y `npm run build`.
3. `npm run dev` y comprueba la animación con una conexión lenta: abre las herramientas del navegador (F12) > pestaña **Red** (Network) > cambia "Sin limitación" por **Slow 4G** o **3G lenta** y navega entre módulos. Debes ver la barra deslizándose arriba y, si tarda, el aviso abajo a la derecha. Después vuelve a "Sin limitación".
4. `git add .`, `git commit`, `git push`.

## Opcional: el texto "Cargando…" dentro de las tablas
Los textos de carga dentro de las tablas y listas de los módulos (por ejemplo, la fila "Cargando…" de Estudiantes) siguen siendo texto. Con la barra global ya se nota que el sistema trabaja, pero si quieres que también lleven el círculo, pégale esto a Claude Code. **No lo incluí en el zip** porque toca varios archivos que tú ya ajustaste (alturas y espaciados de las tablas):
```
Hay textos "Cargando…" sueltos en varios módulos. Cámbialos para usar el componente `EnCarga` de src/ui/Carga.tsx (import { EnCarga } from '../../ui/Carga'), conservando el mismo texto. Son estos: en src/modules/avisos/index.tsx ("Cargando avisos…"); en src/modules/administracion/ Aulas.tsx, Materias.tsx, Asignaciones.tsx, Docentes.tsx, Tutores.tsx y Estudiantes.tsx (la celda "Cargando…" dentro de la tabla); en src/modules/asistencia/PasarLista.tsx ("Cargando tus clases…" y "Cargando la lista…") y Resumen.tsx ("Cargando el resumen…"). Por ejemplo, `<p className="text-sm text-muted">Cargando avisos…</p>` pasa a `<EnCarga texto="Cargando avisos…" />`, y dentro de una celda `<td ...>Cargando…</td>` pasa a `<td ...><EnCarga /></td>`. No cambies nada más. Corre `npm test` y `npm run build` y dime si pasan. No hagas commit ni push.
```

## Límites
- Muestra actividad de **la base de datos** y de la carga de módulos. Tareas largas que ocurren solo en el navegador (por ejemplo, leer un Excel muy grande) ya tienen su propio mensaje en la pantalla correspondiente.
- Los botones que guardan siguen mostrando "Guardando…" y se desactivan mientras trabajan; la barra global se suma a eso, no lo reemplaza.
