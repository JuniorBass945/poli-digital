-- =====================================================================
-- Pruebas de R1 · Inicio de administración: pendientes de datos.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261015000100_pendientes_datos.sql.
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

insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000c9', 'Centro Q');
insert into auth.users (id, email) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@q.test'), ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'docente@q.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', '00000000-0000-4000-8000-0000000000c9', 'admin', 'Admin Q'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-4000-8000-0000000000c9', 'docente', 'Docente Q');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual)
  values ('00000000-0000-4000-8000-00000000ca01', '00000000-0000-4000-8000-0000000000c9', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion) values
  ('00000000-0000-4000-8000-00000000cb01', '00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000ca01', '4.º', 'A'),
  ('00000000-0000-4000-8000-00000000cb02', '00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000ca01', '4.º', 'B');   -- sin materias
insert into public.materias (id, centro_id, nombre) values ('00000000-0000-4000-8000-00000000cc01', '00000000-0000-4000-8000-0000000000c9', 'Matemática');
insert into public.docentes (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000cd01', '00000000-0000-4000-8000-0000000000c9', 'Con clases'),
  ('00000000-0000-4000-8000-00000000cd02', '00000000-0000-4000-8000-0000000000c9', 'Sin clases');
insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id)
  values ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000cb01', '00000000-0000-4000-8000-00000000cc01', '00000000-0000-4000-8000-00000000cd01');
insert into public.estudiantes (id, centro_id, matricula, nombres, apellidos) values
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-0000000000c9', 'Q-1', 'Ana', 'Uno'),       -- completo
  ('00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-0000000000c9', 'Q-2', 'Beto', 'Dos'),      -- sin tutor
  ('00000000-0000-4000-8000-00000000c103', '00000000-0000-4000-8000-0000000000c9', 'Q-3', 'Carla', 'Tres');    -- sin aula
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id) values
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000cb01', '00000000-0000-4000-8000-00000000ca01'),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000cb01', '00000000-0000-4000-8000-00000000ca01');
insert into public.tutores (id, centro_id, nombre, telefono) values
  ('00000000-0000-4000-8000-00000000ce01', '00000000-0000-4000-8000-0000000000c9', 'Tutor con permiso', '809-555-0001'),
  ('00000000-0000-4000-8000-00000000ce02', '00000000-0000-4000-8000-0000000000c9', 'Tutor sin permiso', '809-555-0002'),
  ('00000000-0000-4000-8000-00000000ce03', '00000000-0000-4000-8000-0000000000c9', 'Tutor sin teléfono', null);
insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id, principal) values
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000ce01', true),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000c103', '00000000-0000-4000-8000-00000000ce02', true);
insert into public.consentimientos (centro_id, tutor_id, canal, otorgado, evidencia) values
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000ce01', 'whatsapp', true, 'Formulario firmado'),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-00000000ce02', 'whatsapp', false, null);

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
create temp table r as select public.pendientes_datos() as r;
grant all on r to public;
reset role;

select pg_temp.esperar('estudiantes activos', (select (r ->> 'estudiantes_activos')::int from r), 3);
select pg_temp.esperar('tutores', (select (r ->> 'tutores')::int from r), 3);
select pg_temp.esperar('docentes', (select (r ->> 'docentes')::int from r), 2);
select pg_temp.esperar('aulas', (select (r ->> 'aulas')::int from r), 2);
select pg_temp.esperar('1 estudiante sin tutor (Beto)', (select (r ->> 'estudiantes_sin_tutor')::int from r), 1);
select pg_temp.esperar('1 estudiante sin aula (Carla)', (select (r ->> 'estudiantes_sin_aula')::int from r), 1);
select pg_temp.esperar('1 tutor sin teléfono', (select (r ->> 'tutores_sin_telefono')::int from r), 1);
select pg_temp.esperar('1 tutor con teléfono y sin consentimiento (el sin teléfono no cuenta aquí)', (select (r ->> 'tutores_sin_consentimiento')::int from r), 1);
select pg_temp.esperar('1 aula sin materias', (select (r ->> 'aulas_sin_materias')::int from r), 1);
select pg_temp.esperar('1 docente sin clases', (select (r ->> 'docentes_sin_clases')::int from r), 1);

-- Un estudiante dado de baja deja de contar
update public.estudiantes set activo = false, baja_motivo = 'traslado' where id = '00000000-0000-4000-8000-00000000c102';
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
create temp table r2 as select public.pendientes_datos() as r;
grant all on r2 to public;
reset role;
select pg_temp.esperar('un estudiante dado de baja ya no cuenta como pendiente', (select (r ->> 'estudiantes_sin_tutor')::int from r2), 0);
select pg_temp.esperar('...ni como activo', (select (r ->> 'estudiantes_activos')::int from r2), 2);

-- Permisos
do $$
begin
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin perform public.pendientes_datos(); raise exception 'FALLÓ: un docente vio los pendientes de datos';
  exception when insufficient_privilege then raise notice 'ok: un docente no puede ver los pendientes de datos'; end;
  reset role;
  set local role anon;
  begin perform public.pendientes_datos(); raise exception 'FALLÓ: un anónimo vio los pendientes de datos';
  exception when insufficient_privilege then raise notice 'ok: un anónimo no puede ver los pendientes de datos'; end;
  reset role;
end $$;

rollback;
select 'TODAS LAS PRUEBAS DE PENDIENTES DE DATOS PASARON' as resultado;
