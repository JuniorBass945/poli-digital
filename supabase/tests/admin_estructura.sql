-- =====================================================================
-- Pruebas de R1 · Administración, parte 2: docentes, materias, aulas y asignaciones.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261011000100_admin_estructura.sql.
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
insert into public.centros (id, nombre) values
  ('00000000-0000-4000-8000-0000000000f1', 'Centro F'),
  ('00000000-0000-4000-8000-0000000000f2', 'Centro G (sin año actual)');
insert into auth.users (id, email) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@f.test'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'docente.uno@f.test'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'admin@g.test'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'docente.otro@f.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', '00000000-0000-4000-8000-0000000000f1', 'admin', 'Admin F'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-4000-8000-0000000000f1', 'docente', 'Docente Uno'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', '00000000-0000-4000-8000-0000000000f2', 'admin', 'Admin G'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', '00000000-0000-4000-8000-0000000000f1', 'docente', 'Docente Otro');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual) values
  ('00000000-0000-4000-8000-00000000fa01', '00000000-0000-4000-8000-0000000000f1', '2026-2027', '2026-08-24', '2027-06-30', true);

-- 1. Docentes ----------------------------------------------------------
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.crear_docente('  Prof. Uno ', 'uno@f.test');
select public.crear_docente('Prof. Dos');
reset role;
select pg_temp.esperar('se crean docentes (nombre recortado)', (select count(*) from public.docentes where nombre = 'Prof. Uno' and correo = 'uno@f.test'), 1);

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.crear_docente('Otro Uno', 'UNO@F.TEST');
    raise exception 'FALLÓ: permitió un correo repetido';
  exception when unique_violation then
    raise notice 'ok: rechaza el correo repetido (sin importar mayúsculas)';
  end;
  begin
    perform public.crear_docente('   ');
    raise exception 'FALLÓ: permitió un nombre vacío';
  exception when sqlstate '22023' then
    raise notice 'ok: exige el nombre del docente';
  end;
  reset role;
end $$;

-- Vincula al docente Uno con su usuario (como lo hará la invitación)
update public.docentes set perfil_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2' where nombre = 'Prof. Uno';

-- 2. Materias ----------------------------------------------------------
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.crear_materia('Lengua Española', 'LEN');
select public.crear_materia('Matemática');
reset role;
select pg_temp.esperar('se crean materias', (select count(*) from public.materias where centro_id = '00000000-0000-4000-8000-0000000000f1'), 2);
do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.crear_materia('lengua española');
    raise exception 'FALLÓ: permitió una materia repetida';
  exception when unique_violation then
    raise notice 'ok: rechaza la materia repetida (sin importar mayúsculas)';
  end;
  reset role;
end $$;

-- 3. Aulas -------------------------------------------------------------
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.crear_aula('4.º', 'a', 'Informática', (select id from public.docentes where nombre = 'Prof. Uno'));
reset role;
select pg_temp.esperar('el aula se crea en el año actual con la sección en mayúscula',
  (select count(*) from public.aulas where grado = '4.º' and seccion = 'A' and especialidad = 'Informática'
     and anio_escolar_id = '00000000-0000-4000-8000-00000000fa01' and guia_id is not null), 1);
do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.crear_aula('4.º', 'A', 'Informática');
    raise exception 'FALLÓ: permitió un aula repetida';
  exception when unique_violation then
    raise notice 'ok: rechaza el aula repetida';
  end;
  begin
    perform public.crear_aula('5.º', 'A', null, '00000000-0000-4000-8000-000000000000');
    raise exception 'FALLÓ: aceptó un docente guía inexistente';
  exception when sqlstate '22023' then
    raise notice 'ok: rechaza un docente guía inexistente';
  end;
  reset role;
  perform pg_temp.como('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
  begin
    perform public.crear_aula('4.º', 'A');
    raise exception 'FALLÓ: creó un aula sin año escolar actual';
  exception when sqlstate '22023' then
    raise notice 'ok: exige un año escolar actual';
  end;
  reset role;
end $$;

-- 4. Asignaciones ------------------------------------------------------
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.asignar_materia(
  (select id from public.aulas where grado = '4.º' and seccion = 'A'),
  (select id from public.materias where nombre = 'Lengua Española'),
  (select id from public.docentes where nombre = 'Prof. Uno'));
reset role;
select pg_temp.esperar('se asigna la materia al aula con su docente', (select count(*) from public.asignaciones where activo and centro_id = '00000000-0000-4000-8000-0000000000f1'), 1);

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.asignar_materia(
      (select id from public.aulas where seccion = 'A'), (select id from public.materias where nombre = 'Lengua Española'),
      (select id from public.docentes where nombre = 'Prof. Dos'));
    raise exception 'FALLÓ: permitió asignar dos veces la misma materia en el aula';
  exception when sqlstate '22023' then
    raise notice 'ok: no permite asignar dos veces la misma materia en el aula';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.cambiar_docente_asignacion((select id from public.asignaciones where activo and centro_id = '00000000-0000-4000-8000-0000000000f1'), (select id from public.docentes where nombre = 'Prof. Dos'));
reset role;
select pg_temp.esperar('se cambia el docente de la materia',
  (select count(*) from public.asignaciones a join public.docentes d on d.id = a.docente_id where a.activo and a.centro_id = '00000000-0000-4000-8000-0000000000f1' and d.nombre = 'Prof. Dos'), 1);

-- 5. Archivar materia con y sin asignaciones ---------------------------
do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.archivar_materia((select id from public.materias where nombre = 'Lengua Española'));
    raise exception 'FALLÓ: archivó una materia asignada';
  exception when sqlstate '22023' then
    raise notice 'ok: no archiva una materia que está asignada';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.quitar_asignacion((select id from public.asignaciones where activo and centro_id = '00000000-0000-4000-8000-0000000000f1'));
select public.archivar_materia((select id from public.materias where nombre = 'Lengua Española'));
reset role;
select pg_temp.esperar('al quitar la asignación se puede archivar la materia',
  (select count(*) from public.materias where nombre = 'Lengua Española' and not activo and centro_id = '00000000-0000-4000-8000-0000000000f1'), 1);

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.asignar_materia(
      (select id from public.aulas where seccion = 'A'), (select id from public.materias where nombre = 'Lengua Española'),
      (select id from public.docentes where nombre = 'Prof. Dos'));
    raise exception 'FALLÓ: asignó una materia archivada';
  exception when sqlstate '22023' then
    raise notice 'ok: no asigna una materia archivada';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reactivar_materia((select id from public.materias where nombre = 'Lengua Española'));
select public.asignar_materia(
  (select id from public.aulas where seccion = 'A'), (select id from public.materias where nombre = 'Lengua Española'),
  (select id from public.docentes where nombre = 'Prof. Uno'));
reset role;
select pg_temp.esperar('volver a asignar reutiliza la misma fila (no duplica)',
  (select count(*) from public.asignaciones where centro_id = '00000000-0000-4000-8000-0000000000f1'), 1);
select pg_temp.esperar('y queda activa con el docente nuevo',
  (select count(*) from public.asignaciones a join public.docentes d on d.id = a.docente_id where a.activo and a.centro_id = '00000000-0000-4000-8000-0000000000f1' and d.nombre = 'Prof. Uno'), 1);

-- 6. Baja de docentes ---------------------------------------------------
do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.dar_baja_docente((select id from public.docentes where nombre = 'Prof. Uno'), 'renuncia');
    raise exception 'FALLÓ: dio de baja a un docente con clases';
  exception when sqlstate '22023' then
    raise notice 'ok: no da de baja a un docente con clases asignadas o guía de aula';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.cambiar_docente_asignacion((select id from public.asignaciones where activo and centro_id = '00000000-0000-4000-8000-0000000000f1'), (select id from public.docentes where nombre = 'Prof. Dos'));
select public.actualizar_aula((select id from public.aulas where seccion = 'A'), '4.º', 'A', 'Informática', (select id from public.docentes where nombre = 'Prof. Dos'));
reset role;

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.dar_baja_docente((select id from public.docentes where nombre = 'Prof. Uno'), 'inventado');
    raise exception 'FALLÓ: aceptó un motivo inválido';
  exception when sqlstate '22023' then
    raise notice 'ok: rechaza un motivo de baja inválido';
  end;
  begin
    perform public.dar_baja_docente((select id from public.docentes where nombre = 'Prof. Uno'), 'otro', '  ');
    raise exception 'FALLÓ: aceptó "otro" sin nota';
  exception when sqlstate '22023' then
    raise notice 'ok: "otro" exige nota';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.dar_baja_docente((select id from public.docentes where nombre = 'Prof. Uno'), 'jubilacion', 'Se jubila en diciembre');
reset role;
select pg_temp.esperar('la baja guarda motivo, nota y fecha',
  (select count(*) from public.docentes where nombre = 'Prof. Uno' and not activo and baja_motivo = 'jubilacion' and baja_nota is not null and baja_en is not null), 1);
select pg_temp.esperar('el docente sigue existiendo (no se borra)', (select count(*) from public.docentes where nombre = 'Prof. Uno'), 1);
select pg_temp.esperar('si tenía usuario, deja de poder entrar', (select count(*) from public.perfiles where id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2' and not activo), 1);

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.asignar_materia((select id from public.aulas where seccion = 'A'), (select id from public.materias where nombre = 'Matemática'),
      (select id from public.docentes where nombre = 'Prof. Uno'));
    raise exception 'FALLÓ: asignó a un docente dado de baja';
  exception when sqlstate '22023' then
    raise notice 'ok: no asigna a un docente dado de baja';
  end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reactivar_docente((select id from public.docentes where nombre = 'Prof. Uno'));
reset role;
select pg_temp.esperar('reactivar devuelve al docente y su acceso',
  (select count(*) from public.docentes d join public.perfiles p on p.id = d.perfil_id where d.nombre = 'Prof. Uno' and d.activo and d.baja_motivo is null and p.activo), 1);

-- 7. Archivar aulas -----------------------------------------------------
insert into public.estudiantes (id, centro_id, matricula, nombres, apellidos)
  values ('00000000-0000-4000-8000-00000000fe01', '00000000-0000-4000-8000-0000000000f1', 'F-1', 'Est', 'Uno');
insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
  select '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000fe01', a.id, a.anio_escolar_id from public.aulas a where a.seccion = 'A' and a.centro_id = '00000000-0000-4000-8000-0000000000f1';

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select pg_temp.esperar('el resumen cuenta los estudiantes activos del aula', (select activos from public.resumen_estudiantes_por_aula()), 1);
reset role;

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin
    perform public.archivar_aula((select id from public.aulas where seccion = 'A'));
    raise exception 'FALLÓ: archivó un aula con estudiantes';
  exception when sqlstate '22023' then
    raise notice 'ok: no archiva un aula con estudiantes activos';
  end;
  reset role;
end $$;

update public.matriculas set estado = 'retirada' where centro_id = '00000000-0000-4000-8000-0000000000f1';
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.archivar_aula((select id from public.aulas where seccion = 'A'));
reset role;
select pg_temp.esperar('el aula queda archivada y sus asignaciones dejan de estar activas',
  (select count(*) from public.aulas a where a.seccion = 'A' and a.centro_id = '00000000-0000-4000-8000-0000000000f1' and not a.activo
     and not exists (select 1 from public.asignaciones x where x.aula_id = a.id and x.activo)), 1);
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reactivar_aula((select id from public.aulas where seccion = 'A'));
reset role;
select pg_temp.esperar('se puede reactivar el aula', (select count(*) from public.aulas where seccion = 'A' and activo and centro_id = '00000000-0000-4000-8000-0000000000f1'), 1);

-- 8. Permisos ----------------------------------------------------------
do $$
begin
  perform pg_temp.como('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');   -- docente
  begin
    perform public.crear_aula('6.º', 'Z');
    raise exception 'FALLÓ: un docente pudo crear un aula';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede crear aulas';
  end;
  begin
    perform public.crear_docente('No Debe');
    raise exception 'FALLÓ: un docente pudo registrar docentes';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede registrar docentes';
  end;
  begin
    perform public.quitar_asignacion((select id from public.asignaciones limit 1));
    raise exception 'FALLÓ: un docente pudo quitar asignaciones';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede quitar asignaciones';
  end;
  reset role;
  set local role anon;
  begin
    perform public.crear_materia('Anon');
    raise exception 'FALLÓ: un anónimo pudo crear una materia';
  exception when insufficient_privilege then
    raise notice 'ok: un anónimo no puede llamar a las funciones';
  end;
  reset role;
end $$;

-- 9. Auditoría ---------------------------------------------------------
select pg_temp.esperar('la auditoría registró la baja del docente con su autor',
  (select count(*) from public.auditoria where tabla = 'docentes' and operacion = 'UPDATE'
     and usuario_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1' and despues ->> 'baja_motivo' = 'jubilacion'), 1);
select pg_temp.esperar('la auditoría registró las asignaciones',
  (select count(*) from public.auditoria where tabla = 'asignaciones' and usuario_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'), 6);

rollback;
select 'TODAS LAS PRUEBAS DE ESTRUCTURA PASARON' as resultado;
