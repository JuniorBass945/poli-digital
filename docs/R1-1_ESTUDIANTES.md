# R1 · Administración, parte 1: Estudiantes

## Qué incluye
- Lista de estudiantes con búsqueda (sin importar tildes ni mayúsculas), filtro por aula y opción de ver a los dados de baja.
- **Registrar** un estudiante con su matrícula en un aula y su tutor (nuevo, o uno ya registrado). El permiso de WhatsApp del tutor queda pendiente.
- **Editar** sus datos, cambiarlo de aula (dentro del mismo año escolar) y editar los datos de su tutor.
- **Dar de baja** con un motivo de una lista y una nota (la nota es obligatoria si el motivo es "Otro"). No se borra nada.
- **Reactivar** a quien se dio de baja por error.
- Todo queda en la auditoría, con quién lo hizo.

## Decisiones tomadas
- La matrícula se escribe a mano y es obligatoria. Debe ser única en el centro.
- Las bajas piden confirmación con un motivo predeterminado; nunca se elimina un registro.
- Cada operación se hace completa o no se hace (una sola transacción en la base de datos).
- Solo el rol de administración puede registrar, editar, dar de baja y reactivar.

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` de este zip dentro de tu proyecto `poli-digital`. Acepta reemplazar cuando pregunte: solo cambia `src/ui/index.tsx`.
2. Aplica la migración nueva: `npx supabase db push`.
3. En Supabase, SQL Editor: pega y ejecuta `supabase/tests/admin_estudiantes.sql`. Debe terminar con **TODAS LAS PRUEBAS DE ESTUDIANTES PASARON**. (Las pruebas no dejan datos.)
4. En la terminal: `npm test` y luego `npm run build`.
5. `npm run dev`, entra con `admin@polidemo.test` y abre **Gestión de datos**.
6. Si todo está bien: `git add .`, `git commit -m "R1: estudiantes"`, `git push`. Cloudflare publica solo.

## Lista de pruebas manuales
- [ ] La lista muestra los 36 estudiantes de demostración.
- [ ] Buscar "perez" encuentra a quien se apellide Pérez.
- [ ] Registrar un estudiante con tutor nuevo: aparece en la lista y en su aula.
- [ ] Registrar con la misma matrícula: muestra "Ya existe un estudiante con esa matrícula."
- [ ] Registrar con un tutor que ya existe (por ejemplo "Marisol Tavárez"): el tutor queda con dos estudiantes.
- [ ] Editar: cambiar de aula y el teléfono del tutor.
- [ ] Dar de baja con "Traslado": desaparece de la lista; con "Mostrar dados de baja" aparece con su motivo.
- [ ] "Otro" sin nota: el botón queda desactivado.
- [ ] Reactivar: vuelve a la lista.
- [ ] Entra como `docente@polidemo.test`: no ve el módulo Gestión de datos, y un estudiante dado de baja ya no aparece en su conteo.
- [ ] En Supabase, Table Editor, tabla `auditoria`: aparecen los cambios hechos.

## Límites conocidos
- La lista carga hasta 1,000 estudiantes de una vez; para centros más grandes se agregará paginación en el servidor.
- Cambiar de año escolar (promoción de grado) se hará en otra parte; hoy solo se permite mover entre aulas del mismo año.
- Cambiar al estudiante a **otro** tutor se hará desde la pestaña Tutores (parte siguiente).

## Registro de horas de esta parte
Anota en `docs/REGISTRO_HORAS.md` (o en el Excel) el tiempo que te tome: aplicar, probar y pedir ajustes. Estimado original de toda la gestión de estudiantes: 7 a 11 horas.
