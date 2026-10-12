-- =====================================================================
-- Pruebas de R1 · Accesos de usuarios del personal (varios roles, usuario, clave temporal).
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261017000100_accesos.sql.
-- =====================================================================
begin;

create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.esperar(p_nombre text, p_real bigint, p_esperado bigint) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLÓ: % (esperado %, obtenido %)', p_nombre, p_esperado, p_real;
  end if;
  raise notice 'ok: %', p_nombre;
end $$;

-- Ejecuta una sentencia y exige que falle con el código indicado.
create function pg_temp.debe_fallar(p_nombre text, p_sql text, p_codigo text) returns void language plpgsql as $$
declare v_estado text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate;
    if v_estado = p_codigo then raise notice 'ok: %', p_nombre; return; end if;
    raise exception 'FALLÓ: % (se esperaba %, llegó %: %)', p_nombre, p_codigo, v_estado, sqlerrm;
  end;
  raise exception 'FALLÓ: % (no falló)', p_nombre;
end $$;

-- Dos centros. Centro A: admin, admin2, dirección, docente con registro. Centro B: su propio admin.
insert into public.centros (id, nombre) values
  ('00000000-0000-4000-8000-0000000000e1', 'Centro A'), ('00000000-0000-4000-8000-0000000000e2', 'Centro B');
insert into auth.users (id, email) values
  ('e1000000-0000-4000-8000-000000000001', 'admin@a.test'),
  ('e1000000-0000-4000-8000-000000000002', 'admin2@a.test'),
  ('e1000000-0000-4000-8000-000000000003', 'dir@a.test'),
  ('e2000000-0000-4000-8000-000000000001', 'admin@b.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e1', 'admin', 'Admin A'),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000e1', 'admin', 'Admin A2'),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000e1', 'direccion', 'Dirección A'),
  ('e2000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e2', 'admin', 'Admin B');
insert into public.docentes (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-0000000000e1', 'Prof. Carmen Peña'),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-0000000000e1', 'Prof. Luis Gómez');
insert into public.estudiantes (centro_id, matricula, nombres, apellidos) values
  ('00000000-0000-4000-8000-0000000000e1', 'E-1', 'Ana', 'Gil');

-- 1. Los perfiles existentes pasan a perfil_roles -------------------------------
select pg_temp.esperar('cada perfil queda con su rol en perfil_roles',
  (select count(*) from public.perfil_roles where perfil_id in (select id from public.perfiles where centro_id in
    ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2'))), 4);

-- 2. Sugerencia de usuario -----------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.esperar('sugiere inicial + apellido sin título ni tildes', (select (public.sugerir_usuario('Prof. Carmen Peña') = 'cpena')::int), 1);
select pg_temp.esperar('sugiere con tildes y varios apellidos', (select (public.sugerir_usuario('María José Álvarez Núñez') = 'malvarez')::int), 1);
reset role;

-- 3. Validaciones antes de crear -------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('rechaza un usuario con formato inválido', $$select public.validar_nuevo_acceso('C P', 'Carmen', array['docente']::public.app_role[], null, true)$$, '22023');
select pg_temp.debe_fallar('rechaza un usuario con tilde', $$select public.validar_nuevo_acceso('carmén', 'Carmen', array['orientacion']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('exige al menos un rol', $$select public.validar_nuevo_acceso('cpena', 'Carmen', array[]::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('no permite el rol tutor', $$select public.validar_nuevo_acceso('cpena', 'Carmen', array['tutor']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('el rol docente exige elegir o crear el registro', $$select public.validar_nuevo_acceso('cpena', 'Carmen', array['docente']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('exige el nombre', $$select public.validar_nuevo_acceso('cpena', '  ', array['orientacion']::public.app_role[])$$, '22023');
select pg_temp.esperar('un usuario libre pasa la validación', (select (public.validar_nuevo_acceso('CPena', 'Carmen Peña', array['docente', 'orientacion']::public.app_role[], '00000000-0000-4000-8000-00000000d001') = 'cpena')::int), 1);
reset role;
select pg_temp.como('e1000000-0000-4000-8000-000000000003');
select pg_temp.debe_fallar('dirección no puede validar accesos', $$select public.validar_nuevo_acceso('xx1', 'X', array['orientacion']::public.app_role[])$$, '42501');
select pg_temp.debe_fallar('dirección no puede listar accesos', $$select public.listar_accesos()$$, '42501');
reset role;

-- 4. Crear el acceso (lo que hace la Edge Function) ------------------------------
-- La cuenta de acceso la crea el servidor con la marca del administrador que la pidió.
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('e1000000-0000-4000-8000-0000000000c1', 'cpena@acceso.test', 'huella-temporal-1', '{"creado_por":"e1000000-0000-4000-8000-000000000001"}'),
  ('e1000000-0000-4000-8000-0000000000c2', 'ajeno@acceso.test', 'huella-x', '{"creado_por":"e2000000-0000-4000-8000-000000000001"}');
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('no registra una cuenta creada por otro administrador',
  $$select public.registrar_acceso('e1000000-0000-4000-8000-0000000000c2', 'ajeno', 'Ajeno', array['orientacion']::public.app_role[])$$, '42501');
select pg_temp.debe_fallar('no registra si el usuario no coincide con la cuenta',
  $$select public.registrar_acceso('e1000000-0000-4000-8000-0000000000c1', 'otro', 'Carmen', array['orientacion']::public.app_role[])$$, '42501');
select public.registrar_acceso('e1000000-0000-4000-8000-0000000000c1', 'cpena', '  Prof. Carmen Peña ', array['docente', 'orientacion']::public.app_role[], '00000000-0000-4000-8000-00000000d001');
reset role;
select pg_temp.esperar('el perfil queda con usuario, nombre limpio y clave pendiente a 7 días',
  (select count(*) from public.perfiles where id = 'e1000000-0000-4000-8000-0000000000c1' and usuario = 'cpena' and nombre = 'Prof. Carmen Peña'
     and debe_cambiar_clave and clave_vence between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' and activo), 1);
select pg_temp.esperar('tiene los dos roles', (select count(*) from public.perfil_roles where perfil_id = 'e1000000-0000-4000-8000-0000000000c1' and rol in ('docente', 'orientacion')), 2);
select pg_temp.esperar('el docente elegido queda vinculado', (select count(*) from public.docentes where id = '00000000-0000-4000-8000-00000000d001' and perfil_id = 'e1000000-0000-4000-8000-0000000000c1'), 1);

-- 5. Usuario repetido (sin importar mayúsculas) ---------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('no permite repetir un usuario', $$select public.validar_nuevo_acceso('CPENA', 'Otra Persona', array['orientacion']::public.app_role[])$$, '23505');
select pg_temp.esperar('la sugerencia evita el repetido', (select (public.sugerir_usuario('Prof. Carmen Peña') = 'cpena2')::int), 1);
reset role;
select pg_temp.debe_fallar('la base impide dos usuarios iguales aunque cambien mayúsculas',
  $$update public.perfiles set usuario = 'CPENA' where id = 'e1000000-0000-4000-8000-000000000002'$$, '23514');
select pg_temp.debe_fallar('la base impide un usuario con formato inválido',
  $$update public.perfiles set usuario = 'a b' where id = 'e1000000-0000-4000-8000-000000000002'$$, '23514');

-- 6. Con la clave temporal NO se ve nada ------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select pg_temp.esperar('sin cambiar la clave no ve estudiantes', (select count(*) from public.estudiantes), 0);
select pg_temp.esperar('sin cambiar la clave no ve ni su perfil', (select count(*) from public.perfiles), 0);
select pg_temp.esperar('sin cambiar la clave no tiene centro', (select (app.centro_actual() is null)::int), 1);
select pg_temp.esperar('sin cambiar la clave no tiene ningún rol', (select app.tiene_rol('docente', 'orientacion', 'admin')::int), 0);
select pg_temp.esperar('el estado de acceso dice que debe cambiar la clave', (select (public.mi_estado_acceso() ->> 'debe_cambiar' = 'true' and public.mi_estado_acceso() ->> 'nombre' = 'Prof. Carmen Peña')::int), 1);
select pg_temp.debe_fallar('no puede marcar la clave como cambiada sin cambiarla', $$select public.marcar_clave_cambiada()$$, '22023');
select pg_temp.debe_fallar('no puede leer las huellas de claves', $$select * from public.acceso_secretos$$, '42501');
select pg_temp.debe_fallar('no puede crearse roles a mano', $$insert into public.perfil_roles (centro_id, perfil_id, rol) values ('00000000-0000-4000-8000-0000000000e1', 'e1000000-0000-4000-8000-0000000000c1', 'admin')$$, '42501');
reset role;

-- 7. Cambia la clave de verdad ------------------------------------------------------
update auth.users set encrypted_password = 'huella-nueva' where id = 'e1000000-0000-4000-8000-0000000000c1';
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select public.marcar_clave_cambiada();
select pg_temp.esperar('después de cambiar la clave ya ve su centro', (select count(*) from public.estudiantes), 1);
select pg_temp.esperar('ve sus dos roles', (select count(*) from public.perfil_roles where perfil_id = auth.uid()), 2);
select pg_temp.esperar('el rol de mayor alcance es docente (docente + orientación)', (select (app.rol_actual() = 'docente')::int), 1);
select pg_temp.esperar('tiene ambos roles a la vez', (select (app.tiene_rol('docente') and app.tiene_rol('orientacion'))::int), 1);
select pg_temp.esperar('la clave ya no está pendiente', (select (public.mi_estado_acceso() ->> 'debe_cambiar' = 'false')::int), 1);
reset role;
select pg_temp.esperar('se borra la huella al cambiar', (select count(*) from public.acceso_secretos where perfil_id = 'e1000000-0000-4000-8000-0000000000c1'), 0);

-- 8. Clave temporal vencida ------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('e1000000-0000-4000-8000-0000000000c3', 'lgomez@acceso.test', 'huella-3', '{"creado_por":"e1000000-0000-4000-8000-000000000001"}');
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select public.registrar_acceso('e1000000-0000-4000-8000-0000000000c3', 'lgomez', 'Prof. Luis Gómez', array['docente']::public.app_role[], null, true);
reset role;
select pg_temp.esperar('crear docente al vuelo: nace vinculado', (select count(*) from public.docentes where perfil_id = 'e1000000-0000-4000-8000-0000000000c3' and nombre = 'Prof. Luis Gómez'), 1);
update public.perfiles set clave_vence = now() - interval '1 minute' where id = 'e1000000-0000-4000-8000-0000000000c3';
update auth.users set encrypted_password = 'huella-3-nueva' where id = 'e1000000-0000-4000-8000-0000000000c3';
select pg_temp.como('e1000000-0000-4000-8000-0000000000c3');
select pg_temp.esperar('el estado marca la clave como vencida', (select (public.mi_estado_acceso() ->> 'vencida' = 'true')::int), 1);
select pg_temp.debe_fallar('una clave temporal vencida no se puede usar', $$select public.marcar_clave_cambiada()$$, '42501');
reset role;

-- 9. Restablecer la clave -----------------------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.esperar('valida el reinicio de otra persona', (select (public.validar_reinicio_acceso('e1000000-0000-4000-8000-0000000000c3') = 'lgomez')::int), 1);
select pg_temp.debe_fallar('no puede restablecer su propia clave', $$select public.validar_reinicio_acceso('e1000000-0000-4000-8000-000000000001')$$, '22023');
select public.registrar_reinicio_acceso('e1000000-0000-4000-8000-0000000000c3');
reset role;
select pg_temp.esperar('el reinicio deja la clave pendiente otra vez, con 7 días nuevos',
  (select count(*) from public.perfiles where id = 'e1000000-0000-4000-8000-0000000000c3' and debe_cambiar_clave and clave_vence > now() + interval '6 days'), 1);
select pg_temp.como('e1000000-0000-4000-8000-0000000000c3');
select pg_temp.debe_fallar('tras el reinicio, repetir la misma clave no sirve', $$select public.marcar_clave_cambiada()$$, '22023');
reset role;

-- 10. Cambiar roles ---------------------------------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('no permite dejar a alguien sin roles', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-0000000000c1', array[]::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('al darle rol docente hay que vincular el registro', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000003', array['direccion', 'docente']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('no se puede vincular un docente que ya tiene acceso', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000003', array['direccion', 'docente']::public.app_role[], '00000000-0000-4000-8000-00000000d001')$$, '22023');
select public.cambiar_roles_acceso('e1000000-0000-4000-8000-0000000000c1', array['orientacion', 'coordinacion']::public.app_role[]);
reset role;
select pg_temp.esperar('quitar el rol docente suelta el registro del docente (que se conserva)',
  (select count(*) from public.docentes where id = '00000000-0000-4000-8000-00000000d001' and perfil_id is null and activo), 1);
select pg_temp.esperar('los roles quedan exactamente los elegidos', (select count(*) from public.perfil_roles where perfil_id = 'e1000000-0000-4000-8000-0000000000c1' and rol in ('orientacion', 'coordinacion')), 2);
select pg_temp.esperar('ya no tiene el rol docente', (select count(*) from public.perfil_roles where perfil_id = 'e1000000-0000-4000-8000-0000000000c1' and rol = 'docente'), 0);
select pg_temp.esperar('el rol principal sigue al conjunto de roles', (select count(*) from public.perfiles where id = 'e1000000-0000-4000-8000-0000000000c1' and rol = 'coordinacion'), 1);
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select pg_temp.esperar('los permisos siguen a los roles nuevos: coordinación sí', (select app.tiene_rol('coordinacion')::int), 1);
select pg_temp.esperar('los permisos siguen a los roles nuevos: docente ya no', (select app.tiene_rol('docente')::int), 0);
reset role;
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000003', array['direccion', 'docente']::public.app_role[], '00000000-0000-4000-8000-00000000d001');
reset role;
select pg_temp.esperar('dirección + docente: queda vinculado y el alcance es docente',
  (select count(*) from public.docentes where id = '00000000-0000-4000-8000-00000000d001' and perfil_id = 'e1000000-0000-4000-8000-000000000003'), 1);
select pg_temp.como('e1000000-0000-4000-8000-000000000003');
select pg_temp.esperar('dirección + docente: rol de mayor alcance = docente', (select (app.rol_actual() = 'docente')::int), 1);
reset role;

-- 11. Administración: no quedarse sin administrador -----------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('nadie se quita su propio rol de administración', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000001', array['direccion']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('nadie se quita su propio acceso', $$select public.quitar_acceso('e1000000-0000-4000-8000-000000000001')$$, '22023');
select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000002', array['direccion']::public.app_role[]);   -- quedan: admin (1) 
reset role;
select pg_temp.como('e1000000-0000-4000-8000-000000000002');
select pg_temp.debe_fallar('un no administrador no puede cambiar roles', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-000000000001', array['admin']::public.app_role[])$$, '42501');
reset role;
select pg_temp.debe_fallar('la base impide quitar al último administrador del centro',
  $$delete from public.perfil_roles where perfil_id = 'e1000000-0000-4000-8000-000000000001' and rol = 'admin'$$, '23514');
select pg_temp.debe_fallar('la base impide desactivar al último administrador',
  $$update public.perfiles set activo = false where id = 'e1000000-0000-4000-8000-000000000001'$$, '23514');
select pg_temp.esperar('el administrador de otro centro no cuenta', (select count(*) from public.perfil_roles where centro_id = '00000000-0000-4000-8000-0000000000e1' and rol = 'admin'), 1);

-- 12. Quitar acceso -------------------------------------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select public.quitar_acceso('e1000000-0000-4000-8000-0000000000c1');
reset role;
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select pg_temp.esperar('sin acceso: no ve nada', (select count(*) from public.estudiantes), 0);
reset role;
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select public.registrar_reinicio_acceso('e1000000-0000-4000-8000-0000000000c1');
reset role;
select pg_temp.esperar('el reinicio reactiva a quien no tenía acceso', (select count(*) from public.perfiles where id = 'e1000000-0000-4000-8000-0000000000c1' and activo and debe_cambiar_clave), 1);

-- 13. Lista y aislamiento entre centros ------------------------------------------------------------
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select pg_temp.esperar('la lista trae solo a las personas del centro', (select jsonb_array_length(public.listar_accesos())), 5);
select pg_temp.esperar('la lista indica estado y roles', (select count(*) from jsonb_array_elements(public.listar_accesos()) x
  where x ->> 'usuario' = 'cpena' and x ->> 'estado' = 'pendiente' and jsonb_array_length(x -> 'roles') = 2), 1);
reset role;
select pg_temp.como('e2000000-0000-4000-8000-000000000001');
select pg_temp.esperar('el otro centro solo se ve a sí mismo', (select jsonb_array_length(public.listar_accesos())), 1);
select pg_temp.debe_fallar('otro centro no puede cambiar roles ajenos', $$select public.cambiar_roles_acceso('e1000000-0000-4000-8000-0000000000c1', array['orientacion']::public.app_role[])$$, '22023');
select pg_temp.debe_fallar('otro centro no puede quitar accesos ajenos', $$select public.quitar_acceso('e1000000-0000-4000-8000-0000000000c1')$$, '22023');
select pg_temp.debe_fallar('otro centro no puede restablecer claves ajenas', $$select public.validar_reinicio_acceso('e1000000-0000-4000-8000-0000000000c1')$$, '22023');
reset role;
set local role anon;
select pg_temp.debe_fallar('un anónimo no puede ver el estado de acceso', $$select public.mi_estado_acceso()$$, '42501');
reset role;

-- 14. Auditoría ------------------------------------------------------------------------------------------
select pg_temp.esperar('los cambios de roles quedan en la auditoría', (select (count(*) > 0)::int from public.auditoria where tabla = 'perfil_roles'), 1);
select pg_temp.esperar('la auditoría nunca guarda claves ni huellas', (select count(*) from public.auditoria where despues::text ilike '%huella%' or antes::text ilike '%huella%'), 0);

-- 15. Varios roles en la práctica: pasar lista --------------------------------------------------------------
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual)
  values ('00000000-0000-4000-8000-00000000ea01', '00000000-0000-4000-8000-0000000000e1', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion) values
  ('00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea01', '4.º', 'A');
insert into public.materias (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-0000000000e1', 'Matemática'),
  ('00000000-0000-4000-8000-00000000ec02', '00000000-0000-4000-8000-0000000000e1', 'Lengua');
insert into public.asignaciones (id, centro_id, aula_id, materia_id, docente_id) values
  ('00000000-0000-4000-8000-00000000ed01', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-00000000d001'),
  ('00000000-0000-4000-8000-00000000ed02', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-00000000ec02', '00000000-0000-4000-8000-00000000d002');
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
  select '00000000-0000-4000-8000-0000000000e1', id, '00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-00000000ea01'
    from public.estudiantes where centro_id = '00000000-0000-4000-8000-0000000000e1' and matricula = 'E-1';
create function pg_temp.lista(p_asignacion uuid) returns jsonb language sql as $$
  select public.guardar_asistencia(p_asignacion, (now() at time zone 'America/Santo_Domingo')::date,
    (select jsonb_agg(jsonb_build_object('estudiante_id', id, 'estado', 'presente')) from public.estudiantes where matricula = 'E-1' and centro_id = '00000000-0000-4000-8000-0000000000e1'))
$$;
-- Dirección + docente (e1…03, ligado a la clase ed01): pasa lista en SU clase, no en la de otro docente.
select pg_temp.como('e1000000-0000-4000-8000-000000000003');
select pg_temp.esperar('dirección + docente pasa lista en su clase', (select (pg_temp.lista('00000000-0000-4000-8000-00000000ed01') ->> 'presentes')::int), 1);
select pg_temp.debe_fallar('dirección + docente no pasa lista en la clase de otro docente', $$select pg_temp.lista('00000000-0000-4000-8000-00000000ed02')$$, '42501');
reset role;
-- Orientación + coordinación (cpena): coordinación le da alcance sobre cualquier clase.
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select pg_temp.esperar('el acceso reactivado ya no tiene permisos hasta cambiar su clave', (select (app.tiene_rol('coordinacion'))::int), 0);
reset role;
update public.perfiles set debe_cambiar_clave = false, clave_vence = null where id = 'e1000000-0000-4000-8000-0000000000c1';
select pg_temp.como('e1000000-0000-4000-8000-0000000000c1');
select pg_temp.esperar('orientación + coordinación pasa lista en cualquier clase', (select (pg_temp.lista('00000000-0000-4000-8000-00000000ed02') ->> 'presentes')::int), 1);
reset role;
-- Solo dirección (admin2 quedó en dirección): no pasa lista.
select pg_temp.como('e1000000-0000-4000-8000-000000000002');
select pg_temp.debe_fallar('solo dirección no pasa lista', $$select pg_temp.lista('00000000-0000-4000-8000-00000000ed01')$$, '42501');
reset role;

rollback;
select 'TODAS LAS PRUEBAS DE ACCESOS PASARON' as resultado;
