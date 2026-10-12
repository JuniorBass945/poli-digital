-- =====================================================================
-- Pruebas de R1 · Panel de asistencia.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere las migraciones de asistencia y 20261014000100_panel_asistencia.sql.
-- =====================================================================
begin;

create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.esperar(p_nombre text, p_real numeric, p_esperado numeric) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLÓ: % (esperado %, obtenido %)', p_nombre, p_esperado, p_real;
  end if;
  raise notice 'ok: %', p_nombre;
end $$;

-- Datos de prueba (como propietario) -----------------------------------
insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000e1', 'Centro P');
insert into auth.users (id, email) values
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'doc1@p.test'), ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'doc2@p.test'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'coord@p.test'), ('77777777-7777-4777-8777-777777777777', 'dir@p.test'),
  ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6', 'tutor@p.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-4000-8000-0000000000e1', 'docente', 'Docente Uno'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', '00000000-0000-4000-8000-0000000000e1', 'docente', 'Docente Dos'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', '00000000-0000-4000-8000-0000000000e1', 'coordinacion', 'Coordinación'),
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-4000-8000-0000000000e1', 'direccion', 'Dirección'),
  ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6', '00000000-0000-4000-8000-0000000000e1', 'tutor', 'Tutor');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual)
  values ('00000000-0000-4000-8000-00000000ea01', '00000000-0000-4000-8000-0000000000e1', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion) values
  ('00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea01', '4.º', 'A'),
  ('00000000-0000-4000-8000-00000000eb02', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea01', '4.º', 'B');
insert into public.materias (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-0000000000e1', 'Matemática'),
  ('00000000-0000-4000-8000-00000000ec02', '00000000-0000-4000-8000-0000000000e1', 'Lengua');
insert into public.docentes (id, centro_id, perfil_id, nombre) values
  ('00000000-0000-4000-8000-00000000ed01', '00000000-0000-4000-8000-0000000000e1', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'Docente Uno'),
  ('00000000-0000-4000-8000-00000000ed02', '00000000-0000-4000-8000-0000000000e1', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'Docente Dos');
insert into public.asignaciones (id, centro_id, aula_id, materia_id, docente_id) values
  ('00000000-0000-4000-8000-00000000ee01', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-00000000ed01'),
  ('00000000-0000-4000-8000-00000000ee02', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000eb02', '00000000-0000-4000-8000-00000000ec02', '00000000-0000-4000-8000-00000000ed02');
insert into public.estudiantes (id, centro_id, matricula, nombres, apellidos) values
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-0000000000e1', 'P-1', 'Ana', 'Uno'),
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-0000000000e1', 'P-2', 'Beto', 'Dos'),
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-0000000000e1', 'P-3', 'Carla', 'Tres'),
  ('00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-0000000000e1', 'P-4', 'Dani', 'Cuatro'),
  ('00000000-0000-4000-8000-00000000e105', '00000000-0000-4000-8000-0000000000e1', 'P-5', 'Eva', 'Cinco');
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
  select '00000000-0000-4000-8000-0000000000e1', e.id,
         case when e.matricula in ('P-4', 'P-5') then '00000000-0000-4000-8000-00000000eb02'::uuid else '00000000-0000-4000-8000-00000000eb01'::uuid end,
         '00000000-0000-4000-8000-00000000ea01'
    from public.estudiantes e where e.centro_id = '00000000-0000-4000-8000-0000000000e1';

create temp table ctx as select (now() at time zone 'America/Santo_Domingo')::date as hoy;
grant all on ctx to public;

-- Clase A (3 estudiantes) en 4 días; clase B (2 estudiantes) en 2 días
create function pg_temp.reg(p_asig uuid, p_dias int, p_est uuid, p_estado text) returns void language sql as $$
  insert into public.asistencias (centro_id, asignacion_id, fecha, estudiante_id, estado)
  values ('00000000-0000-4000-8000-0000000000e1', p_asig, (select hoy from ctx) - p_dias, p_est, p_estado)
$$;
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000ee01'; b uuid := '00000000-0000-4000-8000-00000000ee02';
  e1 uuid := '00000000-0000-4000-8000-00000000e101'; e2 uuid := '00000000-0000-4000-8000-00000000e102'; e3 uuid := '00000000-0000-4000-8000-00000000e103';
  e4 uuid := '00000000-0000-4000-8000-00000000e104'; e5 uuid := '00000000-0000-4000-8000-00000000e105';
  d int;
begin
  -- Ana: ausente 3 días, presente el 4.º. Beto: tardanza el 2.º día. Carla: excusa el 1.º.
  for d in 1..4 loop
    perform pg_temp.reg(a, d, e1, case when d = 1 then 'presente' else 'ausente' end);   -- d=4 (hace 4 días), 3, 2 ausente; hace 1 presente
    perform pg_temp.reg(a, d, e2, case when d = 3 then 'tardanza' else 'presente' end);
    perform pg_temp.reg(a, d, e3, case when d = 4 then 'excusa' else 'presente' end);
    insert into public.asistencia_sesiones (centro_id, asignacion_id, fecha) values ('00000000-0000-4000-8000-0000000000e1', a, (select hoy from ctx) - d);
  end loop;
  for d in 1..2 loop
    perform pg_temp.reg(b, d, e4, case when d = 2 then 'ausente' else 'presente' end);
    perform pg_temp.reg(b, d, e5, 'presente');
    insert into public.asistencia_sesiones (centro_id, asignacion_id, fecha) values ('00000000-0000-4000-8000-0000000000e1', b, (select hoy from ctx) - d);
  end loop;
end $$;

create temp table r_todo as select 1 as k;
grant all on r_todo to public;

-- 1. Resumen, por día y por aula (coordinación ve todo) ------------------
select pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
create temp table p1 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx)) as r;
grant all on p1 to public;
reset role;
select pg_temp.esperar('total de registros', (select (r -> 'resumen' ->> 'total')::int from p1), 16);
select pg_temp.esperar('presentes', (select (r -> 'resumen' ->> 'presentes')::int from p1), 10);
select pg_temp.esperar('ausentes', (select (r -> 'resumen' ->> 'ausentes')::int from p1), 4);
select pg_temp.esperar('tardanzas', (select (r -> 'resumen' ->> 'tardanzas')::int from p1), 1);
select pg_temp.esperar('excusas', (select (r -> 'resumen' ->> 'excusas')::int from p1), 1);
select pg_temp.esperar('% de asistencia = (presentes + tardanzas) / total', (select (r -> 'resumen' ->> 'pct_asistencia')::numeric from p1), 68.8);
select pg_temp.esperar('6 listas pasadas', (select (r -> 'resumen' ->> 'listas')::int from p1), 6);
select pg_temp.esperar('4 días con lista', (select (r -> 'resumen' ->> 'dias_con_lista')::int from p1), 4);
select pg_temp.esperar('5 estudiantes', (select (r -> 'resumen' ->> 'estudiantes')::int from p1), 5);
select pg_temp.esperar('hay un punto por cada día con datos', (select jsonb_array_length(r -> 'por_dia') from p1), 4);
select pg_temp.esperar('el día más flojo (hace 4 días: 1 ausente y 1 excusa de 3 registros) tiene 33.3 %',
  (select min((d ->> 'pct')::numeric) from p1, jsonb_array_elements(r -> 'por_dia') d), 33.3);
select pg_temp.esperar('y el mejor día, 100 %', (select max((d ->> 'pct')::numeric) from p1, jsonb_array_elements(r -> 'por_dia') d), 100.0);
select pg_temp.esperar('hay 2 aulas comparadas', (select jsonb_array_length(r -> 'por_aula') from p1), 2);
select pg_temp.esperar('clase A: 12 registros, 66.7 %', (select (a ->> 'total')::int * 1000 + (a ->> 'pct')::numeric from p1, jsonb_array_elements(r -> 'por_aula') a where a ->> 'aula' = '4.º A'), 12066.7);
select pg_temp.esperar('clase B: 4 registros, 75.0 %', (select (a ->> 'total')::int * 1000 + (a ->> 'pct')::numeric from p1, jsonb_array_elements(r -> 'por_aula') a where a ->> 'aula' = '4.º B'), 4075.0);

-- 2. Estudiantes en riesgo ----------------------------------------------
select pg_temp.esperar('con umbral 3, solo Ana (3 días ausente)', (select jsonb_array_length(r -> 'en_riesgo') from p1), 1);
select pg_temp.esperar('...y se identifica con su aula actual',
  (select count(*) from p1, jsonb_array_elements(r -> 'en_riesgo') x where x ->> 'nombre' = 'Uno, Ana' and (x ->> 'dias_ausente')::int = 3 and x ->> 'aula' = '4.º A' and x ->> 'matricula' = 'P-1'), 1);
select pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
create temp table p2 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx), null, 1) as r;
grant all on p2 to public;
reset role;
select pg_temp.esperar('con umbral 1 aparecen Ana y Dani, en ese orden',
  (select count(*) from p2 where r -> 'en_riesgo' -> 0 ->> 'nombre' = 'Uno, Ana' and r -> 'en_riesgo' -> 1 ->> 'nombre' = 'Cuatro, Dani' and jsonb_array_length(r -> 'en_riesgo') = 2), 1);

-- 3. Filtros -----------------------------------------------------------------
select pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
create temp table p3 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx), '00000000-0000-4000-8000-00000000eb02') as r;
create temp table p4 as select public.panel_asistencia((select hoy from ctx) - 2, (select hoy from ctx)) as r;
grant all on p3, p4 to public;
reset role;
select pg_temp.esperar('filtrar por aula deja solo los 4 registros de 4.º B', (select (r -> 'resumen' ->> 'total')::int from p3), 4);
select pg_temp.esperar('filtrar por fechas deja solo los últimos 2 días (clase A: 6 + clase B: 4)', (select (r -> 'resumen' ->> 'total')::int from p4), 10);

-- 4. Clases sin lista hoy ---------------------------------------------------
select pg_temp.esperar('hoy nadie ha pasado lista: se listan las 2 clases (solo en día de semana)',
  (select jsonb_array_length(r -> 'sin_lista_hoy') from p1), case when extract(isodow from (select hoy from ctx)) between 1 and 5 then 2 else 0 end);
insert into public.asistencia_sesiones (centro_id, asignacion_id, fecha) values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ee01', (select hoy from ctx));
select pg_temp.como('77777777-7777-4777-8777-777777777777');
create temp table p5 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx)) as r;
grant all on p5 to public;
reset role;
select pg_temp.esperar('si una clase ya pasó lista hoy, deja de aparecer (dirección también ve el panel)',
  (select jsonb_array_length(r -> 'sin_lista_hoy') from p5), case when extract(isodow from (select hoy from ctx)) between 1 and 5 then 1 else 0 end);

-- 5. Cada rol ve lo suyo -----------------------------------------------------
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
create temp table p6 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx)) as r;
grant all on p6 to public;
reset role;
select pg_temp.esperar('un docente solo ve sus clases (la clase A: 12 registros)', (select (r -> 'resumen' ->> 'total')::int from p6), 12);
select pg_temp.como('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');
create temp table p7 as select public.panel_asistencia((select hoy from ctx) - 10, (select hoy from ctx)) as r;
grant all on p7 to public;
reset role;
select pg_temp.esperar('otro docente ve solo la suya (la clase B: 4 registros)', (select (r -> 'resumen' ->> 'total')::int from p7), 4);

-- 6. Validaciones y permisos ----------------------------------------------
do $$
declare hoy date := (select c.hoy from ctx c);
begin
  perform pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
  begin perform public.panel_asistencia(hoy, hoy - 5); raise exception 'FALLÓ: aceptó un rango invertido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un rango de fechas invertido'; end;
  begin perform public.panel_asistencia(hoy - 400, hoy); raise exception 'FALLÓ: aceptó más de un año';
  exception when sqlstate '22023' then raise notice 'ok: rechaza rangos de más de un año'; end;
  begin perform public.panel_asistencia(hoy - 5, hoy, null, 0); raise exception 'FALLÓ: aceptó un umbral inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un umbral inválido'; end;
  reset role;
  perform pg_temp.como('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6');
  begin perform public.panel_asistencia(hoy - 5, hoy); raise exception 'FALLÓ: un tutor vio el panel';
  exception when insufficient_privilege then raise notice 'ok: un tutor no puede ver el panel'; end;
  reset role;
  set local role anon;
  begin perform public.panel_asistencia(hoy - 5, hoy); raise exception 'FALLÓ: un anónimo vio el panel';
  exception when insufficient_privilege then raise notice 'ok: un anónimo no puede ver el panel'; end;
  reset role;
end $$;

rollback;
select 'TODAS LAS PRUEBAS DEL PANEL DE ASISTENCIA PASARON' as resultado;
