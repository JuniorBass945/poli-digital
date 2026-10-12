-- =====================================================================
-- Poli Digital · Rendimiento de la seguridad por fila y del panel de asistencia
--
-- Problema: las políticas llamaban a app.centro_actual(), app.tiene_rol(...) y auth.uid()
-- UNA VEZ POR CADA FILA leída, y cada llamada consulta la tabla de perfiles. Con miles de
-- registros de asistencia el panel tardaba segundos.
-- Solución: envolver esas llamadas en una subconsulta, "(select ...)", para que Postgres las
-- evalúe una sola vez por consulta. El comportamiento de seguridad NO cambia: solo cuándo se calcula.
-- Además, panel_asistencia lee una sola vez los registros del período (antes los leía cuatro veces).
-- =====================================================================

create function pg_temp.envolver(p_texto text) returns text language sql immutable as $$
  select case when p_texto is null then null else
    regexp_replace(
      regexp_replace(
        regexp_replace(p_texto, '(?<!SELECT )(app\.centro_actual\(\))', '(SELECT \1)', 'g'),
        '(?<!SELECT )(app\.tiene_rol\([^()]*\))', '(SELECT \1)', 'g'),
      '(?<!SELECT )(auth\.uid\(\))', '(SELECT \1)', 'g')
  end
$$;

do $$
declare
  p record;
  v_q text;
  v_c text;
  v_sql text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    v_q := pg_temp.envolver(p.qual);
    v_c := pg_temp.envolver(p.with_check);
    if v_q is distinct from p.qual or v_c is distinct from p.with_check then
      v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if v_q is not null then v_sql := v_sql || format(' using (%s)', v_q); end if;
      if v_c is not null then v_sql := v_sql || format(' with check (%s)', v_c); end if;
      execute v_sql;
    end if;
  end loop;
end $$;

-- ---------- Panel de asistencia: una sola lectura de los registros ----------
create or replace function public.panel_asistencia(
  p_desde date, p_hasta date, p_aula_id uuid default null, p_umbral int default 3
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_hoy date := app.hoy_centro();
  v_resumen jsonb; v_dias jsonb; v_aulas jsonb; v_riesgo jsonb; v_sin_lista jsonb := '[]'::jsonb;
begin
  if app.rol_actual() is null or app.rol_actual() = 'tutor' then
    raise exception 'No tienes permiso para ver el panel de asistencia.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El rango de fechas no es válido.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El rango no puede pasar de un año.' using errcode = '22023';
  end if;
  if p_umbral is null or p_umbral < 1 or p_umbral > 60 then
    raise exception 'El umbral de riesgo debe estar entre 1 y 60 días.' using errcode = '22023';
  end if;

  with a as materialized (
    select s.fecha, s.estado, s.estudiante_id, s.asignacion_id, g.aula_id
      from public.asistencias s join public.asignaciones g on g.id = s.asignacion_id
     where s.fecha between p_desde and p_hasta and (p_aula_id is null or g.aula_id = p_aula_id)),
  r as (
    select jsonb_build_object(
      'total', count(*),
      'presentes', count(*) filter (where estado = 'presente'),
      'ausentes', count(*) filter (where estado = 'ausente'),
      'tardanzas', count(*) filter (where estado = 'tardanza'),
      'excusas', count(*) filter (where estado = 'excusa'),
      'pct_asistencia', case when count(*) = 0 then null else round(100.0 * count(*) filter (where estado in ('presente', 'tardanza')) / count(*), 1) end,
      'listas', count(distinct (asignacion_id, fecha)),
      'estudiantes', count(distinct estudiante_id),
      'dias_con_lista', count(distinct fecha)) as j
      from a),
  d as (
    select coalesce(jsonb_agg(jsonb_build_object(
        'fecha', x.fecha, 'total', x.total, 'presentes', x.presentes, 'ausentes', x.ausentes, 'tardanzas', x.tardanzas, 'excusas', x.excusas,
        'pct', round(100.0 * (x.presentes + x.tardanzas) / x.total, 1)) order by x.fecha), '[]'::jsonb) as j
      from (select fecha, count(*) as total, count(*) filter (where estado = 'presente') as presentes, count(*) filter (where estado = 'ausente') as ausentes,
                   count(*) filter (where estado = 'tardanza') as tardanzas, count(*) filter (where estado = 'excusa') as excusas
              from a group by fecha) x),
  au as (
    select coalesce(jsonb_agg(jsonb_build_object(
        'aula_id', y.aula_id, 'aula', y.etiqueta, 'listas', y.listas, 'total', y.total, 'presentes', y.presentes, 'ausentes', y.ausentes,
        'tardanzas', y.tardanzas, 'excusas', y.excusas, 'pct', round(100.0 * (y.presentes + y.tardanzas) / y.total, 1)) order by y.etiqueta), '[]'::jsonb) as j
      from (select a.aula_id, l.grado || ' ' || l.seccion || coalesce(', ' || l.especialidad, '') as etiqueta,
                   count(distinct (a.asignacion_id, a.fecha)) as listas, count(*) as total,
                   count(*) filter (where a.estado = 'presente') as presentes, count(*) filter (where a.estado = 'ausente') as ausentes,
                   count(*) filter (where a.estado = 'tardanza') as tardanzas, count(*) filter (where a.estado = 'excusa') as excusas
              from a join public.aulas l on l.id = a.aula_id group by a.aula_id, l.grado, l.seccion, l.especialidad) y),
  ri as (
    select coalesce(jsonb_agg(to_jsonb(z) order by z.dias_ausente desc, z.nombre), '[]'::jsonb) as j
      from (select a.estudiante_id, e.apellidos || ', ' || e.nombres as nombre, e.matricula,
                   count(distinct a.fecha) filter (where a.estado = 'ausente') as dias_ausente,
                   count(*) filter (where a.estado = 'tardanza') as tardanzas,
                   max(a.fecha) filter (where a.estado = 'ausente') as ultima_ausencia,
                   (select l.grado || ' ' || l.seccion || coalesce(', ' || l.especialidad, '')
                      from public.matriculas m join public.aulas l on l.id = m.aula_id
                     where m.estudiante_id = a.estudiante_id and m.estado = 'activa' limit 1) as aula
              from a join public.estudiantes e on e.id = a.estudiante_id
             group by a.estudiante_id, e.apellidos, e.nombres, e.matricula
            having count(distinct a.fecha) filter (where a.estado = 'ausente') >= p_umbral
             order by dias_ausente desc, nombre limit 100) z)
  select r.j, d.j, au.j, ri.j into v_resumen, v_dias, v_aulas, v_riesgo from r, d, au, ri;

  -- Clases que hoy no han pasado lista (solo si hoy es día de semana y está dentro del rango)
  if v_hoy between p_desde and p_hasta and extract(isodow from v_hoy) between 1 and 5 then
    select coalesce(jsonb_agg(jsonb_build_object('asignacion_id', g.id, 'aula', au.grado || ' ' || au.seccion || coalesce(', ' || au.especialidad, ''),
                                                 'materia', m.nombre, 'docente', d.nombre) order by au.grado, au.seccion, m.nombre), '[]'::jsonb)
      into v_sin_lista
      from public.asignaciones g
      join public.aulas au on au.id = g.aula_id and au.activo
      join public.materias m on m.id = g.materia_id
      join public.docentes d on d.id = g.docente_id
     where g.activo and (p_aula_id is null or g.aula_id = p_aula_id)
       and not exists (select 1 from public.asistencia_sesiones ss where ss.asignacion_id = g.id and ss.fecha = v_hoy);
  end if;

  return jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'umbral', p_umbral, 'hoy', v_hoy,
    'resumen', v_resumen, 'por_dia', v_dias, 'por_aula', v_aulas, 'en_riesgo', v_riesgo, 'sin_lista_hoy', v_sin_lista);
end $$;
