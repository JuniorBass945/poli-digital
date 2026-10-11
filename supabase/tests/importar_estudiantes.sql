-- =====================================================================
-- Pruebas de R1 · Administración, parte 3: importación de estudiantes desde Excel.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261012000100_importar_estudiantes.sql.
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

-- Datos de prueba (como propietario) -----------------------------------
insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000a1', 'Centro I');
insert into auth.users (id, email) values
  ('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9', 'admin@i.test'),
  ('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', 'docente@i.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9', '00000000-0000-4000-8000-0000000000a1', 'admin', 'Admin I'),
  ('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', '00000000-0000-4000-8000-0000000000a1', 'docente', 'Docente I');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual) values
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-0000000000a1', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.aulas (centro_id, anio_escolar_id, grado, seccion, especialidad) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '4.º', 'A', 'Informática'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '5.º', 'B', 'Electricidad'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '5.º', 'B', 'Contabilidad'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000aa01', '6.º', 'C', null);
-- Un tutor que ya existe en el centro
insert into public.tutores (centro_id, nombre, parentesco, telefono)
  values ('00000000-0000-4000-8000-0000000000a1', 'Marta Existente', 'Madre', '809-555-0001');

create temp table datos (nombre text primary key, filas jsonb);
grant all on datos to public;
insert into datos values
('mixto', $json$[
 {"fila":2,"matricula":"I-001","nombres":"Ana","apellidos":"Pérez","fecha_nacimiento":"2010-05-03","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"Rosa Santos","tutor_parentesco":"Madre","tutor_telefono":"809-555-1111","tutor_correo":"rosa@correo.test"},
 {"fila":3,"matricula":"I-002","nombres":"Luis","apellidos":"Pérez","fecha_nacimiento":"","grado":"4to","seccion":"a","especialidad":"informática","tutor_nombre":"Rosa Santos","tutor_parentesco":"Madre","tutor_telefono":"(809) 555-1111","tutor_correo":""},
 {"fila":4,"matricula":"I-003","nombres":"Eva","apellidos":"Gómez","fecha_nacimiento":"","grado":"6","seccion":"C","especialidad":"","tutor_nombre":"Juan Gómez","tutor_parentesco":"Padre","tutor_telefono":"8295552222","tutor_correo":"correo-malo"},
 {"fila":5,"matricula":"I-004","nombres":"Sol","apellidos":"Díaz","fecha_nacimiento":"","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"Marta Existente","tutor_parentesco":"Madre","tutor_telefono":"1-809-555-0001","tutor_correo":""},
 {"fila":6,"matricula":"I-005","nombres":"Pedro","apellidos":"Ruiz","fecha_nacimiento":"","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"Otra Persona","tutor_parentesco":"Tía","tutor_telefono":"809-555-1111","tutor_correo":""},
 {"fila":7,"matricula":"I-006","nombres":"Error","apellidos":"Aula","fecha_nacimiento":"","grado":"6.º","seccion":"Z","especialidad":"","tutor_nombre":"X","tutor_parentesco":"","tutor_telefono":"809-555-3333","tutor_correo":""},
 {"fila":8,"matricula":"I-001","nombres":"Error","apellidos":"Repetida","fecha_nacimiento":"","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"X","tutor_parentesco":"","tutor_telefono":"809-555-3333","tutor_correo":""},
 {"fila":9,"matricula":"I-007","nombres":"Error","apellidos":"Telefono","fecha_nacimiento":"","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"X","tutor_parentesco":"","tutor_telefono":"555-12","tutor_correo":""},
 {"fila":10,"matricula":"I-008","nombres":"Error","apellidos":"Fecha","fecha_nacimiento":"31/02/2010","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"X","tutor_parentesco":"","tutor_telefono":"809-555-3333","tutor_correo":""},
 {"fila":11,"matricula":"I-009","nombres":"Error","apellidos":"Ambigua","fecha_nacimiento":"","grado":"5.º","seccion":"B","especialidad":"","tutor_nombre":"X","tutor_parentesco":"","tutor_telefono":"809-555-3333","tutor_correo":""},
 {"fila":12,"matricula":"I-010","nombres":"Error","apellidos":"SinTutor","fecha_nacimiento":"","grado":"4.º","seccion":"A","especialidad":"Informática","tutor_nombre":"","tutor_parentesco":"","tutor_telefono":"809-555-3333","tutor_correo":""}
]$json$::jsonb);

-- 1. Simulación: informa y no guarda -----------------------------------
select pg_temp.como('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9');
create temp table sim as select public.importar_estudiantes((select filas from datos where nombre = 'mixto'), true) as r;
grant all on sim to public;
reset role;
select pg_temp.esperar('la simulación cuenta 11 filas', (select (r ->> 'total')::int from sim), 11);
select pg_temp.esperar('5 filas válidas: 3 sin problema y 2 con advertencia', (select (r ->> 'importados')::int from sim), 5);
select pg_temp.esperar('2 filas con advertencia', (select (r ->> 'advertencias')::int from sim), 2);
select pg_temp.esperar('6 filas con error', (select (r ->> 'errores')::int from sim), 6);
select pg_temp.esperar('la simulación no guarda nada', (select count(*) from public.estudiantes where centro_id = '00000000-0000-4000-8000-0000000000a1'), 0);
select pg_temp.esperar('ni tutores nuevos', (select count(*) from public.tutores where centro_id = '00000000-0000-4000-8000-0000000000a1'), 1);

select pg_temp.esperar('grado "4to", sección en minúscula y especialidad sin tildes de mayúsculas se aceptan sin avisos',
  (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 3 and f ->> 'estado' = 'ok' and f ->> 'aula' = '4.º A, Informática'), 1);
select pg_temp.esperar('el grado "6" y el aula sin especialidad se resuelven (única) y avisan del correo malo',
  (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 4 and f ->> 'estado' = 'advertencia' and f ->> 'aula' = '6.º C'), 1);
select pg_temp.esperar('reconoce al tutor que ya existe (aunque el teléfono venga con 1-809)',
  (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 5 and f ->> 'accion' = 'tutor existente'), 1);
select pg_temp.esperar('reconoce al tutor repetido en el archivo (hermanos)',
  (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 3 and f ->> 'accion' = 'tutor repetido en el archivo'), 1);
select pg_temp.esperar('avisa si el mismo teléfono lo usa otra persona',
  (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 6 and f ->> 'estado' = 'advertencia' and (f -> 'mensajes' ->> 0) like '%Ya hay un tutor con este teléfono (Rosa Santos)%'), 1);
select pg_temp.esperar('error: aula inexistente', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 7 and f ->> 'estado' = 'error' and (f -> 'mensajes' ->> 0) like '%no existe%'), 1);
select pg_temp.esperar('error: matrícula repetida en el archivo', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 8 and (f -> 'mensajes' ->> 0) like '%repetida en el archivo%'), 1);
select pg_temp.esperar('error: teléfono inválido', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 9 and (f -> 'mensajes' ->> 0) like '%10 dígitos%'), 1);
select pg_temp.esperar('error: fecha inválida', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 10 and (f -> 'mensajes' ->> 0) like '%fecha%'), 1);
select pg_temp.esperar('error: aula ambigua sin especialidad', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 11 and f ->> 'estado' = 'error'), 1);
select pg_temp.esperar('error: falta el tutor', (select count(*) from sim, jsonb_array_elements(r -> 'filas') f where (f ->> 'fila')::int = 12 and (f -> 'mensajes' ->> 0) like '%nombre del tutor%'), 1);

-- 2. Importación real --------------------------------------------------
select pg_temp.como('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9');
create temp table imp as select public.importar_estudiantes((select filas from datos where nombre = 'mixto'), false) as r;
grant all on imp to public;
reset role;
select pg_temp.esperar('se importan 5 estudiantes', (select count(*) from public.estudiantes where centro_id = '00000000-0000-4000-8000-0000000000a1'), 5);
select pg_temp.esperar('cada uno queda matriculado en su aula, activo', (select count(*) from public.matriculas where centro_id = '00000000-0000-4000-8000-0000000000a1' and estado = 'activa'), 5);
select pg_temp.esperar('hermanos: Rosa Santos es tutora de dos estudiantes (y se creó una sola vez)',
  (select count(*) from public.tutores t join public.estudiante_tutor et on et.tutor_id = t.id where t.nombre = 'Rosa Santos' and t.centro_id = '00000000-0000-4000-8000-0000000000a1'), 2);
select pg_temp.esperar('el tutor que ya existía no se duplicó y ahora tiene un estudiante',
  (select count(*) from public.tutores t join public.estudiante_tutor et on et.tutor_id = t.id where t.nombre = 'Marta Existente'), 1);
select pg_temp.esperar('en total hay 4 tutores (1 que ya existía y 3 nuevos)', (select count(*) from public.tutores where centro_id = '00000000-0000-4000-8000-0000000000a1'), 4);
select pg_temp.esperar('los teléfonos quedaron normalizados (dos tutores con 809-555-1111 y uno con 829-555-2222)',
  (select count(*) from public.tutores where centro_id = '00000000-0000-4000-8000-0000000000a1' and telefono in ('809-555-1111', '829-555-2222')), 3);
select pg_temp.esperar('el correo inválido se ignoró', (select count(*) from public.tutores where nombre = 'Juan Gómez' and correo is null), 1);
select pg_temp.esperar('los 3 tutores nuevos tienen el consentimiento de WhatsApp pendiente',
  (select count(*) from public.consentimientos c join public.tutores t on t.id = c.tutor_id where t.centro_id = '00000000-0000-4000-8000-0000000000a1' and not c.otorgado), 3);
select pg_temp.esperar('el informe coincide con lo guardado', (select (r ->> 'importados')::int from imp), 5);

-- 3. Repetir la misma importación: todo es duplicado ---------------------
select pg_temp.como('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9');
create temp table imp2 as select public.importar_estudiantes((select filas from datos where nombre = 'mixto'), false) as r;
grant all on imp2 to public;
reset role;
select pg_temp.esperar('repetir la importación no crea nada', (select (r ->> 'importados')::int from imp2), 0);
select pg_temp.esperar('y los estudiantes siguen siendo 5', (select count(*) from public.estudiantes where centro_id = '00000000-0000-4000-8000-0000000000a1'), 5);

-- 4. Límites y permisos --------------------------------------------------
do $$
begin
  perform pg_temp.como('a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9');
  begin
    perform public.importar_estudiantes('[]'::jsonb, true);
    raise exception 'FALLÓ: aceptó un archivo vacío';
  exception when sqlstate '22023' then
    raise notice 'ok: rechaza un archivo sin filas';
  end;
  begin
    perform public.importar_estudiantes((select jsonb_agg(jsonb_build_object('matricula', 'M' || g)) from generate_series(1, 2001) g), true);
    raise exception 'FALLÓ: aceptó más de 2,000 filas';
  exception when sqlstate '22023' then
    raise notice 'ok: rechaza más de 2,000 filas';
  end;
  reset role;
  perform pg_temp.como('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8');
  begin
    perform public.importar_estudiantes((select filas from datos where nombre = 'mixto'), false);
    raise exception 'FALLÓ: un docente pudo importar';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede importar';
  end;
  reset role;
  set local role anon;
  begin
    perform public.importar_estudiantes('[{"matricula":"X"}]'::jsonb, true);
    raise exception 'FALLÓ: un anónimo pudo importar';
  exception when insufficient_privilege then
    raise notice 'ok: un anónimo no puede importar';
  end;
  reset role;
end $$;

-- 5. Auditoría -------------------------------------------------------------
select pg_temp.esperar('la auditoría registró las 5 altas con su autor',
  (select count(*) from public.auditoria where tabla = 'estudiantes' and operacion = 'INSERT' and usuario_id = 'a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9'), 5);

rollback;
select 'TODAS LAS PRUEBAS DE IMPORTACIÓN PASARON' as resultado;
