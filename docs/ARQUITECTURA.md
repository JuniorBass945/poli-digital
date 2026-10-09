# Arquitectura: trabajar por fases y desplegar por partes

## Idea central
El sistema completo se construye en **entregas** (R1 a R8). Cada una agrega piezas sin rehacer las anteriores. Esto se logra
con cuatro decisiones que ya están en la base:

1. **Núcleo de datos completo desde el inicio.** Las fases solo agregan tablas que apuntan al núcleo.
2. **Banderas por centro** (`modulos_activos`): un módulo puede estar en el código pero oculto hasta activarlo.
3. **Módulos independientes** en el frontend, cada uno en su carpeta y con carga diferida.
4. **Eventos entre módulos** (`eventos`) en vez de que se llamen entre sí.

## Mapa del proyecto
```
src/
  app/            Shell (menú por rol), login, inicio, marcadores de "en construcción"
  auth/           Sesión, perfil (rol y centro) y banderas activas
  lib/            Cliente de Supabase, roles, utilidades
  modules/        UNA CARPETA POR MÓDULO + registry.ts (el catálogo)
  ui/             Piezas de interfaz comunes (colores y tipografía vienen de index.css)
supabase/
  migrations/     Cambios de base de datos, en orden. Una entrega = una o más migraciones
  seed.sql        Datos de demostración
  seed_usuarios.sql  Vincula usuarios de prueba con su rol
  tests/rls.sql   Pruebas de seguridad por rol
```

## Modelo de datos del núcleo
- `centros` → todo lo demás lleva `centro_id`. Un usuario solo ve su centro.
- `perfiles` (un usuario con su rol) · `docentes` · `tutores` (pueden existir antes de tener usuario).
- `anios_escolares` → `periodos` · `aulas` (por año) · `materias` (catálogo).
- **`asignaciones` = aula + materia + docente.** Es la "clase de trabajo": la asistencia y las notas de las siguientes entregas cuelgan de aquí.
- `estudiantes` · `matriculas` (estudiante + aula + año) · `estudiante_tutor` · `consentimientos` (por canal).
- `modulos_activos` (banderas) · `eventos` (bandeja entre módulos, solo servidor) · `auditoria` (automática).

Nada se borra: las bajas son lógicas (`activo = false`). Todo lo académico cuelga del año escolar, así el cierre de año
y la promoción de grado no pierden historial.

## Seguridad
- Todo se **niega por defecto**: `anon` no accede a nada y cada tabla tiene RLS activado.
- El rol sale del perfil del usuario, nunca del navegador.
- La clave `service_role` jamás va en el frontend. Las tareas que la necesiten (enviar WhatsApp, invitar usuarios,
  generar boletines) serán funciones del servidor.
- `supabase/tests/rls.sql` verifica que cada rol vea lo que debe y que **ninguna tabla pública quede sin RLS**.

## Cómo agregar un módulo (checklist)
**Base de datos**
1. Nueva migración en `supabase/migrations/` con prefijo de fecha (`AAAAMMDDHHMMSS_nombre.sql`).
2. Cada tabla: `centro_id`, marcas de tiempo, `enable row level security`, políticas por rol y el trigger `auditar`
   si el cambio debe quedar registrado (ver `20261009000300_auditoria.sql`).
3. Cambios compatibles hacia atrás: primero **agregar**, luego usar, y recién después retirar lo viejo.
4. Ampliar `supabase/tests/rls.sql` con los permisos del módulo.

**Frontend**
5. Reemplazar el marcador de `src/modules/<id>/index.tsx` por el módulo real (su propio acceso a datos y rutas internas).
6. Ajustar su entrada en `src/modules/registry.ts` (roles y entrega) y su prueba en `registry.test.ts`.

**Despliegue**
7. `npx supabase db push` (migraciones) y `git push` (web). El módulo sigue oculto.
8. Activar la bandera para el centro: `update modulos_activos set activo = true where modulo = '...' and centro_id = '...';`

## Entornos
- **Desarrollo:** un proyecto de Supabase de pruebas y `npm run dev`.
- **Producción:** otro proyecto de Supabase, con sus propias variables en Cloudflare Pages. Se recomienda no probar
  directamente en el proyecto del cliente.

## Entregas planificadas
| Entrega | Contenido | Bandera |
|---|---|---|
| R1 | Gestión de datos (con importación desde Excel), clase de trabajo y asistencia, aviso con enlace de WhatsApp, panel de asistencia | `administracion`, `asistencia`, `avisos` |
| R2 | Envío automático por WhatsApp (API oficial) | canal `whatsapp_api` |
| R3 | Calificaciones, períodos y boletines con QR | `calificaciones` |
| R4 | Actividades evaluativas | `actividades` |
| R5 | Orientación y psicología | `orientacion` |
| R6 | Portal de tutores | `portal` |
| R7 | Panel de estadísticas y planificación docente | `estadisticas`, `planificacion` |
| R8 | Estabilización final | todas |

## Eventos entre módulos (patrón)
Asistencia no llama a comunicación. Al guardar la lista inserta un evento `estudiante_ausente` en `eventos`; un proceso del
servidor lo consume y arma el aviso. Así el aviso automático se agrega sin tocar asistencia.

## Cola de mensajes con canal intercambiable (R1 → R2)
La cola guarda el canal (`enlace_manual`, `whatsapp`, `correo`, `sms`). En R1 el docente envía con un enlace `wa.me`; en R2 un
proceso del servidor envía por la API oficial. El flujo, la tabla y las pantallas son los mismos.
