# Poli Digital

Sistema de gestión para un politécnico. Esta es la **Fase 0**: la base técnica sobre la que se construyen
todos los módulos, uno por entrega.

**Qué incluye**
- Base de datos en Supabase con el núcleo del sistema (centros, usuarios y roles, años escolares, aulas, materias,
  asignaciones docente, estudiantes, matrículas, tutores, consentimientos), pensada para varios centros.
- Seguridad por fila: cada rol ve solo lo que le corresponde (el docente su aula, el tutor sus hijos).
- Auditoría automática de cambios.
- Aplicación web (React, Vite, Tailwind, TypeScript) con login, menú por rol y **módulos que se activan por bandera**.
- Los módulos aún no construidos aparecen como marcadores ("En construcción") con su entrega prevista.
- Pruebas de seguridad (SQL) y pruebas de la aplicación.

Más detalle del diseño en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Para ir midiendo tiempos: [`docs/REGISTRO_HORAS.md`](docs/REGISTRO_HORAS.md).

---

## Puesta en marcha en Windows (PowerShell)

Requisitos: Node.js (LTS reciente), Git y una cuenta de Supabase (un proyecto **nuevo**, solo para este sistema).
No hace falta Docker.

### 1. Instalar dependencias
```powershell
npm install
```

### 2. Conectar la aplicación a tu proyecto de Supabase
```powershell
Copy-Item .env.example .env.local
```
Abre `.env.local` y completa los dos valores (Supabase → **Project Settings → API**): la URL del proyecto y la
clave pública (`anon` o `publishable`). **Nunca** pongas la clave `service_role` aquí.

### 3. Crear las tablas (migraciones)
Una "migración" es un archivo SQL que crea o cambia tablas. Están en `supabase/migrations/`.
```powershell
npx supabase login
npx supabase init          # responde N si pregunta por configuración de VS Code o IntelliJ
npx supabase link --project-ref TU_REF
npx supabase db push
```
`TU_REF` es el código de tu proyecto (la parte de la URL antes de `.supabase.co`). Te pedirá la contraseña de la
base de datos que definiste al crear el proyecto.

> Regla de oro: **no cambies tablas a mano desde el panel web**. Todo cambio va en un archivo nuevo dentro de
> `supabase/migrations/` y se aplica con `npx supabase db push`.

### 4. Cargar datos de demostración
En Supabase abre **SQL Editor**, pega el contenido de `supabase/seed.sql` y ejecútalo. Crea el "Politécnico Demo"
con 3 aulas, 8 docentes, 36 estudiantes y sus tutores.

### 5. Crear usuarios de prueba
1. En Supabase → **Authentication → Users → Add user**, crea estos 6 correos con una contraseña de desarrollo
   (marca *Auto Confirm User*): `admin@`, `direccion@`, `coordinacion@`, `docente@`, `orientacion@` y `tutor@`
   seguidos de `polidemo.test`.
2. En **SQL Editor** pega y ejecuta `supabase/seed_usuarios.sql`: asigna a cada usuario su rol y centro.

### 6. Probar la seguridad
En **SQL Editor** pega y ejecuta `supabase/tests/rls.sql`. Debe terminar mostrando **TODAS LAS PRUEBAS PASARON**.
No deja datos (hace ROLLBACK). Si algo falla, el mensaje dice qué regla se rompió.

### 7. Correr la aplicación
```powershell
npm run dev
```
Abre `http://localhost:5173` y entra con `docente@polidemo.test`, `tutor@polidemo.test`, etc.
En la página de inicio verás cuántos estudiantes, tutores, docentes y aulas devuelve la base **para ese usuario**:
el docente ve 12 estudiantes (los de su aula) y el tutor ve 2 (sus hijos). Esa es la seguridad por fila funcionando.

---

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa los tipos y genera la versión final en `dist/` |
| `npm test` | Pruebas de la aplicación |
| `npm run typecheck` | Solo revisión de tipos |
| `npm run db:push` | Aplica las migraciones pendientes al proyecto enlazado |
| `npm run db:types` | Genera los tipos TypeScript desde la base (`src/lib/database.types.ts`) |

## Publicar en Cloudflare Pages
1. Sube el proyecto a un repositorio privado de GitHub (`git init`, `git add .`, `git commit`, `git push`).
2. En Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, elige el repositorio.
3. Comando de compilación: `npm run build`. Carpeta de salida: `dist`.
4. En **Environment variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. En Supabase → **Authentication → URL Configuration**, agrega la dirección publicada como *Site URL*.

Cada `git push` publica solo. La app usa rutas por `#`, así que no necesita configuración extra del servidor.

## Qué falta (a propósito)
Esta fase no incluye los módulos de negocio (asistencia, calificaciones, etc.): vienen por entregas, ver `docs/ARQUITECTURA.md`.
Tampoco incluye aún la función del servidor para **invitar usuarios desde el sistema**; por ahora los usuarios se crean en el
panel de Supabase.

## Honestidad sobre lo probado
Las migraciones, los datos de demostración y las pruebas de seguridad se ejecutaron en una base PostgreSQL local con una
simulación del esquema `auth` de Supabase (no contra un proyecto real de Supabase). La aplicación se probó con un cliente
Supabase simulado. El primer paso con tu proyecto real es el punto 6: si alguna prueba falla allí, pásame el mensaje.
