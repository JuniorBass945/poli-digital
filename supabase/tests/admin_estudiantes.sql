-- =====================================================================
-- Pruebas de R1 · Administración · Estudiantes.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere haber aplicado la migración 20261010000100_admin_estudiantes.sql.
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
insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000e1', 'Centro E');
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@e.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'docente@e.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-4000-8000-0000000000e1', 'admin', 'Admin E'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-4000-8000-0000000000e1', 'docente', 'Docente E');
insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual) values
  ('00000000-0000-4000-8000-00000000ea01', '00000000-0000-4000-8000-0000000000e1', '2026-2027', '2026-08-24', '2027-06-30', true),
  ('00000000-0000-4000-8000-00000000ea02', '00000000-0000-4000-8000-0000000000e1', '2027-2028', '2027-08-23', '2028-06-30', false);
insert into public.aulas (id, centro_id, anio_escolar_id, grado, seccion) values
  ('00000000-0000-4000-8000-00000000eb01', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea01', '4.º', 'A'),
  ('00000000-0000-4000-8000-00000000eb02', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea01', '4.º', 'B'),
  ('00000000-0000-4000-8000-00000000eb03', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000ea02', '5.º', 'A');

-- 1. Crear un estudiante con tutor nuevo ---------------------------------
select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.crear_estudiante('E-100', '  Ana María ', 'Pérez', '00000000-0000-4000-8000-00000000eb01', '2010-05-03', null, 'Rosa Pérez', 'Madre', '809-555-1234', null);
reset role;
select pg_temp.esperar('se creó el estudiante (con espacios recortados)', (select count(*) from public.estudiantes where matricula = 'E-100' and nombres = 'Ana María'), 1);
select pg_temp.esperar('quedó matriculado en el aula y el año del aula',
  (select count(*) from public.matriculas m join public.estudiantes e on e.id = m.estudiante_id
    where e.matricula = 'E-100' and m.aula_id = '00000000-0000-4000-8000-00000000eb01' and m.anio_escolar_id = '00000000-0000-4000-8000-00000000ea01' and m.estado = 'activa'), 1);
select pg_temp.esperar('se creó el tutor y quedó vinculado como principal',
  (select count(*) from public.estudiante_tutor et join public.tutores t on t.id = et.tutor_id join public.estudiantes e on e.id = et.estudiante_id
    where e.matricula = 'E-100' and t.nombre = 'Rosa Pérez' and et.principal), 1);
select pg_temp.esperar('el consentimiento de WhatsApp quedó pendiente',
  (select count(*) from public.consentimientos c join public.tutores t on t.id = c.tutor_id
    where t.nombre = 'Rosa Pérez' and c.canal = 'whatsapp' and not c.otorgado), 1);

-- 2. Matrícula repetida ---------------------------------------------------
do $$
begin
  perform pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  begin
    perform public.crear_estudiante('E-100', 'Otro', 'Repetido', '00000000-0000-4000-8000-00000000eb01', null, null, 'X', null, '809-000-0000', null);
    raise exception 'FALLÓ: permitió una matrícula repetida';
  exception when unique_violation then
    raise notice 'ok: rechaza la matrícula repetida';
  end;
  reset role;
end $$;
select pg_temp.esperar('lo anterior no dejó datos a medias (nada se creó)', (select count(*) from public.estudiantes where apellidos = 'Repetido'), 0);
select pg_temp.esperar('ni un tutor huérfano', (select count(*) from public.tutores where nombre = 'X'), 0);

-- 3. Tutor existente (hermano) ------------------------------------------
select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.crear_estudiante('E-101', 'Luis', 'Pérez', '00000000-0000-4000-8000-00000000eb02', null,
  (select id from public.tutores where nombre = 'Rosa Pérez'));
reset role;
select pg_temp.esperar('un tutor puede tener dos estudiantes',
  (select count(*) from public.estudiante_tutor et join public.tutores t on t.id = et.tutor_id where t.nombre = 'Rosa Pérez'), 2);

-- 4. Permisos: un docente no puede -------------------------------------
do $$
begin
  perform pg_temp.como('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  begin
    perform public.crear_estudiante('E-999', 'No', 'Debe', '00000000-0000-4000-8000-00000000eb01', null, null, 'Y', null, '809-111-1111', null);
    raise exception 'FALLÓ: un docente pudo crear un estudiante';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede crear estudiantes';
  end;
  begin
    perform public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-100'), 'traslado');
    raise exception 'FALLÓ: un docente pudo dar de baja';
  exception when insufficient_privilege then
    raise notice 'ok: un docente no puede dar de baja';
  end;
  reset role;
end $$;

-- 5. Anónimos no pueden llamar a las funciones -------------------------
do $$
begin
  set local role anon;
  begin
    perform public.crear_estudiante('E-998', 'No', 'Anon', '00000000-0000-4000-8000-00000000eb01', null, null, 'Z', null, '809-222-2222', null);
    raise exception 'FALLÓ: un anónimo pudo crear un estudiante';
  exception when insufficient_privilege then
    raise notice 'ok: un anónimo no puede llamar a las funciones';
  end;
  reset role;
end $$;

-- 6. Editar: datos, tutor y cambio de aula ------------------------------
select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.actualizar_estudiante(
  (select id from public.estudiantes where matricula = 'E-100'),
  'E-100', 'Ana María', 'Pérez Díaz', '00000000-0000-4000-8000-00000000eb02', '2010-05-03',
  'Rosa Díaz', 'Madre', '829-555-9999', 'rosa@correo.test');
reset role;
select pg_temp.esperar('se actualizó el apellido', (select count(*) from public.estudiantes where matricula = 'E-100' and apellidos = 'Pérez Díaz'), 1);
select pg_temp.esperar('cambió de aula (misma matrícula activa)',
  (select count(*) from public.matriculas m join public.estudiantes e on e.id = m.estudiante_id
    where e.matricula = 'E-100' and m.aula_id = '00000000-0000-4000-8000-00000000eb02' and m.estado = 'activa'), 1);
select pg_temp.esperar('se actualizó el teléfono del tutor', (select count(*) from public.tutores where nombre = 'Rosa Díaz' and telefono = '829-555-9999'), 1);

do $$
begin
  perform pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  begin
    perform public.actualizar_estudiante((select id from public.estudiantes where matricula = 'E-100'),
      'E-100', 'Ana María', 'Pérez Díaz', '00000000-0000-4000-8000-00000000eb03');
    raise exception 'FALLÓ: permitió pasar a un aula de otro año escolar';
  exception when sqlstate '22023' then
    raise notice 'ok: no permite cambiar a un aula de otro año escolar';
  end;
  reset role;
end $$;

-- 7. Dar de baja: motivos y nota ---------------------------------------
do $$
begin
  perform pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  begin
    perform public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-101'), 'motivo_inventado');
    raise exception 'FALLÓ: aceptó un motivo inválido';
  exception when sqlstate '22023' then
    raise notice 'ok: rechaza un motivo inválido';
  end;
  begin
    perform public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-101'), 'otro', '   ');
    raise exception 'FALLÓ: aceptó "otro" sin nota';
  exception when sqlstate '22023' then
    raise notice 'ok: "otro" exige una nota';
  end;
  reset role;
end $$;

select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-101'), 'traslado', 'Se mudó a Santiago');
reset role;
select pg_temp.esperar('la baja guarda motivo, nota y fecha',
  (select count(*) from public.estudiantes where matricula = 'E-101' and not activo and baja_motivo = 'traslado' and baja_nota = 'Se mudó a Santiago' and baja_en is not null), 1);
select pg_temp.esperar('su matrícula queda retirada (no se borra)',
  (select count(*) from public.matriculas m join public.estudiantes e on e.id = m.estudiante_id where e.matricula = 'E-101' and m.estado = 'retirada'), 1);
select pg_temp.esperar('el estudiante sigue existiendo', (select count(*) from public.estudiantes where matricula = 'E-101'), 1);

do $$
begin
  perform pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  begin
    perform public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-101'), 'traslado');
    raise exception 'FALLÓ: permitió dar de baja dos veces';
  exception when sqlstate '22023' then
    raise notice 'ok: no se puede dar de baja a quien ya está de baja';
  end;
  reset role;
end $$;

-- 8. Reactivar ---------------------------------------------------------
select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.reactivar_estudiante((select id from public.estudiantes where matricula = 'E-101'));
reset role;
select pg_temp.esperar('reactivar limpia la baja',
  (select count(*) from public.estudiantes where matricula = 'E-101' and activo and baja_motivo is null and baja_en is null), 1);
select pg_temp.esperar('reactivar devuelve la matrícula activa',
  (select count(*) from public.matriculas m join public.estudiantes e on e.id = m.estudiante_id where e.matricula = 'E-101' and m.estado = 'activa'), 1);

-- 9. Un docente solo ve a los estudiantes activos de su aula -----------
insert into public.materias (id, centro_id, nombre) values ('00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-0000000000e1', 'Lengua');
insert into public.docentes (id, centro_id, perfil_id, nombre) values ('00000000-0000-4000-8000-00000000ed01', '00000000-0000-4000-8000-0000000000e1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Docente E');
insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id)
  values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000eb02', '00000000-0000-4000-8000-00000000ec01', '00000000-0000-4000-8000-00000000ed01');
select pg_temp.como('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select pg_temp.esperar('el docente del aula B ve a los 2 estudiantes de su aula (Ana pasó a B y Luis está en B)', (select count(*) from public.estudiantes), 2);
reset role;
select pg_temp.como('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.dar_baja_estudiante((select id from public.estudiantes where matricula = 'E-101'), 'retiro_voluntario');
reset role;
select pg_temp.como('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select pg_temp.esperar('un estudiante dado de baja desaparece de la lista del docente', (select count(*) from public.estudiantes), 1);
reset role;

-- 10. La auditoría registró lo ocurrido -------------------------------
select pg_temp.esperar('la auditoría guardó la baja con su autor',
  (select count(*) from public.auditoria where tabla = 'estudiantes' and operacion = 'UPDATE'
     and usuario_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and despues ->> 'baja_motivo' = 'retiro_voluntario'), 1);
select pg_temp.esperar('la auditoría guardó la creación de estudiantes',
  (select count(*) from public.auditoria where tabla = 'estudiantes' and operacion = 'INSERT' and usuario_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2);

rollback;
select 'TODAS LAS PRUEBAS DE ESTUDIANTES PASARON' as resultado;
