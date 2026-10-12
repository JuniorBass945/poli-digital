-- =====================================================================
-- Pruebas de R1 · Nombre dividido (títulos, nombres, apellidos) y control de personas repetidas.
-- Corre en una transacción y termina con ROLLBACK: no deja datos.
-- Requiere la migración 20261018000100_nombres_personas.sql.
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

create function pg_temp.esperar_texto(p_nombre text, p_real text, p_esperado text) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLÓ: % (esperado %, obtenido %)', p_nombre, p_esperado, p_real;
  end if;
  raise notice 'ok: %', p_nombre;
end $$;

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

insert into public.centros (id, nombre) values
  ('00000000-0000-4000-8000-0000000000f1', 'Centro A'), ('00000000-0000-4000-8000-0000000000f2', 'Centro B');
insert into auth.users (id, email) values
  ('f1000000-0000-4000-8000-000000000001', 'admin@a.test'),
  ('f1000000-0000-4000-8000-000000000002', 'dir@a.test'),
  ('f2000000-0000-4000-8000-000000000001', 'admin@b.test');
insert into public.perfiles (id, centro_id, rol, nombre) values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f1', 'admin', 'Admin A'),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000f1', 'direccion', 'Dirección A'),
  ('f2000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f2', 'admin', 'Admin B');
insert into public.docentes (id, centro_id, nombre) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-0000000000f1', 'Lic. María José Pérez Gómez'),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-0000000000f2', 'Lic. María José Pérez Gómez');

-- 1. Ayudas puras -----------------------------------------------------------------
select pg_temp.esperar_texto('compone título, nombres y apellidos', app.componer_nombre('Lic.', ' María José ', 'Pérez', 'Gómez'), 'Lic. María José Pérez Gómez');
select pg_temp.esperar_texto('el 2.º apellido es opcional', app.componer_nombre(null, 'Luis', 'Gómez', ''), 'Luis Gómez');
select pg_temp.esperar_texto('sin título compone solo el nombre', app.componer_nombre('', 'Ana', 'Gil', null), 'Ana Gil');
select pg_temp.esperar_texto('un título válido se conserva', app.titulo_valido(' Licda '), 'Licda');
select pg_temp.debe_fallar('rechaza un título con números', $$select app.titulo_valido('L1c')$$, '22023');
select pg_temp.debe_fallar('rechaza un título con espacios', $$select app.titulo_valido('Lic da')$$, '22023');
select pg_temp.esperar('las palabras ignoran tildes, mayúsculas y títulos', cardinality(app.tokens_nombre('Lic. MARÍA José')), 2);

-- 2. Crear docentes con el nombre dividido --------------------------------------------
select pg_temp.como('f1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('crear docente exige nombres', $$select public.crear_docente_persona('Lic', '  ', 'Pérez')$$, '22023');
select pg_temp.debe_fallar('crear docente exige primer apellido', $$select public.crear_docente_persona('Lic', 'Pedro', ' ')$$, '22023');
select pg_temp.debe_fallar('crear docente rechaza un título inválido', $$select public.crear_docente_persona('1', 'Pedro', 'Díaz')$$, '22023');
select public.crear_docente_persona('Ing.', 'Pedro', 'Díaz', 'Santos', 'pedro@f.test');
select pg_temp.esperar_texto('el docente guarda el nombre compuesto',
  (select nombre from public.docentes where correo = 'pedro@f.test'), 'Ing. Pedro Díaz Santos');
select pg_temp.esperar_texto('el docente guarda las partes',
  (select titulo || '|' || nombres || '|' || apellido1 || '|' || apellido2 from public.docentes where correo = 'pedro@f.test'), 'Ing.|Pedro|Díaz|Santos');
select public.crear_docente_persona(null, 'Rosa', 'Mella');
select pg_temp.esperar_texto('sin título ni 2.º apellido', (select nombre from public.docentes where nombres = 'Rosa'), 'Rosa Mella');

-- 3. Control de personas repetidas ----------------------------------------------------
select pg_temp.debe_fallar('no deja crear un docente repetido (otra escritura y tildes)',
  $$select public.crear_docente_persona('Licda', 'maria jose', 'PEREZ', 'gomez')$$, '22023');
select pg_temp.debe_fallar('no deja crear uno parecido (mismo nombre y 1.er apellido)',
  $$select public.crear_docente_persona(null, 'María', 'Pérez', 'Ruiz')$$, '22023');
select public.crear_docente_persona(null, 'María', 'Pérez', 'Ruiz', null, true);
select pg_temp.esperar('confirmando que es otra persona sí se crea', (select count(*) from public.docentes where nombre = 'María Pérez Ruiz'), 1);
select pg_temp.esperar('nombres distintos no chocan', (select jsonb_array_length(public.buscar_personas('Carlos', 'Pérez'))), 0);
select pg_temp.esperar('buscar_personas encuentra los parecidos', (select jsonb_array_length(public.buscar_personas('María', 'Pérez'))), 2);
select pg_temp.esperar('la coincidencia exacta va primero', (select ((public.buscar_personas('María José', 'Pérez', 'Gómez')) -> 0 ->> 'exacta')::boolean::int), 1);
select pg_temp.esperar('no ve a los docentes de otro centro', (select count(*) from jsonb_array_elements(public.buscar_personas('María José', 'Pérez', 'Gómez')) x where x ->> 'id' = '00000000-0000-4000-8000-00000000f002'), 0);

-- 4. Editar el nombre de un docente -----------------------------------------------------
select public.actualizar_docente_persona('00000000-0000-4000-8000-00000000f001', 'Licda', 'María José', 'Pérez', 'Gómez', 'mj@f.test');
select pg_temp.esperar_texto('editar recompone el nombre', (select nombre from public.docentes where id = '00000000-0000-4000-8000-00000000f001'), 'Licda María José Pérez Gómez');
select pg_temp.debe_fallar('editar un docente de otro centro falla', $$select public.actualizar_docente_persona('00000000-0000-4000-8000-00000000f002', 'Lic', 'X', 'Y')$$, '22023');

-- 5. Crear un acceso con nombre dividido ----------------------------------------------------
select pg_temp.esperar_texto('sugiere usuario con inicial y apellido', public.sugerir_usuario_partes('María José', 'Pérez'), 'mperez');
reset role;
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('f1000000-0000-4000-8000-0000000000c1', 'mperez@acceso.test', 'h1', '{"creado_por":"f1000000-0000-4000-8000-000000000001"}'),
  ('f1000000-0000-4000-8000-0000000000c2', 'dnuevo@acceso.test', 'h2', '{"creado_por":"f1000000-0000-4000-8000-000000000001"}'),
  ('f1000000-0000-4000-8000-0000000000c3', 'mperez2@acceso.test', 'h3', '{"creado_por":"f1000000-0000-4000-8000-000000000001"}'),
  ('f1000000-0000-4000-8000-0000000000c4', 'mperez3@acceso.test', 'h4', '{"creado_por":"f1000000-0000-4000-8000-000000000001"}');
select pg_temp.como('f1000000-0000-4000-8000-000000000001');
select pg_temp.debe_fallar('repetir a un docente existente sin elegirlo se bloquea',
  $$select public.validar_nuevo_acceso('mperez', null, array['orientacion']::public.app_role[], null, false, 'Licda', 'María José', 'Pérez', 'Gómez')$$, '22023');
select pg_temp.esperar_texto('elegir al docente existente deja continuar',
  public.validar_nuevo_acceso('mperez', null, array['docente']::public.app_role[], '00000000-0000-4000-8000-00000000f001', false, 'Licda', 'María José', 'Pérez', 'Gómez'), 'mperez');
select public.registrar_acceso('f1000000-0000-4000-8000-0000000000c1', 'mperez', null, array['docente', 'orientacion']::public.app_role[],
  '00000000-0000-4000-8000-00000000f001', false, 'Licda', 'María José', 'Pérez', 'Gómez');
select pg_temp.esperar_texto('el acceso guarda el nombre compuesto', (select nombre from public.perfiles where usuario = 'mperez'), 'Licda María José Pérez Gómez');
select pg_temp.esperar('el docente elegido queda ligado al acceso, sin duplicarse',
  (select count(*) from public.docentes where perfil_id = 'f1000000-0000-4000-8000-0000000000c1' and id = '00000000-0000-4000-8000-00000000f001'), 1);
select pg_temp.esperar('no se creó un segundo docente con ese nombre', (select count(*) from public.docentes where centro_id = '00000000-0000-4000-8000-0000000000f1' and nombres = 'María José'), 1);
select pg_temp.debe_fallar('alguien que ya tiene acceso no se vuelve a crear',
  $$select public.validar_nuevo_acceso('mperez9', null, array['orientacion']::public.app_role[], null, false, 'Licda', 'María José', 'Pérez', 'Gómez')$$, '22023');
select pg_temp.debe_fallar('el servidor también lo bloquea al registrar',
  $$select public.registrar_acceso('f1000000-0000-4000-8000-0000000000c3', 'mperez2', null, array['orientacion']::public.app_role[], null, false, 'Licda', 'María José', 'Pérez', 'Gómez')$$, '22023');
select public.registrar_acceso('f1000000-0000-4000-8000-0000000000c3', 'mperez2', null, array['orientacion']::public.app_role[], null, false,
  'Licda', 'María José', 'Pérez', 'Gómez', true);
select pg_temp.esperar('confirmando que es otra persona se crea el acceso', (select count(*) from public.perfiles where usuario = 'mperez2'), 1);
select pg_temp.debe_fallar('un usuario repetido sigue bloqueado aunque sea otra persona',
  $$select public.validar_nuevo_acceso('mperez', null, array['orientacion']::public.app_role[], null, false, null, 'Zoila', 'Cruz', null, true)$$, '23505');
select pg_temp.debe_fallar('el acceso exige primer apellido',
  $$select public.validar_nuevo_acceso('zcruz', null, array['orientacion']::public.app_role[], null, false, null, 'Zoila', ' ', null)$$, '22023');
-- Una persona nueva con docente nuevo
select public.registrar_acceso('f1000000-0000-4000-8000-0000000000c2', 'dnuevo', null, array['docente']::public.app_role[], null, true,
  'Lic', 'Daniel', 'Nuevo', null);
select pg_temp.esperar_texto('el docente nuevo hereda las partes del nombre',
  (select titulo || '|' || nombres || '|' || apellido1 from public.docentes where perfil_id = 'f1000000-0000-4000-8000-0000000000c2'), 'Lic|Daniel|Nuevo');

-- 6. Cambiar el nombre de un acceso (y de su docente) ------------------------------------
select public.actualizar_persona_acceso('f1000000-0000-4000-8000-0000000000c2', 'Ing', 'Daniel', 'Nuevo', 'Rojas');
select pg_temp.esperar_texto('cambia el nombre del acceso', (select nombre from public.perfiles where id = 'f1000000-0000-4000-8000-0000000000c2'), 'Ing Daniel Nuevo Rojas');
select pg_temp.esperar_texto('y el de su docente', (select nombre from public.docentes where perfil_id = 'f1000000-0000-4000-8000-0000000000c2'), 'Ing Daniel Nuevo Rojas');
select pg_temp.esperar('la lista de accesos trae las partes', (select count(*) from jsonb_array_elements(public.listar_accesos()) x where x ->> 'nombres' = 'Daniel' and x ->> 'apellido2' = 'Rojas'), 1);

-- 7. Permisos --------------------------------------------------------------------------------
reset role;
select pg_temp.como('f1000000-0000-4000-8000-000000000002');
select pg_temp.debe_fallar('dirección no crea docentes', $$select public.crear_docente_persona(null, 'Ana', 'Gil')$$, '42501');
select pg_temp.debe_fallar('dirección no busca personas', $$select public.buscar_personas('Ana', 'Gil')$$, '42501');
select pg_temp.debe_fallar('dirección no cambia nombres de accesos', $$select public.actualizar_persona_acceso('f1000000-0000-4000-8000-0000000000c2', null, 'A', 'B')$$, '42501');
reset role;
set local role anon;
select pg_temp.debe_fallar('anon no ejecuta crear_docente_persona', $$select public.crear_docente_persona(null, 'Ana', 'Gil')$$, '42501');
reset role;

select 'TODAS LAS PRUEBAS DE NOMBRES Y PERSONAS PASARON' as resultado;
rollback;
