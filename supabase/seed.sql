-- =====================================================================
-- Datos de demostración (ficticios) para el "Politécnico Demo".
--  * Supabase local: se carga solo con `npx supabase db reset`.
--  * Proyecto en la nube: pegar este archivo en SQL Editor y ejecutarlo.
-- Si el centro demo ya existe, no hace nada.
-- =====================================================================
do $$
declare
  c uuid := '00000000-0000-4000-8000-00000000c001';
  anio uuid := '00000000-0000-4000-8000-0000000a0001';
  nom_f text[] := array['Camila','Yesenia','Daniela','Stephanie','Rosanna','Génesis','Luz María','Esther','Yaneisi','Ana Belkis','Michelle','Alexandra'];
  nom_m text[] := array['Luis','Carlos','Rafael','Miguel','Ariel','Starlin','Kelvin','Eduardo','Yeison','Frank','José Manuel','Darwin'];
  ap1 text[] := array['Reyes','Martínez','Peña','Santos','Rodríguez','De la Cruz','Núñez','Almonte','Disla','Ureña','Jiménez','Rosario'];
  ap2 text[] := array['Batista','Castillo','Fermín','Hernández','Báez','Colón','Genao','Cabrera','Polanco','Liriano','Guzmán','Mejía'];
  tut text[] := array['Ramona','José','Altagracia','Pedro','Yolanda','Francisco','Mercedes','Juan','Rosa','Víctor'];
  m jsonb := '{}'::jsonb;
  d jsonb := '{}'::jsonb;
  a jsonb := '{}'::jsonb;
  mat text;
  doc text;
  aula_n int;
  i int;
  nombres text;
  apellidos text;
  est uuid;
  tutor uuid;
  tutor_primero uuid;
begin
  if exists (select 1 from public.centros where id = c) then
    raise notice 'El centro demo ya existe; no se hace nada.';
    return;
  end if;

  insert into public.centros (id, nombre, codigo) values (c, 'Politécnico Demo', 'DEMO-001');
  insert into public.anios_escolares (id, centro_id, nombre, inicio, fin, actual)
    values (anio, c, '2026-2027', '2026-08-24', '2027-06-30', true);
  insert into public.periodos (centro_id, anio_escolar_id, numero, nombre, inicio, fin, cerrado) values
    (c, anio, 1, '1.er período', '2026-08-24', '2026-10-30', true),
    (c, anio, 2, '2.º período', '2026-11-02', '2027-01-29', false),
    (c, anio, 3, '3.er período', '2027-02-01', '2027-04-16', false),
    (c, anio, 4, '4.º período', '2027-04-19', '2027-06-30', false);

  -- Materias
  foreach mat in array array['Lengua Española','Matemática','Inglés','Programación','Redes y Soporte',
                             'Circuitos Eléctricos','Instalaciones','Contabilidad General','Informática Contable'] loop
    insert into public.materias (centro_id, nombre) values (c, mat) returning id into est;
    m := m || jsonb_build_object(mat, est);
  end loop;

  -- Docentes
  foreach doc in array array['Prof. Carmen Peña','Prof. Rafael Guzmán','Prof. Mercedes Colón','Prof. Luis Almonte',
                             'Prof. Sandra Báez','Ing. Kelvin Disla','Ing. Ariel Fermín','Lic. Esther Genao'] loop
    insert into public.docentes (centro_id, nombre, correo)
      values (c, doc, lower(translate(regexp_replace(doc, '^(Prof\.|Ing\.|Lic\.) ', ''), 'áéíóúñ ', 'aeioun.')) || '@polidemo.test')
      returning id into est;
    d := d || jsonb_build_object(doc, est);
  end loop;

  -- Aulas (cada una con su docente guía)
  insert into public.aulas (centro_id, anio_escolar_id, grado, seccion, especialidad, guia_id)
    values (c, anio, '4.º', 'A', 'Informática', (d ->> 'Prof. Carmen Peña')::uuid) returning id into est;
  a := a || jsonb_build_object('1', est);
  insert into public.aulas (centro_id, anio_escolar_id, grado, seccion, especialidad, guia_id)
    values (c, anio, '4.º', 'B', 'Electricidad', (d ->> 'Prof. Rafael Guzmán')::uuid) returning id into est;
  a := a || jsonb_build_object('2', est);
  insert into public.aulas (centro_id, anio_escolar_id, grado, seccion, especialidad, guia_id)
    values (c, anio, '4.º', 'C', 'Contabilidad', (d ->> 'Prof. Mercedes Colón')::uuid) returning id into est;
  a := a || jsonb_build_object('3', est);

  -- Asignaciones (aula + materia + docente)
  insert into public.asignaciones (centro_id, aula_id, materia_id, docente_id)
  select c, (a ->> x.aula)::uuid, (m ->> x.materia)::uuid, (d ->> x.docente)::uuid
  from (values
    ('1','Lengua Española','Prof. Carmen Peña'), ('1','Matemática','Prof. Luis Almonte'), ('1','Inglés','Prof. Sandra Báez'),
    ('1','Programación','Ing. Kelvin Disla'), ('1','Redes y Soporte','Ing. Kelvin Disla'),
    ('2','Lengua Española','Prof. Rafael Guzmán'), ('2','Matemática','Prof. Luis Almonte'), ('2','Inglés','Prof. Sandra Báez'),
    ('2','Circuitos Eléctricos','Ing. Ariel Fermín'), ('2','Instalaciones','Ing. Ariel Fermín'),
    ('3','Lengua Española','Prof. Mercedes Colón'), ('3','Matemática','Prof. Luis Almonte'), ('3','Inglés','Prof. Sandra Báez'),
    ('3','Contabilidad General','Lic. Esther Genao'), ('3','Informática Contable','Lic. Esther Genao')
  ) as x(aula, materia, docente);

  -- 36 estudiantes (12 por aula), un tutor cada uno; los hermanos Tavárez comparten tutora
  for i in 1..36 loop
    aula_n := ((i - 1) / 12) + 1;
    nombres := case when i % 2 = 1 then nom_f[((i - 1) / 2) % 12 + 1] else nom_m[((i - 1) / 2) % 12 + 1] end;
    apellidos := ap1[(i - 1) % 12 + 1] || ' ' || ap2[((i - 1) * 7 + ((i - 1) / 12) * 5) % 12 + 1];
    if i = 1 then nombres := 'Camila'; apellidos := 'Tavárez Polanco'; end if;
    if i = 13 then nombres := 'Ismael'; apellidos := 'Tavárez Polanco'; end if;

    insert into public.estudiantes (centro_id, matricula, nombres, apellidos)
      values (c, 'P26-' || (1100 + (i - 1) * 7), nombres, apellidos) returning id into est;
    insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
      values (c, est, (a ->> aula_n::text)::uuid, anio);

    if i = 13 then
      tutor := tutor_primero;     -- mismo tutor que el estudiante 1
    else
      insert into public.tutores (centro_id, nombre, parentesco, telefono)
        values (c,
                case when i = 1 then 'Marisol Tavárez Polanco' else tut[(i * 3) % 10 + 1] || ' ' || split_part(apellidos, ' ', 1) || ' ' || ap2[(i * 3) % 12 + 1] end,
                case when i = 1 then 'Madre' when (i * 3) % 10 in (1, 3, 5, 7, 9) then 'Padre' else 'Madre' end,
                '809-555-' || (1000 + i))
        returning id into tutor;
      insert into public.consentimientos (centro_id, tutor_id, canal, otorgado, otorgado_en, verificado)
        values (c, tutor, 'whatsapp', i % 12 <> 5, case when i % 12 <> 5 then now() end, i % 17 <> 11);
      if i = 1 then tutor_primero := tutor; end if;
    end if;
    insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id, principal) values (c, est, tutor, true);
  end loop;

  -- Banderas de módulos: solo lo ya construido está activo
  insert into public.modulos_activos (centro_id, modulo, activo)
  select c, x.modulo, x.activo from (values
    ('administracion', true), ('asistencia', true), ('avisos', true),
    ('calificaciones', false), ('actividades', false), ('orientacion', false),
    ('portal', false), ('estadisticas', false), ('planificacion', false)
  ) as x(modulo, activo);

  -- La carga de demostración no debe llenar el historial de auditoría.
  delete from public.auditoria where centro_id = c;
end $$;
