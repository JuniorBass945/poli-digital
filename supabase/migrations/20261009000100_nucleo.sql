-- =====================================================================
-- Poli Digital · Fase 0 · Núcleo de datos
--
-- Reglas de diseño:
--  * Todo cuelga de un centro (centro_id): el sistema nace multicentro.
--  * Lo académico cuelga de un año escolar: así se puede cerrar el año
--    y promover de grado sin perder historial.
--  * Nada se borra: las bajas son lógicas (activo = false).
--  * Cada tabla nueva (en cualquier fase) debe activar RLS. Ver docs/ARQUITECTURA.md.
-- =====================================================================

create schema if not exists app;

create type public.app_role as enum
  ('admin', 'direccion', 'coordinacion', 'docente', 'orientacion', 'tutor');

create or replace function app.tocar_actualizado() returns trigger
language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

-- ---------- Centros y personas con acceso ----------
create table public.centros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text unique,
  zona_horaria text not null default 'America/Santo_Domingo',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Un perfil por cada usuario que puede entrar al sistema (auth.users).
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  centro_id uuid not null references public.centros (id),
  rol public.app_role not null,
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index perfiles_centro_idx on public.perfiles (centro_id);

-- Docentes: pueden existir antes de tener usuario (perfil_id vacío).
create table public.docentes (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  perfil_id uuid unique references public.perfiles (id) on delete set null,
  nombre text not null,
  correo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index docentes_centro_idx on public.docentes (centro_id);

-- ---------- Estructura académica ----------
create table public.anios_escolares (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  nombre text not null,
  inicio date not null,
  fin date not null,
  actual boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (centro_id, nombre),
  check (fin > inicio)
);
create unique index anios_actual_unico on public.anios_escolares (centro_id) where actual;

create table public.periodos (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  anio_escolar_id uuid not null references public.anios_escolares (id) on delete cascade,
  numero smallint not null check (numero between 1 and 8),
  nombre text not null,
  inicio date,
  fin date,
  cerrado boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (anio_escolar_id, numero)
);
create index periodos_centro_idx on public.periodos (centro_id);

-- Catálogo de materias del centro (no depende del año).
create table public.materias (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  nombre text not null,
  codigo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (centro_id, nombre)
);
create index materias_centro_idx on public.materias (centro_id);

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  anio_escolar_id uuid not null references public.anios_escolares (id),
  grado text not null,
  seccion text not null,
  especialidad text,
  guia_id uuid references public.docentes (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, anio_escolar_id)
);
create unique index aulas_unica_idx
  on public.aulas (anio_escolar_id, grado, seccion, coalesce(especialidad, ''));
create index aulas_centro_idx on public.aulas (centro_id);

-- Asignación = aula + materia + docente. Es la pieza central: la asistencia
-- y las notas de las siguientes fases cuelgan de aquí ("clase de trabajo").
create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  materia_id uuid not null references public.materias (id),
  docente_id uuid not null references public.docentes (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (aula_id, materia_id)
);
create index asignaciones_centro_idx on public.asignaciones (centro_id);
create index asignaciones_docente_idx on public.asignaciones (docente_id);

-- ---------- Estudiantes, matrícula y tutores ----------
create table public.estudiantes (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  matricula text not null,
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date,
  activo boolean not null default true,
  baja_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (centro_id, matricula)
);
create index estudiantes_centro_idx on public.estudiantes (centro_id);

-- Un estudiante se matricula en un aula por año (la clave compuesta garantiza
-- que el año de la matrícula sea el mismo año del aula).
create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  estudiante_id uuid not null references public.estudiantes (id),
  aula_id uuid not null,
  anio_escolar_id uuid not null,
  estado text not null default 'activa' check (estado in ('activa', 'retirada', 'promovida')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (estudiante_id, anio_escolar_id),
  foreign key (aula_id, anio_escolar_id) references public.aulas (id, anio_escolar_id)
);
create index matriculas_centro_idx on public.matriculas (centro_id);
create index matriculas_aula_idx on public.matriculas (aula_id);
create index matriculas_estudiante_idx on public.matriculas (estudiante_id);

create table public.tutores (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  perfil_id uuid unique references public.perfiles (id) on delete set null,
  nombre text not null,
  parentesco text,
  telefono text,
  correo text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index tutores_centro_idx on public.tutores (centro_id);

-- Un tutor puede tener varios estudiantes y un estudiante varios tutores.
create table public.estudiante_tutor (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  estudiante_id uuid not null references public.estudiantes (id),
  tutor_id uuid not null references public.tutores (id),
  principal boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (estudiante_id, tutor_id)
);
create index estudiante_tutor_centro_idx on public.estudiante_tutor (centro_id);
create index estudiante_tutor_tutor_idx on public.estudiante_tutor (tutor_id);

-- Consentimiento de cada tutor para recibir mensajes por canal.
create table public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  tutor_id uuid not null references public.tutores (id),
  canal text not null check (canal in ('whatsapp', 'sms', 'correo')),
  otorgado boolean not null default false,
  otorgado_en timestamptz,
  verificado boolean not null default false,
  evidencia text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tutor_id, canal)
);
create index consentimientos_centro_idx on public.consentimientos (centro_id);

-- ---------- Banderas de módulos y eventos ----------
-- Qué módulos están activos para cada centro. Permite desplegar por partes.
create table public.modulos_activos (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  modulo text not null,
  activo boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (centro_id, modulo)
);

-- Bandeja de eventos entre módulos (p. ej. "estudiante_ausente"). Solo la usan
-- funciones del servidor; los clientes no tienen acceso.
create table public.eventos (
  id bigint generated always as identity primary key,
  centro_id uuid not null references public.centros (id),
  tipo text not null,
  payload jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  procesado_en timestamptz
);
create index eventos_pendientes_idx on public.eventos (creado_en) where procesado_en is null;

-- Registro de auditoría (se llena solo, ver migración de auditoría).
create table public.auditoria (
  id bigint generated always as identity primary key,
  centro_id uuid,
  tabla text not null,
  registro_id text not null,
  operacion text not null,
  usuario_id uuid,
  rol public.app_role,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
create index auditoria_centro_idx on public.auditoria (centro_id, creado_en desc);

-- ---------- Marca de tiempo automática ----------
do $$
declare t text;
begin
  foreach t in array array[
    'centros', 'perfiles', 'docentes', 'anios_escolares', 'periodos', 'materias', 'aulas',
    'asignaciones', 'estudiantes', 'matriculas', 'tutores', 'estudiante_tutor',
    'consentimientos', 'modulos_activos'
  ] loop
    execute format(
      'create trigger tocar_actualizado before update on public.%I
         for each row execute function app.tocar_actualizado()', t);
  end loop;
end $$;
