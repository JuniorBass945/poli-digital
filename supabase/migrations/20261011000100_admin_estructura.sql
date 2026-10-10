-- =====================================================================
-- Poli Digital · R1 · Administración, parte 2: estructura académica
-- Docentes, materias, aulas y asignaciones (docente + materia + aula).
--
-- Cada operación se hace completa o no se hace. Corren con los permisos de
-- quien las llama (security invoker) y exigen el rol de administración.
-- Nada se borra: se da de baja o se archiva.
-- =====================================================================

-- ---------- Docentes: baja con motivo y correo único ----------
alter table public.docentes
  add column baja_en timestamptz,
  add column baja_motivo text,
  add column baja_nota text;

alter table public.docentes
  add constraint docentes_baja_motivo_valido check (
    baja_motivo is null or baja_motivo in ('renuncia', 'traslado', 'jubilacion', 'fin_contrato', 'error_registro', 'otro')
  ),
  add constraint docentes_baja_coherente check (
    (activo and baja_motivo is null) or (not activo and baja_motivo is not null)
  ),
  add constraint docentes_baja_otro_con_nota check (
    baja_motivo is distinct from 'otro' or coalesce(btrim(baja_nota), '') <> ''
  );

create unique index docentes_correo_unico on public.docentes (centro_id, lower(correo)) where correo is not null;
create unique index materias_nombre_unico on public.materias (centro_id, lower(nombre));

-- ---------- Ayuda: exige el rol de administración ----------
create or replace function app.exigir_admin(p_accion text) returns uuid
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not app.tiene_rol('admin') then
    raise exception 'No tienes permiso para %.', p_accion using errcode = '42501';
  end if;
  return app.centro_actual();
end $$;
revoke execute on function app.exigir_admin(text) from public;
grant execute on function app.exigir_admin(text) to authenticated;

-- ======================= DOCENTES =======================
create or replace function public.crear_docente(p_nombre text, p_correo text default null) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('registrar docentes');
  v_id uuid;
begin
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'Escribe el nombre del docente.' using errcode = '22023';
  end if;
  insert into public.docentes (centro_id, nombre, correo)
    values (v_centro, btrim(p_nombre), nullif(btrim(coalesce(p_correo, '')), ''))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_docente(p_id uuid, p_nombre text, p_correo text default null) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('editar docentes');
begin
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'Escribe el nombre del docente.' using errcode = '22023';
  end if;
  update public.docentes
     set nombre = btrim(p_nombre), correo = nullif(btrim(coalesce(p_correo, '')), '')
   where id = p_id and centro_id = v_centro;
  if not found then
    raise exception 'El docente no existe.' using errcode = '22023';
  end if;
end $$;

create or replace function public.dar_baja_docente(p_id uuid, p_motivo text, p_nota text default null) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('dar de baja docentes');
  v_asig bigint;
  v_guia bigint;
begin
  if p_motivo is null or p_motivo not in ('renuncia', 'traslado', 'jubilacion', 'fin_contrato', 'error_registro', 'otro') then
    raise exception 'Elige un motivo de baja válido.' using errcode = '22023';
  end if;
  if p_motivo = 'otro' and btrim(coalesce(p_nota, '')) = '' then
    raise exception 'Cuando el motivo es "Otro", escribe una nota.' using errcode = '22023';
  end if;

  select count(*) into v_asig from public.asignaciones a where a.docente_id = p_id and a.activo;
  select count(*) into v_guia from public.aulas au where au.guia_id = p_id and au.activo;
  if v_asig > 0 or v_guia > 0 then
    raise exception 'No se puede dar de baja: tiene % materia(s) asignada(s) y es guía de % aula(s). Reasigna esas clases primero.', v_asig, v_guia
      using errcode = '22023';
  end if;

  update public.docentes
     set activo = false, baja_en = now(), baja_motivo = p_motivo, baja_nota = nullif(btrim(coalesce(p_nota, '')), '')
   where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'El docente no existe o ya está dado de baja.' using errcode = '22023';
  end if;

  -- Si tenía usuario, deja de poder entrar al sistema.
  update public.perfiles set activo = false where id = (select d.perfil_id from public.docentes d where d.id = p_id);
end $$;

create or replace function public.reactivar_docente(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('reactivar docentes');
begin
  update public.docentes
     set activo = true, baja_en = null, baja_motivo = null, baja_nota = null
   where id = p_id and centro_id = v_centro and not activo;
  if not found then
    raise exception 'El docente no existe o no está dado de baja.' using errcode = '22023';
  end if;
  update public.perfiles set activo = true where id = (select d.perfil_id from public.docentes d where d.id = p_id);
end $$;

-- ======================= MATERIAS =======================
create or replace function public.crear_materia(p_nombre text, p_codigo text default null) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('registrar materias');
  v_id uuid;
begin
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'Escribe el nombre de la materia.' using errcode = '22023';
  end if;
  insert into public.materias (centro_id, nombre, codigo)
    values (v_centro, btrim(p_nombre), nullif(btrim(coalesce(p_codigo, '')), ''))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_materia(p_id uuid, p_nombre text, p_codigo text default null) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('editar materias');
begin
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'Escribe el nombre de la materia.' using errcode = '22023';
  end if;
  update public.materias
     set nombre = btrim(p_nombre), codigo = nullif(btrim(coalesce(p_codigo, '')), '')
   where id = p_id and centro_id = v_centro;
  if not found then
    raise exception 'La materia no existe.' using errcode = '22023';
  end if;
end $$;

create or replace function public.archivar_materia(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('archivar materias');
  v_n bigint;
begin
  select count(*) into v_n from public.asignaciones a where a.materia_id = p_id and a.activo;
  if v_n > 0 then
    raise exception 'La materia está asignada en % aula(s). Quítala de esas aulas primero.', v_n using errcode = '22023';
  end if;
  update public.materias set activo = false where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'La materia no existe o ya está archivada.' using errcode = '22023';
  end if;
end $$;

create or replace function public.reactivar_materia(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('reactivar materias');
begin
  update public.materias set activo = true where id = p_id and centro_id = v_centro and not activo;
  if not found then
    raise exception 'La materia no existe o no está archivada.' using errcode = '22023';
  end if;
end $$;

-- ======================= AULAS =======================
create or replace function public.crear_aula(
  p_grado text, p_seccion text, p_especialidad text default null, p_guia_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('crear aulas');
  v_anio uuid;
  v_id uuid;
begin
  if btrim(coalesce(p_grado, '')) = '' or btrim(coalesce(p_seccion, '')) = '' then
    raise exception 'El grado y la sección son obligatorios.' using errcode = '22023';
  end if;
  select a.id into v_anio from public.anios_escolares a where a.centro_id = v_centro and a.actual;
  if v_anio is null then
    raise exception 'No hay un año escolar actual configurado.' using errcode = '22023';
  end if;
  if p_guia_id is not null and not exists (
       select 1 from public.docentes d where d.id = p_guia_id and d.centro_id = v_centro and d.activo) then
    raise exception 'El docente guía no existe o está dado de baja.' using errcode = '22023';
  end if;
  insert into public.aulas (centro_id, anio_escolar_id, grado, seccion, especialidad, guia_id)
    values (v_centro, v_anio, btrim(p_grado), upper(btrim(p_seccion)), nullif(btrim(coalesce(p_especialidad, '')), ''), p_guia_id)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_aula(
  p_id uuid, p_grado text, p_seccion text, p_especialidad text default null, p_guia_id uuid default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('editar aulas');
begin
  if btrim(coalesce(p_grado, '')) = '' or btrim(coalesce(p_seccion, '')) = '' then
    raise exception 'El grado y la sección son obligatorios.' using errcode = '22023';
  end if;
  if p_guia_id is not null and not exists (
       select 1 from public.docentes d where d.id = p_guia_id and d.centro_id = v_centro and d.activo) then
    raise exception 'El docente guía no existe o está dado de baja.' using errcode = '22023';
  end if;
  update public.aulas
     set grado = btrim(p_grado), seccion = upper(btrim(p_seccion)),
         especialidad = nullif(btrim(coalesce(p_especialidad, '')), ''), guia_id = p_guia_id
   where id = p_id and centro_id = v_centro;
  if not found then
    raise exception 'El aula no existe.' using errcode = '22023';
  end if;
end $$;

create or replace function public.archivar_aula(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('archivar aulas');
  v_n bigint;
begin
  select count(*) into v_n from public.matriculas m where m.aula_id = p_id and m.estado = 'activa';
  if v_n > 0 then
    raise exception 'El aula tiene % estudiante(s) activo(s). Muévelos a otra aula primero.', v_n using errcode = '22023';
  end if;
  update public.aulas set activo = false where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'El aula no existe o ya está archivada.' using errcode = '22023';
  end if;
  update public.asignaciones set activo = false where aula_id = p_id and activo;
end $$;

create or replace function public.reactivar_aula(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('reactivar aulas');
begin
  update public.aulas set activo = true where id = p_id and centro_id = v_centro and not activo;
  if not found then
    raise exception 'El aula no existe o no está archivada.' using errcode = '22023';
  end if;
end $$;

-- Cantidad de estudiantes activos por aula (evita el límite de filas de la API).
create or replace function public.resumen_estudiantes_por_aula() returns table (aula_id uuid, activos bigint)
language sql stable security invoker set search_path = ''
as $$
  select m.aula_id, count(*) from public.matriculas m where m.estado = 'activa' group by m.aula_id
$$;

-- ======================= ASIGNACIONES =======================
create or replace function public.asignar_materia(p_aula_id uuid, p_materia_id uuid, p_docente_id uuid) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('asignar materias');
  v_existente public.asignaciones%rowtype;
  v_id uuid;
begin
  if not exists (select 1 from public.aulas a where a.id = p_aula_id and a.centro_id = v_centro and a.activo) then
    raise exception 'El aula no existe o está archivada.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.materias m where m.id = p_materia_id and m.centro_id = v_centro and m.activo) then
    raise exception 'La materia no existe o está archivada.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.docentes d where d.id = p_docente_id and d.centro_id = v_centro and d.activo) then
    raise exception 'El docente no existe o está dado de baja.' using errcode = '22023';
  end if;

  select * into v_existente from public.asignaciones a where a.aula_id = p_aula_id and a.materia_id = p_materia_id;
  if found and v_existente.activo then
    raise exception 'Esa materia ya está asignada en esta aula. Cambia el docente desde la lista.' using errcode = '22023';
  elsif found then
    update public.asignaciones set activo = true, docente_id = p_docente_id where id = v_existente.id;
    return v_existente.id;
  end if;

  insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id)
    values (v_centro, p_aula_id, p_materia_id, p_docente_id)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.cambiar_docente_asignacion(p_id uuid, p_docente_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('cambiar docentes');
begin
  if not exists (select 1 from public.docentes d where d.id = p_docente_id and d.centro_id = v_centro and d.activo) then
    raise exception 'El docente no existe o está dado de baja.' using errcode = '22023';
  end if;
  update public.asignaciones set docente_id = p_docente_id where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'La asignación no existe o ya fue quitada.' using errcode = '22023';
  end if;
end $$;

create or replace function public.quitar_asignacion(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('quitar asignaciones');
begin
  update public.asignaciones set activo = false where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'La asignación no existe o ya fue quitada.' using errcode = '22023';
  end if;
end $$;

-- ---------- Permisos: solo usuarios con sesión ----------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'crear_docente', 'actualizar_docente', 'dar_baja_docente', 'reactivar_docente',
      'crear_materia', 'actualizar_materia', 'archivar_materia', 'reactivar_materia',
      'crear_aula', 'actualizar_aula', 'archivar_aula', 'reactivar_aula', 'resumen_estudiantes_por_aula',
      'asignar_materia', 'cambiar_docente_asignacion', 'quitar_asignacion')
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
