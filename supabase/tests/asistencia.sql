-- =====================================================================
-- Pruebas de R1 · Asistencia y avisos a tutores.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261013000100_asistencia_avisos.sql.
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

-- Lista de los 4 estudiantes del aula A, en orden fijo (Ana, Beto, Carla, Dani)
create function pg_temp.reg(a text, b text, c text, d text) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d101', 'estado', a),
    jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d102', 'estado', b),
    jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d103', 'estado', c),
    jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d104', 'estado', d))
$$;

-- Datos de prueba (como propietario) -----------------------------------
insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000d1', 'Centro K');
insert into auth.users (id, email) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@k.test'), ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'doc1@k.test'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'doc2@k.test'), ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'coord@k.test'),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'orient@k.test'), ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6', 'tutor@k.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', '00000000-0000-4000-8000-0000000000d1', 'admin', 'Admin K'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-4000-8000-0000000000d1', 'docente', 'Docente Uno'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', '00000000-0000-4000-8000-0000000000d1', 'docente', 'Docente Dos'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', '00000000-0000-4000-8000-0000000000d1', 'coordinacion', 'Coordinación K'),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', '00000000-0000-4000-8000-0000000000d1', 'orientacion', 'Orientación K'),
  ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6', '00000000-0000-4000-8000-0000000000d1', 'tutor', 'Tutor K');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual)
  values ('00000000-0000-4000-8000-00000000da01', '00000000-0000-4000-8000-0000000000d1', '2026-2027', '2026-08-24', '2027-06-30', true);
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion, especialidad) values
  ('00000000-0000-4000-8000-00000000db01', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000da01', '4.º', 'A', 'Informática'),
  ('00000000-0000-4000-8000-00000000db02', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000da01', '4.º', 'B', null);
insert into public.materias (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000dc01', '00000000-0000-4000-8000-0000000000d1', 'Matemática'),
  ('00000000-0000-4000-8000-00000000dc02', '00000000-0000-4000-8000-0000000000d1', 'Lengua');
insert into public.docentes (id, centro_id, perfil_id, nombre) values
  ('00000000-0000-4000-8000-00000000dd01', '00000000-0000-4000-8000-0000000000d1', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'Docente Uno'),
  ('00000000-0000-4000-8000-00000000dd02', '00000000-0000-4000-8000-0000000000d1', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'Docente Dos');
insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000db01', '00000000-0000-4000-8000-00000000dc01', '00000000-0000-4000-8000-00000000dd01'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000db01', '00000000-0000-4000-8000-00000000dc02', '00000000-0000-4000-8000-00000000dd01'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000db02', '00000000-0000-4000-8000-00000000dc02', '00000000-0000-4000-8000-00000000dd02');
insert into public.estudiantes (id, centro_id, matricula, nombres, apellidos) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-0000000000d1', 'K-1', 'Ana', 'Uno'),
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-0000000000d1', 'K-2', 'Beto', 'Dos'),
  ('00000000-0000-4000-8000-00000000d103', '00000000-0000-4000-8000-0000000000d1', 'K-3', 'Carla', 'Tres'),
  ('00000000-0000-4000-8000-00000000d104', '00000000-0000-4000-8000-0000000000d1', 'K-4', 'Dani', 'Cuatro'),
  ('00000000-0000-4000-8000-00000000d105', '00000000-0000-4000-8000-0000000000d1', 'K-5', 'Eva', 'Cinco');
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
  select '00000000-0000-4000-8000-0000000000d1', e.id, case when e.matricula = 'K-5' then '00000000-0000-4000-8000-00000000db02'::uuid else '00000000-0000-4000-8000-00000000db01'::uuid end,
         '00000000-0000-4000-8000-00000000da01' from public.estudiantes e where e.centro_id = '00000000-0000-4000-8000-0000000000d1';
insert into public.tutores (id, centro_id, nombre, parentesco, telefono) values
  ('00000000-0000-4000-8000-00000000de01', '00000000-0000-4000-8000-0000000000d1', 'Tutor Uno', 'Madre', '809-555-0001'),
  ('00000000-0000-4000-8000-00000000de02', '00000000-0000-4000-8000-0000000000d1', 'Tutor Dos', 'Padre', '809-555-0002'),
  ('00000000-0000-4000-8000-00000000de04', '00000000-0000-4000-8000-0000000000d1', 'Tutor Cuatro', 'Tía', '809-555-0004');
insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id, principal) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000de01', true),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000de02', true),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000d104', '00000000-0000-4000-8000-00000000de04', true);

create temp table ctx as
  select (now() at time zone 'America/Santo_Domingo')::date as hoy,
         (select a.id from public.asignaciones a where a.materia_id = '00000000-0000-4000-8000-00000000dc01') as mat,
         (select a.id from public.asignaciones a where a.materia_id = '00000000-0000-4000-8000-00000000dc02' and a.aula_id = '00000000-0000-4000-8000-00000000db01') as len;
grant all on ctx to public;

-- 1. El docente pasa lista --------------------------------------------
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
create temp table r1 as select public.guardar_asistencia((select mat from ctx), (select hoy from ctx), pg_temp.reg('ausente', 'presente', 'ausente', 'tardanza')) as r;
grant all on r1 to public;
select pg_temp.esperar('el docente ve sus 4 registros', (select count(*) from public.asistencias), 4);
reset role;
select pg_temp.esperar('el informe cuenta 2 ausentes', (select (r ->> 'ausentes')::int from r1), 2);
select pg_temp.esperar('1 presente, 1 tardanza', (select (r ->> 'presentes')::int * 10 + (r ->> 'tardanzas')::int from r1), 11);
select pg_temp.esperar('se crea 1 aviso (el ausente con tutor)', (select (r ->> 'avisos_creados')::int from r1), 1);
select pg_temp.esperar('el ausente sin tutor se informa', (select jsonb_array_length(r -> 'ausentes_sin_tutor') from r1), 1);
select pg_temp.esperar('...y es Carla Tres', (select count(*) from r1 where r -> 'ausentes_sin_tutor' ->> 0 = 'Carla Tres'), 1);
select pg_temp.esperar('queda la sesión registrada', (select count(*) from public.asistencia_sesiones where asignacion_id = (select mat from ctx)), 1);
select pg_temp.esperar('el aviso queda pendiente para el tutor correcto', (select count(*) from public.mensajes where estado = 'pendiente' and tutor_id = '00000000-0000-4000-8000-00000000de01' and canal = 'whatsapp_enlace'), 1);
select pg_temp.esperar('el texto nombra al centro, estudiante, materia y aula',
  (select count(*) from public.mensajes where texto like '%Centro K%' and texto like '%Ana Uno%' and texto like '%Matemática%' and texto like '%4.º A, Informática%' and texto like '%hoy%'), 1);
select pg_temp.esperar('se registró el evento para automatizaciones', (select count(*) from public.eventos where tipo = 'asistencia_guardada' and centro_id = '00000000-0000-4000-8000-0000000000d1'), 1);

-- 2. Corregir: ausente -> presente cancela; volver a ausente reactiva ---
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.guardar_asistencia((select mat from ctx), (select hoy from ctx), pg_temp.reg('presente', 'presente', 'ausente', 'tardanza'));
reset role;
select pg_temp.esperar('al corregir a presente, el aviso se cancela', (select count(*) from public.mensajes where estado = 'cancelado'), 1);
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.guardar_asistencia((select mat from ctx), (select hoy from ctx), pg_temp.reg('ausente', 'presente', 'ausente', 'tardanza'));
reset role;
select pg_temp.esperar('si vuelve a ausente, se reactiva el mismo aviso (no se duplica)', (select count(*) from public.mensajes), 1);
select pg_temp.esperar('...y está pendiente otra vez', (select count(*) from public.mensajes where estado = 'pendiente'), 1);
select pg_temp.esperar('seguimos con 4 asistencias (no se duplican)', (select count(*) from public.asistencias where asignacion_id = (select mat from ctx)), 4);

-- 3. Otra clase el mismo día: no se duplica el aviso -------------------
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
create temp table r3 as select public.guardar_asistencia((select len from ctx), (select hoy from ctx), pg_temp.reg('ausente', 'excusa', 'presente', 'ausente')) as r;
grant all on r3 to public;
reset role;
select pg_temp.esperar('Ana ausente en otra clase el mismo día: el aviso ya existía', (select (r ->> 'avisos_existentes')::int from r3), 1);
select pg_temp.esperar('Dani ausente en otra clase genera su aviso', (select (r ->> 'avisos_creados')::int from r3), 1);
select pg_temp.esperar('Beto con excusa no genera aviso', (select count(*) from public.mensajes where estudiante_id = '00000000-0000-4000-8000-00000000d102'), 0);
select pg_temp.esperar('hay 2 avisos en total (Ana y Dani)', (select count(*) from public.mensajes where estado = 'pendiente'), 2);

-- 4. Reglas de fecha, clase y lista --------------------------------------
do $$
declare hoy date := (select c.hoy from ctx c);
begin
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy + 1, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: aceptó una fecha futura';
  exception when sqlstate '22023' then raise notice 'ok: no acepta fechas futuras'; end;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy - 4, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: el docente pudo pasar lista de hace 4 días';
  exception when sqlstate '22023' then raise notice 'ok: el docente no puede pasar lista de hace más de 3 días'; end;
  perform public.guardar_asistencia((select mat from ctx), hoy - 3, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
  raise notice 'ok: el docente sí puede pasar lista de hace 3 días';
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, pg_temp.reg('presente', 'presente', 'presente', 'tarde'));
    raise exception 'FALLÓ: aceptó un estado inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un estado inválido'; end;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, (pg_temp.reg('presente', 'presente', 'presente', 'presente') - 3));
    raise exception 'FALLÓ: aceptó una lista incompleta';
  exception when sqlstate '22023' then raise notice 'ok: exige a todos los estudiantes del aula'; end;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy,
      pg_temp.reg('presente', 'presente', 'presente', 'presente') - 3 || jsonb_build_array(jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d105', 'estado', 'presente')));
    raise exception 'FALLÓ: aceptó a un estudiante de otra aula';
  exception when sqlstate '22023' then raise notice 'ok: rechaza a un estudiante que no es del aula'; end;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy,
      pg_temp.reg('presente', 'presente', 'presente', 'presente') - 3 || jsonb_build_array(jsonb_build_object('estudiante_id', '00000000-0000-4000-8000-00000000d101', 'estado', 'presente')));
    raise exception 'FALLÓ: aceptó un estudiante repetido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza estudiantes repetidos'; end;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, '[]'::jsonb);
    raise exception 'FALLÓ: aceptó una lista vacía';
  exception when sqlstate '22023' then raise notice 'ok: rechaza una lista vacía'; end;
  reset role;

  perform pg_temp.como('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');   -- otro docente
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: otro docente pudo pasar lista en una clase ajena';
  exception when insufficient_privilege then raise notice 'ok: un docente no puede pasar lista en la clase de otro'; end;
  reset role;

  perform pg_temp.como('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5');   -- orientación
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: orientación pudo pasar lista';
  exception when insufficient_privilege then raise notice 'ok: orientación no puede pasar lista'; end;
  reset role;
  perform pg_temp.como('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6');   -- tutor
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: un tutor pudo pasar lista';
  exception when insufficient_privilege then raise notice 'ok: un tutor no puede pasar lista'; end;
  reset role;
  set local role anon;
  begin
    perform public.guardar_asistencia((select mat from ctx), hoy, pg_temp.reg('presente', 'presente', 'presente', 'presente'));
    raise exception 'FALLÓ: un anónimo pudo pasar lista';
  exception when insufficient_privilege then raise notice 'ok: un anónimo no puede pasar lista'; end;
  reset role;

  -- Coordinación sí puede corregir fechas antiguas
  perform pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
  perform public.guardar_asistencia((select mat from ctx), hoy - 20, pg_temp.reg('presente', 'ausente', 'presente', 'presente'));
  raise notice 'ok: coordinación puede pasar o corregir lista de hace 20 días';
  reset role;
end $$;

-- 5. Lectura y escritura directa ---------------------------------------
select pg_temp.como('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');
select pg_temp.esperar('otro docente no ve asistencias ajenas', (select count(*) from public.asistencias), 0);
select pg_temp.esperar('ni sesiones', (select count(*) from public.asistencia_sesiones), 0);
select pg_temp.esperar('ni avisos ajenos', (select count(*) from public.mensajes), 0);
reset role;
select pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
select pg_temp.esperar('coordinación ve todas las sesiones', (select count(*) from public.asistencia_sesiones), 4);
select pg_temp.esperar('...y todos los avisos', (select count(*) from public.mensajes), 3);
reset role;
select pg_temp.como('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6');
select pg_temp.esperar('un tutor no ve asistencias ni avisos (el portal vendrá después)', (select count(*) from public.asistencias) + (select count(*) from public.mensajes), 0);
reset role;
do $$
begin
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin
    insert into public.asistencias (centro_id, asignacion_id, fecha, estudiante_id, estado)
      values ('00000000-0000-4000-8000-0000000000d1', (select mat from ctx), (select hoy from ctx) - 1, '00000000-0000-4000-8000-00000000d101', 'presente');
    raise exception 'FALLÓ: el docente pudo escribir directamente en asistencias';
  exception when insufficient_privilege then raise notice 'ok: nadie escribe directamente en asistencias (solo con la función)'; end;
  begin
    update public.mensajes set estado = 'enviado';
    raise exception 'FALLÓ: el docente pudo editar mensajes directamente';
  exception when insufficient_privilege then raise notice 'ok: nadie edita mensajes directamente'; end;
  reset role;
end $$;

-- 6. Gestionar avisos ---------------------------------------------------
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.gestionar_aviso((select m.id from public.mensajes m where m.estudiante_id = '00000000-0000-4000-8000-00000000d101'), 'enviado', 'Enviado por WhatsApp');
reset role;
select pg_temp.esperar('el docente marca el aviso como enviado, con su autor y fecha',
  (select count(*) from public.mensajes where estudiante_id = '00000000-0000-4000-8000-00000000d101' and estado = 'enviado' and gestionado_por = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2' and gestionado_en is not null and nota = 'Enviado por WhatsApp'), 1);
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.guardar_asistencia((select mat from ctx), (select hoy from ctx), pg_temp.reg('ausente', 'presente', 'ausente', 'tardanza'));
reset role;
select pg_temp.esperar('volver a guardar la lista no revierte un aviso ya enviado', (select count(*) from public.mensajes where estudiante_id = '00000000-0000-4000-8000-00000000d101' and estado = 'enviado'), 1);
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.gestionar_aviso((select m.id from public.mensajes m where m.estudiante_id = '00000000-0000-4000-8000-00000000d101'), 'pendiente');
select public.gestionar_aviso((select m.id from public.mensajes m where m.estudiante_id = '00000000-0000-4000-8000-00000000d104'), 'omitido', 'Ya hablé con la familia');
reset role;
select pg_temp.esperar('se puede volver a pendiente y omitir', (select count(*) from public.mensajes where (estudiante_id = '00000000-0000-4000-8000-00000000d101' and estado = 'pendiente' and gestionado_en is null) or (estudiante_id = '00000000-0000-4000-8000-00000000d104' and estado = 'omitido')), 2);

do $$
declare v_id uuid;
begin
  select m.id into v_id from public.mensajes m where m.estudiante_id = '00000000-0000-4000-8000-00000000d101';
  perform pg_temp.como('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');
  begin
    perform public.gestionar_aviso(v_id, 'enviado');
    raise exception 'FALLÓ: otro docente pudo gestionar un aviso ajeno';
  exception when insufficient_privilege then raise notice 'ok: un docente no gestiona avisos de otro'; end;
  reset role;
  perform pg_temp.como('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5');
  begin
    perform public.gestionar_aviso(v_id, 'enviado');
    raise exception 'FALLÓ: orientación pudo gestionar avisos';
  exception when insufficient_privilege then raise notice 'ok: orientación solo consulta los avisos'; end;
  reset role;
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin
    perform public.gestionar_aviso(v_id, 'cualquiera');
    raise exception 'FALLÓ: aceptó un estado inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un estado de aviso inválido'; end;
  reset role;
end $$;

-- Un aviso cancelado ya no se puede gestionar
select pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.guardar_asistencia((select mat from ctx), (select hoy from ctx), pg_temp.reg('presente', 'presente', 'ausente', 'tardanza'));
reset role;
do $$
begin
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin
    perform public.gestionar_aviso((select m.id from public.mensajes m where m.estudiante_id = '00000000-0000-4000-8000-00000000d101' and m.estado = 'cancelado'), 'enviado');
    raise exception 'FALLÓ: gestionó un aviso cancelado';
  exception when sqlstate '22023' then raise notice 'ok: un aviso cancelado no se puede enviar'; end;
  reset role;
end $$;

-- 7. Auditoría -------------------------------------------------------------
select pg_temp.esperar('las correcciones de asistencia quedan auditadas con su autor',
  (select count(*) > 0 from public.auditoria where tabla = 'asistencias' and operacion = 'UPDATE' and usuario_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2')::int, 1);
select pg_temp.esperar('las altas de asistencia no se auditan (llevan registrado_por)', (select count(*) from public.auditoria where tabla = 'asistencias' and operacion = 'INSERT'), 0);
select pg_temp.esperar('los avisos sí se auditan', (select count(*) > 0 from public.auditoria where tabla = 'mensajes')::int, 1);

rollback;
select 'TODAS LAS PRUEBAS DE ASISTENCIA PASARON' as resultado;
