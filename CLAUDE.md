# Poli Digital: contexto del proyecto

Este archivo guarda lo que Claude necesita saber para continuar el proyecto aunque la conversación se compacte
o se cambie de herramienta. Mantenerlo al día al cerrar cada parte. Responder siempre en español.

## Qué es
Sistema de gestión para un politécnico de República Dominicana. Lo desarrolla **Junior** (desarrollador independiente,
Windows, VS Code) junto con Claude, y piensa venderlo a este y otros centros. El centro aún **no tiene nombre
definido para el sistema ni dominio propio**.

## Decisiones del usuario (no cambiar sin preguntar)
- **Por fases, desplegando por partes.** Entregas R1 a R8 (ver `docs/ARQUITECTURA.md`). Cada parte se prueba y se publica sola.
- **Roles bien separados:** admin, dirección, coordinación académica, docente, orientación y psicología. Cada uno ve solo lo suyo.
  Dirección ve estadísticas, no edita notas. Las notas psicológicas son confidenciales (solo orientación).
- **El docente elige primero aula y materia (su "clase de trabajo")** antes de pasar lista, calificar, avisar o remitir.
- **Los padres o tutores NO tienen cuenta.** Solo reciben avisos por WhatsApp y, de forma opcional, consultan un **portal público**
  con cédula + código de consulta generado por el sistema (distinto de la matrícula, asociado al tutor, muestra a todos sus hijos).
  Es de solo lectura y se verifica en el servidor. Debe ser lo más fácil posible (muchos padres manejan poco la tecnología).
  **Pendiente: se retoma más adelante.** Sin decidir: si todos los tutores tienen cédula (pasaporte u otros documentos).
- **El costo de WhatsApp lo paga el centro aparte**, con su propia cuenta de Meta.
- Aviso de ausencia: primero con enlace de WhatsApp manual (`wa.me`), luego envío automático por la API oficial.
- **Evaluación por asignatura, mínimo de aprobación 70.** Evaluación continua con actividades (versión mínima en la demo).
  Sin confirmar con el centro: pendientes/completivas, nota del período a partir de actividades, planificación docente.
- **Gestión de estudiantes:** matrícula manual y obligatoria, única por centro. La baja pide confirmación con un desplegable de motivos
  predeterminados ("Otro" exige nota). Nada se borra: las bajas son lógicas y se pueden reactivar.
- **Diseño:** plantilla A (azul institucional). Tipografía Lexend, tokens de color en `src/index.css`, tema claro por defecto
  (interruptor para oscuro), tarjetas de 18 px, textos en español sencillo.

## Stack y servicios
- Web: React 19 + Vite + TypeScript + Tailwind v4 (`@tailwindcss/vite`). Ruteo por hash (`#/modulo`). Pruebas con Vitest.
- Base de datos y login: **Supabase** (proyecto de desarrollo creado por el usuario; plan gratis por ahora, Pro cuando entren datos reales).
  Sin Docker: el usuario aplica migraciones con `npx supabase db push` y usa el SQL Editor del panel web.
- Publicación: **Cloudflare** (Workers con archivos estáticos, desde GitHub; compila con `npm run build`; variables `VITE_*` como variables de
  compilación normales). Repositorio privado `poli-digital` en GitHub; CI en verde.
- Entorno del usuario: Windows + PowerShell + VS Code, Node 24, Git. Usa cuentas personales por ahora; a la larga dominio y Meta a nombre del centro.

## Estado actual
- **Fase 0 completa y en producción:** 3 migraciones (núcleo, seguridad RLS, auditoría), datos de demostración, login, menú por rol, banderas de módulos.
- **R1 parte 1 completa y en producción:** módulo Administración → Estudiantes (crear con tutor y matrícula, editar, cambiar de aula, dar de baja, reactivar).
  Migración `20261010000100_admin_estudiantes.sql` y pruebas SQL `supabase/tests/admin_estudiantes.sql`.
- **R1 parte 2 completa y en producción:** Administración → Docentes, Materias, Aulas y Asignaciones (docente + materia + aula).
  Migración `20261011000100_admin_estructura.sql`, pruebas `supabase/tests/admin_estructura.sql`, guía `docs/R1-2_ESTRUCTURA.md`.
  Las tablas de administración usan filas de 60 px de alto mínimo (`h-15`) y botones de acción separados 10 px (`gap-2.5`).
- **Importación de estudiantes desde Excel: generada y probada en el sandbox; falta que el usuario la aplique y confirme** (migración `20261012000100_importar_estudiantes.sql`,
  pruebas `supabase/tests/importar_estudiantes.sql`, guía `docs/R1-4_IMPORTACION.md`, plantilla `public/plantilla_importacion_estudiantes.xlsx`, ejemplo simulado
  `docs/ejemplos/estudiantes_simulados.xlsx`, limpieza `supabase/scripts/limpiar_estudiantes_simulados.sql`). Usa la dependencia `read-excel-file`.
  **Decisión del usuario:** seguir con un Excel simulado hasta que el centro entregue el oficial; entonces se ajustan columnas y reglas.
- **Clase de trabajo, asistencia y avisos a tutores: generados y probados en el sandbox; falta que el usuario los aplique y confirme**
  (migración `20261013000100_asistencia_avisos.sql`, pruebas `supabase/tests/asistencia.sql`, guía `docs/R1-5_ASISTENCIA.md`).
  Tablas `asistencia_sesiones`, `asistencias` y `mensajes` (cola de avisos con canal intercambiable: hoy `whatsapp_enlace`, luego `whatsapp_api`).
  Escritura solo con las funciones `guardar_asistencia` y `gestionar_aviso` (security definer, comprueban rol, clase y fecha); el cliente solo lee.
  Módulos `src/modules/asistencia` y `src/modules/avisos`; ayudas en `src/lib` (`claseTrabajo`, `fechas`, `whatsapp`).
  **Supuestos que hay que confirmar con el centro:** un aviso por estudiante y día; lo envía el docente que pasó lista; el docente corrige hasta 3 días atrás;
  tardanza y excusa no generan aviso; el consentimiento de WhatsApp aún no se exige (será obligatorio en R2).
- Usuarios de prueba (contraseña de desarrollo definida por el usuario): `admin@`, `direccion@`, `coordinacion@`, `docente@`, `orientacion@`, `tutor@` + `polidemo.test`.
  Hay que borrarlos o cambiar sus contraseñas antes de cargar datos reales, y separar un proyecto de Supabase de producción.
- Registro abierto de usuarios desactivado en Supabase Auth.
- La **demo** (React en JavaScript, datos ficticios) vive aparte: `poli-digital-demo-proyecto.zip` y `poli-digital-demo.html` en la carpeta de salidas.

## Pendiente, en el orden previsto
1. Siguiente de Administración: pestaña **Tutores** (editar datos y registrar el consentimiento de WhatsApp). Cuando llegue el Excel oficial, adaptar la importación.
2. Función del servidor para invitar usuarios del personal (necesita correo propio y dominio).
3. Panel de asistencia (historial y estadísticas); luego despliegue con datos reales y capacitación, que cierran R1.
4. R2 WhatsApp automático (la verificación de Meta tarda de 2 a 7 días: tramitarla pronto). R3 calificaciones y boletines con QR.
   R4 actividades. R5 orientación. R6 portal público. R7 estadísticas y planificación. R8 estabilización.
- Por confirmar con el centro: nombre y dominio, Excel real, reglas de evaluación y pendientes, planificación docente, tutores sin cédula.

## Arquitectura (resumen; detalle en `docs/ARQUITECTURA.md`)
- Multicentro: toda tabla lleva `centro_id`. Lo académico cuelga de `anios_escolares`. **`asignaciones` = aula + materia + docente** es la pieza central.
- Seguridad por fila (RLS) en **todas** las tablas, todo negado por defecto; el rol sale de `perfiles`. `anon` no accede a nada.
  El docente ve su aula, el tutor (cuando exista portal) solo a sus hijos; `eventos` solo lo usa el servidor.
- Auditoría automática por trigger (`app.auditar`). Banderas por centro en `modulos_activos`. Eventos entre módulos en `eventos`.
- Operaciones compuestas como funciones SQL en una transacción (`security invoker`, exigen rol admin con `app.exigir_admin`), llamadas con `supabase.rpc`.
  Excepción: las de asistencia y avisos son `security definer` porque el docente no tiene permisos de escritura directos; validan rol, propiedad de la clase y fecha dentro de la función.
- Módulos del frontend: una carpeta por módulo en `src/modules/<id>/`, registrados en `src/modules/registry.ts`, con carga diferida.

## Convenciones
- Migraciones nuevas en `supabase/migrations/AAAAMMDDHHMMSS_nombre.sql`. **Nunca cambiar tablas a mano en el panel.**
- Cada tabla nueva: `centro_id`, marcas de tiempo, `enable row level security`, políticas por rol y trigger de auditoría. Funciones nuevas: quitar `execute` a `public` y `anon`.
- Cada parte trae pruebas SQL (en una transacción con ROLLBACK, ejecutables en el SQL Editor) y pruebas de la app. `npm run build` ya revisa los tipos.
- Identificadores en español sin tildes (`anios_escolares`, `estudiante_tutor`); textos de interfaz en español con tildes.
- Nunca poner la clave `service_role` ni la contraseña de la base de datos en el frontend, el repositorio o el chat. La clave `anon` es pública por diseño.
- Cada cambio de comportamiento se documenta en `docs/` y se anota el tiempo real en `docs/REGISTRO_HORAS.md` o en el Excel del plan.

## Cómo se entrega hoy (modo chat)
Claude genera los archivos nuevos o cambiados en un zip con la misma estructura de carpetas; el usuario los copia sobre el proyecto,
corre `npx supabase db push`, pega la prueba SQL en el SQL Editor, corre `npm test` y `npm run build`, prueba en pantalla y hace `git push`.
Antes de entregar, Claude prueba en su sandbox: PostgreSQL 16 local con roles `anon`/`authenticated`/`service_role` y un esquema `auth` simulado
(`auth.users`, `auth.uid()`), y valida el paquete aplicándolo sobre el zip original. Esas pruebas no sustituyen las del Supabase real.
El usuario ya usa **Claude Code en VS Code** para cambios directos en el repositorio (ver la sección siguiente); este chat se mantiene para diseñar, estimar y validar SQL en un PostgreSQL local.

## Reglas al trabajar con Claude Code en VS Code
- Empezar cada sesión leyendo este archivo y `docs/`, y correr `git status`, `npm test` y `npm run build` para confirmar el estado.
- **Una rama por tarea** (`git switch -c r1-tutores`). Mostrar un plan corto y esperar aprobación antes de editar (modo Plan o Manual).
- **No ejecutar** `npx supabase db push` ni `git push`, y no leer ni editar `.env*`: eso lo hace el usuario. Nunca pedir ni guardar la clave `service_role` ni la contraseña de la base de datos.
- Todo cambio de base de datos es una migración nueva (nunca editar migraciones ya aplicadas), con su prueba SQL. No hay base local para validar el SQL: escribirlo con cuidado, decir qué verificar y, si hace falta, pedir que el usuario lo ejecute en el SQL Editor o lo traiga al chat para validarlo.
- Al terminar: `npm test`, `npm run build`, commit en la rama con mensaje claro (título y descripción), y listar los pasos exactos que debe hacer el usuario (aplicar migración, ejecutar la prueba SQL, probar en pantalla).
- Documentar en `docs/` y actualizar este archivo (estado y pendientes). Recordar al usuario que anote su tiempo de ejecución y el de conversación.
- No agregar servidores MCP ni accesos con permisos sobre producción sin preguntar.

## Costos y estimaciones (para no recalcular)
- Infraestructura sin mano de obra: US$0 en desarrollo; unos US$25 a 55 al mes en producción (Supabase Pro, correo, dominio ≈ US$10 al año). WhatsApp aparte.
- Plan por fases en `poli_digital_plan_por_fases.xlsx` (horas reales frente a estimadas, proyección y precio mínimo).
  Estimado original 269 a 422 h; mediciones del usuario (solo ejecución): Fase 0 ≈ 2.33 h, R1 parte 1 ≈ 0.33 h. Proyección con 30 % de peso: 186 a 290 h.
  **Cotizar al cliente con el estimado original**, no con la proyección. Falta medir el tiempo de conversar y decidir.
- Se recomendó una mensualidad mínima de mantenimiento de unos US$86 a 151 y precio de implementación por entregas.

## Estilo de trabajo con el usuario
- Quiere opinión y recomendaciones claras, pasos numerados con comandos de PowerShell y mensajes cortos. Suele decir "hazlo como recomiendas".
- Confirma resultados pegando la salida de la terminal; ante un error, pedir el mensaje exacto.
- Mide sus tiempos; seguir pidiéndolos al terminar cada parte.
