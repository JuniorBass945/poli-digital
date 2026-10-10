-- =====================================================================
-- Poli Digital · R1 · Administración, parte 1: Estudiantes
--
-- Funciones que hacen cada operación completa o no hacen nada (una sola
-- transacción): crear un estudiante con su matrícula en un aula y su tutor,
-- editarlo, darlo de baja (con motivo) y reactivarlo.
-- Corren con los permisos de quien las llama (security invoker): la seguridad
-- por fila sigue mandando, y además exigen el rol de administración.
-- =====================================================================

-- ---------- Motivo de baja (nada se borra) ----------
alter table public.estudiantes
  add column baja_motivo text,
  add column baja_nota text;

alter table public.estudiantes
  add constraint estudiantes_baja_motivo_valido check (
    baja_motivo is null or baja_motivo in (
      'traslado', 'retiro_voluntario', 'cambio_residencia', 'inasistencia_prolongada',
      'razones_economicas', 'razones_salud_personales', 'error_registro', 'otro')
  ),
  add constraint estudiantes_baja_coherente check (
    (activo and baja_motivo is null) or (not activo and baja_motivo is not null)
  ),
  add constraint estudiantes_baja_otro_con_nota check (
    baja_motivo is distinct from 'otro' or coalesce(btrim(baja_nota), '') <> ''
  );

-- ---------- Crear ----------
create or replace function public.crear_estudiante(
  p_matricula text,
  p_nombres text,
  p_apellidos text,
  p_aula_id uuid,
  p_fecha_nacimiento date default null,
  p_tutor_id uuid default null,
  p_tutor_nombre text default null,
  p_tutor_parentesco text default null,
  p_tutor_telefono text default null,
  p_tutor_correo text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.centro_actual();
  v_aula public.aulas%rowtype;
  v_est uuid;
  v_tutor uuid;
begin
  if not app.tiene_rol('admin') then
    raise exception 'No tienes permiso para registrar estudiantes.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_matricula, '')) = '' or btrim(coalesce(p_nombres, '')) = ''
     or btrim(coalesce(p_apellidos, '')) = '' then
    raise exception 'La matrícula, los nombres y los apellidos son obligatorios.' using errcode = '22023';
  end if;

  select * into v_aula from public.aulas where id = p_aula_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'El aula elegida no existe o no está activa.' using errcode = '22023';
  end if;

  if p_tutor_id is not null then
    select t.id into v_tutor from public.tutores t where t.id = p_tutor_id and t.centro_id = v_centro and t.activo;
    if v_tutor is null then
      raise exception 'El tutor elegido no existe.' using errcode = '22023';
    end if;
  elsif btrim(coalesce(p_tutor_nombre, '')) = '' or btrim(coalesce(p_tutor_telefono, '')) = '' then
    raise exception 'Indica el nombre y el teléfono del tutor.' using errcode = '22023';
  end if;

  insert into public.estudiantes (centro_id, matricula, nombres, apellidos, fecha_nacimiento)
    values (v_centro, btrim(p_matricula), btrim(p_nombres), btrim(p_apellidos), p_fecha_nacimiento)
    returning id into v_est;

  insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
    values (v_centro, v_est, v_aula.id, v_aula.anio_escolar_id);

  if v_tutor is null then
    insert into public.tutores (centro_id, nombre, parentesco, telefono, correo)
      values (v_centro, btrim(p_tutor_nombre), nullif(btrim(coalesce(p_tutor_parentesco, '')), ''),
              btrim(p_tutor_telefono), nullif(btrim(coalesce(p_tutor_correo, '')), ''))
      returning id into v_tutor;
    -- El consentimiento de WhatsApp queda pendiente hasta que el tutor lo otorgue.
    insert into public.consentimientos (centro_id, tutor_id, canal) values (v_centro, v_tutor, 'whatsapp');
  end if;

  insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id, principal)
    values (v_centro, v_est, v_tutor, true);

  return v_est;
end $$;

-- ---------- Editar ----------
create or replace function public.actualizar_estudiante(
  p_id uuid,
  p_matricula text,
  p_nombres text,
  p_apellidos text,
  p_aula_id uuid,
  p_fecha_nacimiento date default null,
  p_tutor_nombre text default null,
  p_tutor_parentesco text default null,
  p_tutor_telefono text default null,
  p_tutor_correo text default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.centro_actual();
  v_aula public.aulas%rowtype;
  v_mat public.matriculas%rowtype;
  v_tutor uuid;
begin
  if not app.tiene_rol('admin') then
    raise exception 'No tienes permiso para editar estudiantes.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_matricula, '')) = '' or btrim(coalesce(p_nombres, '')) = ''
     or btrim(coalesce(p_apellidos, '')) = '' then
    raise exception 'La matrícula, los nombres y los apellidos son obligatorios.' using errcode = '22023';
  end if;

  update public.estudiantes
     set matricula = btrim(p_matricula), nombres = btrim(p_nombres), apellidos = btrim(p_apellidos),
         fecha_nacimiento = p_fecha_nacimiento
   where id = p_id and centro_id = v_centro;
  if not found then
    raise exception 'El estudiante no existe.' using errcode = '22023';
  end if;

  -- Cambio de aula dentro del mismo año escolar.
  select * into v_aula from public.aulas where id = p_aula_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'El aula elegida no existe o no está activa.' using errcode = '22023';
  end if;
  select * into v_mat from public.matriculas m
   where m.estudiante_id = p_id and m.estado = 'activa'
   order by m.creado_en desc limit 1;
  if found and v_mat.aula_id <> p_aula_id then
    if v_mat.anio_escolar_id <> v_aula.anio_escolar_id then
      raise exception 'El aula debe ser del mismo año escolar. Los cambios de año se hacen con la promoción de grado.'
        using errcode = '22023';
    end if;
    update public.matriculas set aula_id = p_aula_id where id = v_mat.id;
  end if;

  -- Datos del tutor principal (si se envían).
  if p_tutor_nombre is not null then
    if btrim(p_tutor_nombre) = '' or btrim(coalesce(p_tutor_telefono, '')) = '' then
      raise exception 'Indica el nombre y el teléfono del tutor.' using errcode = '22023';
    end if;
    select et.tutor_id into v_tutor from public.estudiante_tutor et
     where et.estudiante_id = p_id and et.principal limit 1;
    if v_tutor is not null then
      update public.tutores
         set nombre = btrim(p_tutor_nombre),
             parentesco = nullif(btrim(coalesce(p_tutor_parentesco, '')), ''),
             telefono = btrim(p_tutor_telefono),
             correo = nullif(btrim(coalesce(p_tutor_correo, '')), '')
       where id = v_tutor and centro_id = v_centro;
    end if;
  end if;
end $$;

-- ---------- Dar de baja ----------
create or replace function public.dar_baja_estudiante(
  p_id uuid,
  p_motivo text,
  p_nota text default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.centro_actual();
begin
  if not app.tiene_rol('admin') then
    raise exception 'No tienes permiso para dar de baja estudiantes.' using errcode = '42501';
  end if;
  if p_motivo is null or p_motivo not in (
      'traslado', 'retiro_voluntario', 'cambio_residencia', 'inasistencia_prolongada',
      'razones_economicas', 'razones_salud_personales', 'error_registro', 'otro') then
    raise exception 'Elige un motivo de baja válido.' using errcode = '22023';
  end if;
  if p_motivo = 'otro' and btrim(coalesce(p_nota, '')) = '' then
    raise exception 'Cuando el motivo es "Otro", escribe una nota.' using errcode = '22023';
  end if;

  update public.estudiantes
     set activo = false, baja_en = now(), baja_motivo = p_motivo,
         baja_nota = nullif(btrim(coalesce(p_nota, '')), '')
   where id = p_id and centro_id = v_centro and activo;
  if not found then
    raise exception 'El estudiante no existe o ya está dado de baja.' using errcode = '22023';
  end if;

  update public.matriculas set estado = 'retirada' where estudiante_id = p_id and estado = 'activa';
end $$;

-- ---------- Reactivar (deshacer una baja) ----------
create or replace function public.reactivar_estudiante(p_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.centro_actual();
begin
  if not app.tiene_rol('admin') then
    raise exception 'No tienes permiso para reactivar estudiantes.' using errcode = '42501';
  end if;

  update public.estudiantes
     set activo = true, baja_en = null, baja_motivo = null, baja_nota = null
   where id = p_id and centro_id = v_centro and not activo;
  if not found then
    raise exception 'El estudiante no existe o no está dado de baja.' using errcode = '22023';
  end if;

  update public.matriculas set estado = 'activa'
   where id = (select m.id from public.matriculas m
                where m.estudiante_id = p_id and m.estado = 'retirada'
                order by m.creado_en desc limit 1);
end $$;

-- ---------- Permisos: solo usuarios con sesión ----------
revoke execute on function public.crear_estudiante(text, text, text, uuid, date, uuid, text, text, text, text) from public, anon;
revoke execute on function public.actualizar_estudiante(uuid, text, text, text, uuid, date, text, text, text, text) from public, anon;
revoke execute on function public.dar_baja_estudiante(uuid, text, text) from public, anon;
revoke execute on function public.reactivar_estudiante(uuid) from public, anon;
grant execute on function public.crear_estudiante(text, text, text, uuid, date, uuid, text, text, text, text) to authenticated;
grant execute on function public.actualizar_estudiante(uuid, text, text, text, uuid, date, text, text, text, text) to authenticated;
grant execute on function public.dar_baja_estudiante(uuid, text, text) to authenticated;
grant execute on function public.reactivar_estudiante(uuid) to authenticated;
