# R1 · Parte 10 · Accesos de usuarios del personal

## Qué trae
Desde **Gestión de datos > Accesos** la administración crea a cada persona del personal **sin depender de correos ni dominios**, al estilo de un directorio corporativo:

- **Usuario único** (ej. `cpena`). No se puede repetir ni siquiera cambiando mayúsculas. Solo sirve para iniciar sesión.
- **Clave temporal** generada por el sistema (`Kp7m-Qx4t-Hn2w`) **o escrita a mano por la administración** (opción "Escribirla yo", al crear y al restablecer: mínimo 8 caracteres con letras y números, distinta del usuario). Se muestra **una sola vez**, vence a los **7 días** y obliga a crear una clave propia en el primer ingreso.
- **Nombre en pantalla:** al entrar, el sistema saluda con el nombre de la persona ("Hola, Prof. Carmen Peña"), nunca con el usuario.
- **Varios roles por persona** con interruptores: Administración, Dirección, Coordinación, Docente, Orientación. Los permisos son la suma de sus roles.
  El **menú** suma los módulos de todos sus roles y el **Inicio** muestra una pestaña por rol.
- **Rol Docente:** al activarlo se elige el registro de docente existente (sin acceso todavía) o se crea uno nuevo. Quitar el rol suelta el vínculo pero **no borra** al docente ni sus clases.
- **Restablecer la clave** (clave temporal nueva), **quitar el acceso** (no borra nada; se puede reactivar) y **cambiar nombre y roles**.
- Todo queda en la **auditoría** (nunca se guardan claves).

## Reglas de seguridad (están en la base de datos, no solo en la pantalla)
- Mientras la persona no cambie su clave temporal, la base **no le entrega ningún dato** (ni su perfil). La pantalla "Elige tu clave" no es la única barrera.
- "Cambiar la clave" se comprueba de verdad: la base compara la contraseña actual con la temporal; no basta con apretar un botón.
- Clave temporal vencida: no sirve; la administración genera otra.
- Nunca queda un centro sin administrador. Nadie se quita su propio rol de Administración, ni su acceso, ni restablece su propia clave.
- Los tutores no tienen acceso al sistema (no se les puede dar un rol).
- La llave `service_role` (la que permite crear cuentas con contraseña) vive **solo** en la función del servidor `accesos`, que Supabase le entrega sola. No la copies en ningún lado.
- Los usuarios de demostración (con correo) siguen entrando igual: en el login se puede escribir un correo completo.

## Cómo aplicarlo
1. Copia las carpetas `src`, `supabase` y `docs` del zip dentro de tu proyecto y `CLAUDE.md` a la raíz. Acepta reemplazar. Cambian: `src/auth/AuthProvider.tsx`, `src/app/{App,Inicio,Login,Shell}.tsx`,
   `src/lib/roles.ts`, `src/modules/registry.ts` y `src/modules/administracion/api.ts`.
2. **No reemplaza `src/modules/administracion/index.tsx`** (para no pisar tus cambios). Hazle estos 3 cambios, o dale a Claude Code el prompt que está más abajo:
   ```tsx
   import Accesos from './Accesos';                      // 1) con los demás imports
   { id: 'accesos', etiqueta: 'Accesos' },               // 2) en la lista de tabs, al final
   {tab === 'accesos' && <Accesos />}                    // 3) junto a los demás {tab === ... && ...}
   ```
3. `npx supabase db push` (1 migración nueva: `20261017000100_accesos`).
4. **Desplegar la función del servidor** (una sola vez, y de nuevo solo si cambia su código):
   ```powershell
   npx supabase functions deploy accesos
   ```
   Si te dice que necesita Docker, usa `npx supabase functions deploy accesos --use-api`. Si pide el proyecto, es el mismo que enlazaste para `db push`.
   No hay que crear ni pegar ninguna clave: la función recibe `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` de Supabase automáticamente.
5. En el SQL Editor ejecuta `supabase/tests/accesos.sql`. Debe terminar con **TODAS LAS PRUEBAS DE ACCESOS PASARON** (75 comprobaciones; esta parte no cambia la base de datos). Luego vuelve a correr `supabase/tests/rls.sql` y `supabase/tests/rendimiento.sql`: deben pasar **igual que antes** (esta migración cambia las funciones de seguridad).
6. (Recomendado) En el panel de Supabase, **Authentication**, busca la opción de longitud mínima de contraseña ("Minimum password length") y ponla en **8**. La app ya lo exige, esto lo refuerza en el servidor. Si no la encuentras, no pasa nada.
7. `npm test` (212 pruebas) y `npm run build`.
8. `npm run dev` y prueba (lista de abajo).
9. `git add .`, `git commit`, `git push`.

**Prompt para Claude Code (solo el cambio de `index.tsx`):**
> En `src/modules/administracion/index.tsx` agrega la pestaña "Accesos": importa `Accesos` desde './Accesos', agrega `{ id: 'accesos', etiqueta: 'Accesos' }` al final de la lista de tabs y `{tab === 'accesos' && <Accesos />}` junto a los demás. No cambies nada más. Corre `npm test` y `npm run build` y dime si pasan. No hagas commit ni push.

## Lista de pruebas manuales
- [ ] Con `admin@polidemo.test`: Gestión de datos > Accesos muestra las 6 personas de demostración (con "Correo: ..."). En tu fila no aparecen "Clave" ni "Quitar".
- [ ] **Nuevo acceso:** escribe "Prof. Prueba Uno" y sal del campo: propone `puno` (o similar). Activa **Docente** y **Orientación**: aparece el selector de docente; elige "Crear un registro de docente nuevo". Crea. Sale la clave temporal y un mensaje listo para copiar. Cierra el cuadro: la clave ya no se vuelve a ver.
- [ ] **Clave manual:** crea otro acceso con "Escribirla yo": una clave corta o sin números se rechaza; una buena (ej. `Escuela2026`) se acepta, se muestra en el cuadro final y esa persona entra con ella y debe cambiarla igual. Haz lo mismo en "Clave" (restablecer).
- [ ] **Primer ingreso** (ventana privada): entra con el usuario y la clave temporal. Aparece "Elige tu clave". Prueba una clave corta, otra sin números y dos que no coincidan: cada una da su aviso. Pon una buena: entra y saluda con el **nombre** (no con el usuario).
- [ ] Esa persona ve en el menú Asistencia, Avisos y Seguimiento, y en Inicio **dos pestañas** (Docente y Orientación).
- [ ] **Usuario repetido:** crea otro con `PUNO` o `puno`: debe rechazarlo con un aviso. Con una tilde (`púno`) debe rechazarlo por formato.
- [ ] **Restablecer clave:** a esa persona, "Clave". Con la clave vieja ya no entra; con la nueva temporal entra y le vuelve a pedir cambiarla.
- [ ] **Quitar acceso:** ya no puede entrar ("Usuario o contraseña incorrectos"). Marca "Mostrar sin acceso": aparece con "Reactivar", que da otra clave temporal.
- [ ] **Roles:** en "Roles" de esa persona quita Docente: aparece el aviso de que el docente se conserva; guarda y revisa la pestaña Docentes (sigue ahí).
- [ ] En tu propia fila, "Roles" > apaga Administración y guarda: debe negarlo ("No puedes quitarte tu propio rol de administración").
- [ ] Los usuarios de demostración siguen entrando con su correo.
- [ ] Tabla `auditoria` en Supabase: aparecen las altas, los cambios de roles y los restablecimientos. Ninguna fila contiene claves.

## Límites conocidos
- Si quitas un acceso, la base le niega todo de inmediato, pero su sesión abierta puede seguir "viva" hasta una hora (no ve datos). Además se bloquea su cuenta, así que no puede volver a entrar.
- No hay "olvidé mi clave" automático (no hay correo): la administración restablece. Se puede agregar más adelante.
- El nombre de la persona en Accesos y el del registro de docente son independientes: si corriges uno, corrige el otro en Docentes.
- El primer administrador de un centro nuevo se crea una vez a mano (Authentication > Add user + `seed_usuarios.sql` o un SQL equivalente) y entra con su correo. Los demás se crean desde Accesos.
- El correo interno `usuario@poli.test` nunca se usa para enviar nada (`.test` es un dominio reservado). Si algún día se cambia, hay que editar `DOMINIO_INTERNO` en `src/lib/acceso.ts` **y** en `supabase/functions/accesos/index.ts` (una prueba avisa si no coinciden) y migrar las cuentas existentes.

## Qué sigue
Guías de uso por rol, lista de verificación de salida a producción (borrar los usuarios de demostración, proyecto de Supabase separado) y los pendientes del centro.

## Actualización: clave temporal manual
Si ya habías aplicado la parte 10, esta actualización solo cambia código (no hay migración nueva): copia los archivos del zip `poli-digital-r1-accesos-clave-manual`, **vuelve a desplegar la función** (`npx supabase functions deploy accesos`), corre `npm test` y `npm run build`.
