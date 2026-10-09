-- =====================================================================
-- Vincula usuarios de prueba con el centro demo y su rol.
--
-- ANTES: en Supabase > Authentication > Users > "Add user" crea estos 6 correos
-- con una contraseña de desarrollo (marca "Auto Confirm User"):
--    admin@polidemo.test        direccion@polidemo.test     coordinacion@polidemo.test
--    docente@polidemo.test      orientacion@polidemo.test   tutor@polidemo.test
-- Solo para desarrollo: en producción cada persona tendrá su propio usuario.
-- DESPUÉS: pega este archivo en SQL Editor y ejecútalo.
-- =====================================================================
create function pg_temp.vincular(p_email text, p_rol public.app_role, p_nombre text) returns void
language plpgsql as $$
declare
  v_id uuid;
  c uuid := '00000000-0000-4000-8000-00000000c001';
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    raise exception 'No existe el usuario %. Créalo primero en Authentication > Users.', p_email;
  end if;
  insert into public.perfiles (id, centro_id, rol, nombre) values (v_id, c, p_rol, p_nombre)
    on conflict (id) do update set centro_id = excluded.centro_id, rol = excluded.rol, nombre = excluded.nombre, activo = true;
  if p_rol = 'docente' then
    update public.docentes set perfil_id = v_id where centro_id = c and nombre = 'Prof. Carmen Peña';
  elsif p_rol = 'tutor' then
    update public.tutores set perfil_id = v_id where centro_id = c and nombre = 'Marisol Tavárez Polanco';
  end if;
end $$;

select pg_temp.vincular('admin@polidemo.test', 'admin', 'Administración Demo');
select pg_temp.vincular('direccion@polidemo.test', 'direccion', 'Dirección Demo');
select pg_temp.vincular('coordinacion@polidemo.test', 'coordinacion', 'Coord. Mariela Cruz');
select pg_temp.vincular('docente@polidemo.test', 'docente', 'Prof. Carmen Peña');
select pg_temp.vincular('orientacion@polidemo.test', 'orientacion', 'Lic. Ramona Díaz');
select pg_temp.vincular('tutor@polidemo.test', 'tutor', 'Marisol Tavárez');
