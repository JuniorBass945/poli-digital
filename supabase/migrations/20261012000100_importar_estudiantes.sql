-- =====================================================================
-- Poli Digital · R1 · Administración, parte 3: importación de estudiantes desde Excel
--
-- importar_estudiantes(p_filas, p_simular):
--   * p_simular = true  -> solo revisa cada fila y devuelve qué pasaría (no guarda nada).
--   * p_simular = false -> guarda las filas válidas (con o sin advertencias) en una sola
--                          transacción y devuelve el mismo informe. Las filas con error se omiten.
-- Cada fila trae: fila, matricula, nombres, apellidos, fecha_nacimiento (AAAA-MM-DD), grado, seccion,
-- especialidad, tutor_nombre, tutor_parentesco, tutor_telefono, tutor_correo.
-- Corre con los permisos de quien llama (security invoker) y exige el rol de administración.
-- =====================================================================

create or replace function public.importar_estudiantes(p_filas jsonb, p_simular boolean default true) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('importar estudiantes');
  v_anio uuid;
  r record;
  v_res jsonb := '[]'::jsonb;
  v_msgs text[];
  v_estado text;
  v_vistas text[] := '{}';
  v_mapa jsonb := '{}'::jsonb;               -- clave del tutor -> id (o 'nuevo' en simulación)
  v_tels jsonb := '{}'::jsonb;               -- teléfono -> nombre del primer tutor visto en el archivo
  v_total int := 0; v_ok int := 0; v_adv int := 0; v_err int := 0;
  v_importados int := 0; v_tut_nuevos int := 0; v_tut_reusados int := 0;

  v_n int;
  v_matricula text; v_nombres text; v_apellidos text; v_fecha_txt text; v_fecha date;
  v_grado_in text; v_grado text; v_seccion text; v_esp text;
  v_tnombre text; v_tpar text; v_ttel text; v_tdig text; v_tcorreo text;
  v_aula public.aulas%rowtype;
  v_cuenta int;
  v_clave text; v_tutor uuid; v_otro_nombre text;
  v_est uuid;
  v_accion text;
begin
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene filas para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 2000 then
    raise exception 'El archivo tiene más de 2,000 filas. Divídelo en partes.' using errcode = '22023';
  end if;
  select a.id into v_anio from public.anios_escolares a where a.centro_id = v_centro and a.actual;
  if v_anio is null then
    raise exception 'No hay un año escolar actual configurado.' using errcode = '22023';
  end if;

  for r in select f.ord, f.fila from jsonb_array_elements(p_filas) with ordinality as f(fila, ord) loop
    v_total := v_total + 1;
    v_msgs := '{}'; v_estado := 'ok'; v_accion := '';
    v_tutor := null; v_aula := null; v_fecha := null; v_otro_nombre := null;

    v_n := coalesce(nullif(r.fila ->> 'fila', '')::int, r.ord::int + 1);
    v_matricula := btrim(coalesce(r.fila ->> 'matricula', ''));
    v_nombres := btrim(coalesce(r.fila ->> 'nombres', ''));
    v_apellidos := btrim(coalesce(r.fila ->> 'apellidos', ''));
    v_fecha_txt := btrim(coalesce(r.fila ->> 'fecha_nacimiento', ''));
    v_grado_in := btrim(coalesce(r.fila ->> 'grado', ''));
    v_seccion := upper(btrim(coalesce(r.fila ->> 'seccion', '')));
    v_esp := btrim(coalesce(r.fila ->> 'especialidad', ''));
    v_tnombre := btrim(coalesce(r.fila ->> 'tutor_nombre', ''));
    v_tpar := btrim(coalesce(r.fila ->> 'tutor_parentesco', ''));
    v_ttel := btrim(coalesce(r.fila ->> 'tutor_telefono', ''));
    v_tcorreo := btrim(coalesce(r.fila ->> 'tutor_correo', ''));

    -- Obligatorios
    if v_matricula = '' then v_msgs := v_msgs || 'Falta la matrícula.'::text; end if;
    if v_nombres = '' then v_msgs := v_msgs || 'Faltan los nombres.'::text; end if;
    if v_apellidos = '' then v_msgs := v_msgs || 'Faltan los apellidos.'::text; end if;
    if v_grado_in = '' then v_msgs := v_msgs || 'Falta el grado.'::text; end if;
    if v_seccion = '' then v_msgs := v_msgs || 'Falta la sección.'::text; end if;
    if v_tnombre = '' then v_msgs := v_msgs || 'Falta el nombre del tutor.'::text; end if;

    -- Fecha de nacimiento (opcional, AAAA-MM-DD)
    if v_fecha_txt <> '' then
      begin
        if v_fecha_txt !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'formato'; end if;
        v_fecha := v_fecha_txt::date;
      exception when others then
        v_fecha := null;
        v_msgs := v_msgs || 'La fecha de nacimiento no es válida (usa AAAA-MM-DD o una fecha de Excel).'::text;
      end;
    end if;

    -- Teléfono del tutor
    v_tdig := regexp_replace(v_ttel, '\D', '', 'g');
    if length(v_tdig) = 11 and left(v_tdig, 1) = '1' then v_tdig := substr(v_tdig, 2); end if;
    if v_ttel = '' then
      v_msgs := v_msgs || 'Falta el teléfono del tutor.'::text;
    elsif length(v_tdig) <> 10 then
      v_msgs := v_msgs || 'El teléfono del tutor debe tener 10 dígitos.'::text;
    else
      v_ttel := substr(v_tdig, 1, 3) || '-' || substr(v_tdig, 4, 3) || '-' || substr(v_tdig, 7);
    end if;

    -- Grado: acepta 4, 4to, 4º, 4.º ...
    v_grado := substring(v_grado_in from '^\s*([1-6])');
    if v_grado_in <> '' and v_grado is null then
      v_msgs := v_msgs || ('El grado "' || v_grado_in || '" no es válido (usa de 1.º a 6.º).');
    elsif v_grado is not null then
      v_grado := v_grado || '.' || chr(186);
    end if;

    -- Aula (debe existir y estar activa en el año actual)
    if v_grado is not null and v_seccion <> '' then
      select * into v_aula from public.aulas a
       where a.centro_id = v_centro and a.anio_escolar_id = v_anio and a.activo
         and a.grado = v_grado and a.seccion = v_seccion
         and coalesce(lower(a.especialidad), '') = lower(v_esp);
      if not found and v_esp = '' then
        select count(*) into v_cuenta from public.aulas a
         where a.centro_id = v_centro and a.anio_escolar_id = v_anio and a.activo and a.grado = v_grado and a.seccion = v_seccion;
        if v_cuenta = 1 then
          select * into v_aula from public.aulas a
           where a.centro_id = v_centro and a.anio_escolar_id = v_anio and a.activo and a.grado = v_grado and a.seccion = v_seccion;
        end if;
      end if;
      if v_aula.id is null then
        v_msgs := v_msgs || ('El aula ' || v_grado || ' ' || v_seccion || case when v_esp <> '' then ', ' || v_esp else '' end
                              || ' no existe o está archivada. Créala primero en Gestión de datos > Aulas.');
      end if;
    end if;

    -- Matrícula repetida en la base o en el archivo
    if v_matricula <> '' then
      if exists (select 1 from public.estudiantes e where e.centro_id = v_centro and lower(e.matricula) = lower(v_matricula)) then
        v_msgs := v_msgs || 'Ya existe un estudiante con esa matrícula.'::text;
      elsif lower(v_matricula) = any (v_vistas) then
        v_msgs := v_msgs || 'La matrícula está repetida en el archivo.'::text;
      end if;
      v_vistas := v_vistas || lower(v_matricula);
    end if;

    -- ¿Hay errores hasta aquí?
    if array_length(v_msgs, 1) is not null then v_estado := 'error'; end if;

    -- Tutor: reutiliza uno igual (mismo teléfono y nombre) o crea uno nuevo
    if v_estado <> 'error' then
      v_clave := v_ttel || '|' || lower(v_tnombre);
      if v_mapa ? v_clave then
        v_tutor := nullif(v_mapa ->> v_clave, 'nuevo')::uuid;
        v_accion := 'tutor repetido en el archivo';
        v_tut_reusados := v_tut_reusados + 1;
      else
        select t.id into v_tutor from public.tutores t
         where t.centro_id = v_centro and t.activo and lower(t.nombre) = lower(v_tnombre)
           and regexp_replace(coalesce(t.telefono, ''), '\D', '', 'g') = v_tdig
         limit 1;
        if v_tutor is not null then
          v_accion := 'tutor existente';
          v_tut_reusados := v_tut_reusados + 1;
        else
          v_accion := 'tutor nuevo';
          v_tut_nuevos := v_tut_nuevos + 1;
          select t.nombre into v_otro_nombre from public.tutores t
           where t.centro_id = v_centro and t.activo and regexp_replace(coalesce(t.telefono, ''), '\D', '', 'g') = v_tdig limit 1;
          if v_otro_nombre is null and v_tels ? v_ttel and lower(v_tels ->> v_ttel) <> lower(v_tnombre) then
            v_otro_nombre := v_tels ->> v_ttel;
          end if;
          if not (v_tels ? v_ttel) then v_tels := v_tels || jsonb_build_object(v_ttel, v_tnombre); end if;
          if v_otro_nombre is not null then
            v_msgs := v_msgs || ('Ya hay un tutor con este teléfono (' || v_otro_nombre || '). Se crea uno nuevo; revisa si es la misma persona.');
          end if;
        end if;
        v_mapa := v_mapa || jsonb_build_object(v_clave, coalesce(v_tutor::text, 'nuevo'));
      end if;

      if v_tcorreo <> '' and v_tcorreo !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        v_msgs := v_msgs || 'El correo del tutor no parece válido: se ignora.'::text;
        v_tcorreo := '';
      end if;
      if array_length(v_msgs, 1) is not null then v_estado := 'advertencia'; end if;
    end if;

    -- Guardar
    if v_estado <> 'error' then
      v_importados := v_importados + 1;
      if not p_simular then
        insert into public.estudiantes (centro_id, matricula, nombres, apellidos, fecha_nacimiento)
          values (v_centro, v_matricula, v_nombres, v_apellidos, v_fecha) returning id into v_est;
        insert into public.matriculas (centro_id, estudiante_id, aula_id, anio_escolar_id)
          values (v_centro, v_est, v_aula.id, v_aula.anio_escolar_id);
        if v_tutor is null then
          insert into public.tutores (centro_id, nombre, parentesco, telefono, correo)
            values (v_centro, v_tnombre, nullif(v_tpar, ''), v_ttel, nullif(v_tcorreo, ''))
            returning id into v_tutor;
          insert into public.consentimientos (centro_id, tutor_id, canal) values (v_centro, v_tutor, 'whatsapp');
          v_mapa := v_mapa || jsonb_build_object(v_clave, v_tutor::text);
        end if;
        insert into public.estudiante_tutor (centro_id, estudiante_id, tutor_id, principal)
          values (v_centro, v_est, v_tutor, true);
      end if;
    end if;

    if v_estado = 'ok' then v_ok := v_ok + 1; elsif v_estado = 'advertencia' then v_adv := v_adv + 1; else v_err := v_err + 1; end if;
    v_res := v_res || jsonb_build_object(
      'fila', v_n, 'estado', v_estado, 'mensajes', to_jsonb(v_msgs), 'accion', v_accion,
      'matricula', v_matricula, 'estudiante', btrim(v_nombres || ' ' || v_apellidos),
      'aula', case when v_aula.id is not null then v_aula.grado || ' ' || v_aula.seccion || coalesce(', ' || v_aula.especialidad, '') else '' end,
      'tutor', v_tnombre);
  end loop;

  return jsonb_build_object(
    'simulacion', p_simular, 'total', v_total, 'ok', v_ok, 'advertencias', v_adv, 'errores', v_err,
    'importados', v_importados, 'tutores_nuevos', v_tut_nuevos, 'tutores_reutilizados', v_tut_reusados,
    'filas', v_res);
end $$;

revoke execute on function public.importar_estudiantes(jsonb, boolean) from public, anon;
grant execute on function public.importar_estudiantes(jsonb, boolean) to authenticated;
