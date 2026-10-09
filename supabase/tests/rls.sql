-- =====================================================================
-- Pruebas de seguridad por rol (RLS) y auditoría.
-- Se ejecuta dentro de una transacción y al final hace ROLLBACK:
-- no deja datos. Si algo falla, lanza una excepción con el motivo.
--
-- Cómo correrla:
--   * Supabase local:  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls.sql
--   * Proyecto en la nube: pegar este archivo en SQL Editor y ejecutarlo.
-- =====================================================================
begin;

-- Utilidades de prueba (viven solo durante esta sesión) ----------------
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

-- Datos de prueba (como propietario) -----------------------------------
insert into public.centros (id, nombre) values
  ('00000000-0000-4000-8000-0000000000a1', 'Centro A'),
  ('00000000-0000-4000-8000-0000000000b1', 'Centro B');

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@a.test'),
  ('22222222-2222-4222-8222-222222222222', 'docente@a.test'),
  ('33333333-3333-4333-8333-333333333333', 'tutor@a.test'),
  ('44444444-4444-4444-8444-444444444444', 'admin@b.test'),
  ('55555555-5555-4555-8555-555555555555', 'orienta@a.test');

insert into public.perfiles (id, centro_id, rol, nombre) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'admin', 'Admin A'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000a1', 'docente', 'Docente A'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-0000000000a1', 'tutor', 'Tutor A'),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-0000000000b1', 'admin', 'Admin B'),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-4000-8000-0000000000a1', 'orientacion', 'Orientación A');

insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual) values
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000a1', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.materias (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-0000000000a1', 'Lengua');
insert into public.docentes (id, centro_id, perfil_id, nombre) values
  ('00000000-0000-4000-8000-00000000ac01', '00000000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222222', 'Docente A');
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion) values
  ('00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '4.º', 'A'),
  ('00000000-0000-4000-8000-00000000ad02', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '4.º', 'B');
-- El docente solo da clase en el aula 1.
insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01');
insert into public.estudiantes (id, centro_id, matricula, nombres, apellidos) values
  ('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-0000000000a1', 'T-1', 'Uno', 'Aula1'),
  ('00000000-0000-4000-8000-00000000ae02', '00000000-0000-4000-8000-0000000000a1', 'T-2', 'Dos', 'Aula1'),
  ('00000000-0000-4000-8000-00000000ae03', '00000000-0000-4000-8000-0000000000a1', 'T-3', 'Tres', 'Aula2');
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ae02', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ae03', '00000000-0000-4000-8000-00000000ad02', '00000000-0000-4000-8000-00000000aa01');
insert into public.tutores (id, centro_id, perfil_id, nombre) values
  ('00000000-0000-4000-8000-00000000af01', '00000000-0000-4000-8000-0000000000a1', '33333333-3333-4333-8333-333333333333', 'Tutor A'),
  ('00000000-0000-4000-8000-00000000af02', '00000000-0000-4000-8000-0000000000a1', null, 'Otro tutor');
insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af01'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000ae03', '00000000-0000-4000-8000-00000000af02');
insert into public.eventos (centro_id, tipo) values ('00000000-0000-4000-8000-0000000000a1', 'prueba');

-- 1. Administración del centro A ve todo su centro y nada del B ---------
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select pg_temp.esperar('admin ve los 3 estudiantes de su centro', (select count(*) from public.estudiantes), 3);
select pg_temp.esperar('admin ve 1 solo centro', (select count(*) from public.centros), 1);
reset role;

-- 2. Admin del centro B no ve datos del centro A ------------------------
select pg_temp.como('44444444-4444-4444-8444-444444444444');
select pg_temp.esperar('admin de otro centro ve 0 estudiantes', (select count(*) from public.estudiantes), 0);
select pg_temp.esperar('admin de otro centro ve 0 aulas', (select count(*) from public.aulas), 0);
reset role;

-- 3. Docente: solo estudiantes y tutores de su aula ---------------------
select pg_temp.como('22222222-2222-4222-8222-222222222222');
select pg_temp.esperar('docente ve 2 estudiantes (su aula)', (select count(*) from public.estudiantes), 2);
select pg_temp.esperar('docente ve 1 tutor (el de su aula)', (select count(*) from public.tutores), 1);
select pg_temp.esperar('docente ve solo su asignación', (select count(*) from public.asignaciones), 1);
select pg_temp.esperar('docente no ve la auditoría', (select count(*) from public.auditoria), 0);
reset role;

-- 4. Tutor: solo a su hijo ----------------------------------------------
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select pg_temp.esperar('tutor ve 1 estudiante (su hijo)', (select count(*) from public.estudiantes), 1);
select pg_temp.esperar('tutor ve solo su registro de tutor', (select count(*) from public.tutores), 1);
select pg_temp.esperar('tutor no ve docentes', (select count(*) from public.docentes), 0);
reset role;

-- 5. Orientación ve todos los estudiantes del centro --------------------
select pg_temp.como('55555555-5555-4555-8555-555555555555');
select pg_temp.esperar('orientación ve los 3 estudiantes', (select count(*) from public.estudiantes), 3);
reset role;

-- 6. Quién puede escribir -----------------------------------------------
do $$
begin
  perform pg_temp.como('22222222-2222-4222-8222-222222222222');   -- docente
  begin
    insert into public.estudiantes (centro_id, matricula, nombres, apellidos)
      values ('00000000-0000-4000-8000-0000000000a1', 'X-1', 'No', 'Debe');
    raise exception 'FALLÓ: el docente pudo crear un estudiante';
  exception when insufficient_privilege then
    raise notice 'ok: el docente no puede crear estudiantes';
  end;
  reset role;

  perform pg_temp.como('33333333-3333-4333-8333-333333333333');   -- tutor
  update public.estudiantes set nombres = 'Hackeado';
  reset role;
  if exists (select 1 from public.estudiantes where nombres = 'Hackeado') then
    raise exception 'FALLÓ: el tutor pudo modificar estudiantes';
  end if;
  raise notice 'ok: el tutor no puede modificar estudiantes';

  perform pg_temp.como('44444444-4444-4444-8444-444444444444');   -- admin de otro centro
  begin
    insert into public.estudiantes (centro_id, matricula, nombres, apellidos)
      values ('00000000-0000-4000-8000-0000000000a1', 'X-2', 'Cruce', 'Centros');
    raise exception 'FALLÓ: un admin pudo escribir en otro centro';
  exception when insufficient_privilege then
    raise notice 'ok: un admin no puede escribir en otro centro';
  end;
  reset role;
end $$;

-- 7. La bandeja de eventos no es accesible desde el cliente -------------
do $$
begin
  perform pg_temp.como('11111111-1111-4111-8111-111111111111');
  begin
    perform count(*) from public.eventos;
    raise exception 'FALLÓ: un usuario pudo leer la bandeja de eventos';
  exception when insufficient_privilege then
    raise notice 'ok: nadie del cliente lee los eventos';
  end;
  reset role;
end $$;

-- 8. Anónimos no tienen acceso a nada -----------------------------------
do $$
begin
  set local role anon;
  begin
    perform count(*) from public.estudiantes;
    raise exception 'FALLÓ: un anónimo pudo leer estudiantes';
  exception when insufficient_privilege then
    raise notice 'ok: un anónimo no accede a las tablas';
  end;
  reset role;
end $$;

-- 9. Auditoría: cada cambio queda registrado con su autor ---------------
select pg_temp.como('11111111-1111-4111-8111-111111111111');
update public.estudiantes set nombres = 'Uno corregido' where matricula = 'T-1';
update public.estudiantes set nombres = 'Uno corregido' where matricula = 'T-1';   -- sin cambio real: no se registra
select pg_temp.esperar('la auditoría registra 1 cambio real',
  (select count(*) from public.auditoria where tabla = 'estudiantes' and operacion = 'UPDATE' and usuario_id = '11111111-1111-4111-8111-111111111111'), 1);
select pg_temp.esperar('la auditoría guarda el valor anterior',
  (select count(*) from public.auditoria where tabla = 'estudiantes' and antes ->> 'nombres' = 'Uno' and despues ->> 'nombres' = 'Uno corregido'), 1);
select pg_temp.esperar('el admin sí lee la auditoría', (select least(count(*), 1) from public.auditoria), 1);
reset role;

-- 10. Ninguna tabla pública sin RLS (vigila las fases futuras) ----------
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if faltan is not null then
    raise exception 'FALLÓ: tablas sin RLS: %', faltan;
  end if;
  raise notice 'ok: todas las tablas públicas tienen RLS';
end $$;

rollback;
select 'TODAS LAS PRUEBAS PASARON' as resultado;
