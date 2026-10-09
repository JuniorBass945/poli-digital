-- =====================================================================
-- Poli Digital · Fase 0 · Seguridad por fila (RLS)
--
-- Principio: todo se niega por defecto y se abre por rol. Un usuario solo
-- ve datos de su propio centro, y dentro del centro solo lo que su rol
-- necesita (el docente ve su aula, el tutor ve a sus hijos).
-- =====================================================================

-- ---------- Funciones auxiliares (no expuestas como API) ----------
create or replace function app.centro_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.centro_id from public.perfiles p where p.id = auth.uid() and p.activo
$$;

create or replace function app.rol_actual() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.rol from public.perfiles p where p.id = auth.uid() and p.activo
$$;

create or replace function app.tiene_rol(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.rol = any (roles) from public.perfiles p where p.id = auth.uid() and p.activo), false)
$$;

-- Aulas donde el usuario actual tiene alguna materia asignada.
create or replace function app.aulas_del_docente() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.aula_id
  from public.asignaciones a
  join public.docentes d on d.id = a.docente_id
  where d.perfil_id = auth.uid() and a.activo
$$;

-- Estudiantes matriculados en las aulas del docente actual.
create or replace function app.estudiantes_del_docente() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.estudiante_id
  from public.matriculas m
  where m.aula_id in (select app.aulas_del_docente()) and m.estado = 'activa'
$$;

-- Estudiantes de los que el usuario actual es tutor.
create or replace function app.estudiantes_del_tutor() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select et.estudiante_id
  from public.estudiante_tutor et
  join public.tutores t on t.id = et.tutor_id
  where t.perfil_id = auth.uid()
$$;

-- ---------- Permisos base ----------
-- Nada para anon. Para authenticated, solo lo necesario; RLS hace el resto.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update on all tables in schema public to authenticated;
grant delete on public.estudiante_tutor to authenticated;       -- desvincular tutor
revoke all on public.eventos from authenticated;                -- solo el servidor
revoke insert, update on public.auditoria from authenticated;   -- solo lectura

-- Tablas futuras: que no queden abiertas a anon por defecto.
alter default privileges for role postgres in schema public revoke all on tables from anon;

revoke all on schema app from public;
grant usage on schema app to authenticated;
revoke execute on all functions in schema app from public;
grant execute on function
  app.centro_actual(), app.rol_actual(), app.tiene_rol(public.app_role[]),
  app.aulas_del_docente(), app.estudiantes_del_docente(), app.estudiantes_del_tutor()
  to authenticated;

-- ---------- Activar RLS ----------
alter table public.centros enable row level security;
alter table public.perfiles enable row level security;
alter table public.docentes enable row level security;
alter table public.anios_escolares enable row level security;
alter table public.periodos enable row level security;
alter table public.materias enable row level security;
alter table public.aulas enable row level security;
alter table public.asignaciones enable row level security;
alter table public.estudiantes enable row level security;
alter table public.matriculas enable row level security;
alter table public.tutores enable row level security;
alter table public.estudiante_tutor enable row level security;
alter table public.consentimientos enable row level security;
alter table public.modulos_activos enable row level security;
alter table public.eventos enable row level security;       -- sin políticas: nadie del cliente
alter table public.auditoria enable row level security;

-- ---------- Políticas ----------
-- Centros
create policy centros_leer on public.centros for select to authenticated
  using (id = app.centro_actual());
create policy centros_admin on public.centros for update to authenticated
  using (id = app.centro_actual() and app.tiene_rol('admin'))
  with check (id = app.centro_actual() and app.tiene_rol('admin'));

-- Perfiles: cada quien ve el suyo; admin, dirección y coordinación ven los del centro.
create policy perfiles_leer on public.perfiles for select to authenticated
  using (centro_id = app.centro_actual()
         and (id = auth.uid() or app.tiene_rol('admin', 'direccion', 'coordinacion')));
create policy perfiles_admin on public.perfiles for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Catálogos del centro: los ve cualquier miembro, los modifica el admin.
create policy anios_leer on public.anios_escolares for select to authenticated
  using (centro_id = app.centro_actual());
create policy anios_admin on public.anios_escolares for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy periodos_leer on public.periodos for select to authenticated
  using (centro_id = app.centro_actual());
create policy periodos_admin on public.periodos for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy materias_leer on public.materias for select to authenticated
  using (centro_id = app.centro_actual());
create policy materias_admin on public.materias for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy aulas_leer on public.aulas for select to authenticated
  using (centro_id = app.centro_actual());
create policy aulas_admin on public.aulas for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy modulos_leer on public.modulos_activos for select to authenticated
  using (centro_id = app.centro_actual());
create policy modulos_admin on public.modulos_activos for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Docentes: la dirección del centro ve a todos; un docente solo su registro.
create policy docentes_leer on public.docentes for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion') or perfil_id = auth.uid()));
create policy docentes_admin on public.docentes for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Asignaciones: lo mismo; el docente ve las suyas.
create policy asignaciones_leer on public.asignaciones for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or docente_id in (select d.id from public.docentes d where d.perfil_id = auth.uid())));
create policy asignaciones_admin on public.asignaciones for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Estudiantes y matrículas: dirección y orientación ven todos; el docente los
-- de sus aulas; el tutor solo a sus hijos.
create policy estudiantes_leer on public.estudiantes for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or (app.tiene_rol('docente') and id in (select app.estudiantes_del_docente()))
              or (app.tiene_rol('tutor') and id in (select app.estudiantes_del_tutor()))));
create policy estudiantes_admin on public.estudiantes for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy matriculas_leer on public.matriculas for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or (app.tiene_rol('docente') and estudiante_id in (select app.estudiantes_del_docente()))
              or (app.tiene_rol('tutor') and estudiante_id in (select app.estudiantes_del_tutor()))));
create policy matriculas_admin on public.matriculas for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Tutores y vínculos: el docente ve a los tutores de sus estudiantes (para avisarles);
-- el tutor ve su propio registro.
create policy tutores_leer on public.tutores for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or perfil_id = auth.uid()
              or (app.tiene_rol('docente') and id in (
                    select et.tutor_id from public.estudiante_tutor et
                    where et.estudiante_id in (select app.estudiantes_del_docente())))));
create policy tutores_admin on public.tutores for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

create policy estudiante_tutor_leer on public.estudiante_tutor for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or (app.tiene_rol('docente') and estudiante_id in (select app.estudiantes_del_docente()))
              or (app.tiene_rol('tutor') and estudiante_id in (select app.estudiantes_del_tutor()))));
create policy estudiante_tutor_admin on public.estudiante_tutor for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Consentimientos: administración y dirección; el docente los de los tutores de su aula;
-- el tutor, los suyos.
create policy consentimientos_leer on public.consentimientos for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion')
              or tutor_id in (select t.id from public.tutores t where t.perfil_id = auth.uid())
              or (app.tiene_rol('docente') and tutor_id in (
                    select et.tutor_id from public.estudiante_tutor et
                    where et.estudiante_id in (select app.estudiantes_del_docente())))));
create policy consentimientos_admin on public.consentimientos for all to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin'))
  with check (centro_id = app.centro_actual() and app.tiene_rol('admin'));

-- Auditoría: solo administración y dirección, solo lectura.
create policy auditoria_leer on public.auditoria for select to authenticated
  using (centro_id = app.centro_actual() and app.tiene_rol('admin', 'direccion'));
