-- =====================================================================
-- Pruebas de R1 · Administración: tutores y consentimiento de WhatsApp.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261014000200_admin_tutores.sql.
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

insert into public.centros (id, nombre) values ('00000000-0000-4000-8000-0000000000b1', 'Centro T');
insert into auth.users (id, email) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@t.test'), ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'docente@t.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', '00000000-0000-4000-8000-0000000000b1', 'admin', 'Admin T'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-4000-8000-0000000000b1', 'docente', 'Docente T');
insert into public.tutores (id, centro_id, nombre, parentesco, telefono) values
  ('00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-0000000000b1', 'Rosa Santos', 'Madre', '809-555-0001'),
  ('00000000-0000-4000-8000-00000000b102', '00000000-0000-4000-8000-0000000000b1', 'Juan Pérez', 'Padre', '809-555-0002');
insert into public.consentimientos (centro_id, tutor_id, canal) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000b101', 'whatsapp');   -- pendiente, como los crea el sistema

-- 1. Editar tutores --------------------------------------------------------
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', '  Rosa Santos Díaz ', 'Tía', '(829) 555 7788', 'rosa@correo.test');
reset role;
select pg_temp.esperar('se actualizan los datos del tutor (recortados y con el teléfono normalizado)',
  (select count(*) from public.tutores where id = '00000000-0000-4000-8000-00000000b101' and nombre = 'Rosa Santos Díaz' and parentesco = 'Tía' and telefono = '829-555-7788' and correo = 'rosa@correo.test'), 1);
select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', 'Rosa Santos Díaz', '', '1-809-555-7788', '');
reset role;
select pg_temp.esperar('se acepta el 1 inicial y se vacían el parentesco y el correo',
  (select count(*) from public.tutores where id = '00000000-0000-4000-8000-00000000b101' and telefono = '809-555-7788' and parentesco is null and correo is null), 1);

do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin perform public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', '', 'Madre', '809-555-1111'); raise exception 'FALLÓ: aceptó un nombre vacío';
  exception when sqlstate '22023' then raise notice 'ok: exige el nombre'; end;
  begin perform public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', 'X', 'Madre', '555-12'); raise exception 'FALLÓ: aceptó un teléfono inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un teléfono inválido'; end;
  begin perform public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', 'X', 'Madre', '809-555-1111', 'mal'); raise exception 'FALLÓ: aceptó un correo inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un correo inválido'; end;
  begin perform public.actualizar_tutor('00000000-0000-4000-8000-00000000b1ff', 'X', 'Madre', '809-555-1111'); raise exception 'FALLÓ: editó un tutor inexistente';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un tutor inexistente'; end;
  reset role;
  perform pg_temp.como('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
  begin perform public.actualizar_tutor('00000000-0000-4000-8000-00000000b101', 'X', 'Madre', '809-555-1111'); raise exception 'FALLÓ: un docente editó un tutor';
  exception when insufficient_privilege then raise notice 'ok: un docente no puede editar tutores'; end;
  begin perform public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, false, 'x'); raise exception 'FALLÓ: un docente registró un consentimiento';
  exception when insufficient_privilege then raise notice 'ok: un docente no puede registrar consentimientos'; end;
  reset role;
  set local role anon;
  begin perform public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, false, 'x'); raise exception 'FALLÓ: un anónimo registró un consentimiento';
  exception when insufficient_privilege then raise notice 'ok: un anónimo no puede registrar consentimientos'; end;
  reset role;
end $$;

-- 2. Consentimiento --------------------------------------------------------
do $$
begin
  perform pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
  begin perform public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, false, '   '); raise exception 'FALLÓ: aceptó el consentimiento sin evidencia';
  exception when sqlstate '22023' then raise notice 'ok: el consentimiento exige evidencia'; end;
  begin perform public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', false, true, null); raise exception 'FALLÓ: verificó un número sin consentimiento';
  exception when sqlstate '22023' then raise notice 'ok: no se verifica un número sin consentimiento'; end;
  begin perform public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, false, 'x', 'paloma'); raise exception 'FALLÓ: aceptó un canal inválido';
  exception when sqlstate '22023' then raise notice 'ok: rechaza un canal inválido'; end;
  reset role;
end $$;

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, false, ' Formulario firmado en la matrícula ');
reset role;
select pg_temp.esperar('se registra el consentimiento con su evidencia y su fecha',
  (select count(*) from public.consentimientos where tutor_id = '00000000-0000-4000-8000-00000000b101' and canal = 'whatsapp' and otorgado and not verificado and otorgado_en is not null and evidencia = 'Formulario firmado en la matrícula'), 1);
create temp table f1 as select otorgado_en as f from public.consentimientos where tutor_id = '00000000-0000-4000-8000-00000000b101';

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', true, true, 'Formulario firmado en la matrícula');
reset role;
select pg_temp.esperar('se verifica el número y se conserva la fecha original del consentimiento',
  (select count(*) from public.consentimientos c, f1 where c.tutor_id = '00000000-0000-4000-8000-00000000b101' and c.verificado and c.otorgado_en = f1.f), 1);

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.registrar_consentimiento('00000000-0000-4000-8000-00000000b101', false, false, 'Pidió dejar de recibir mensajes');
reset role;
select pg_temp.esperar('al retirar el consentimiento se limpian otorgado, fecha y verificación (la evidencia queda como motivo)',
  (select count(*) from public.consentimientos where tutor_id = '00000000-0000-4000-8000-00000000b101' and not otorgado and otorgado_en is null and not verificado and evidencia = 'Pidió dejar de recibir mensajes'), 1);

select pg_temp.como('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.registrar_consentimiento('00000000-0000-4000-8000-00000000b102', true, false, 'Autorizó por escrito');
reset role;
select pg_temp.esperar('si el tutor no tenía registro de consentimiento, se crea', (select count(*) from public.consentimientos where tutor_id = '00000000-0000-4000-8000-00000000b102' and otorgado), 1);
select pg_temp.esperar('hay un solo registro por tutor y canal', (select count(*) from public.consentimientos where centro_id = '00000000-0000-4000-8000-0000000000b1'), 2);

-- 3. Auditoría ----------------------------------------------------------------
select pg_temp.esperar('los cambios de consentimiento quedan auditados con su autor',
  (select count(*) from public.auditoria where tabla = 'consentimientos' and operacion = 'UPDATE' and usuario_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'), 3);
select pg_temp.esperar('y los de tutores también', (select count(*) from public.auditoria where tabla = 'tutores' and operacion = 'UPDATE' and usuario_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'), 2);

rollback;
select 'TODAS LAS PRUEBAS DE TUTORES PASARON' as resultado;
