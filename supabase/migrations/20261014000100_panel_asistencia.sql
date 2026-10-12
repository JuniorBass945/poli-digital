-- =====================================================================
-- Poli Digital · R1 · Panel de asistencia
--
-- panel_asistencia(desde, hasta, aula, umbral) devuelve en un solo paso el resumen del
-- período: totales, evolución por día, comparación por aula, estudiantes en riesgo por
-- ausencias y clases que hoy no han pasado lista. Corre con los permisos de quien llama
-- (security invoker): cada rol ve solo lo que la seguridad por fila le permite (un docente,
-- solo sus clases; coordinación, dirección, orientación y administración, todo el centro).
-- Asistencia = presentes + tardanzas, entre todos los registros. Excusa y ausencia no suman.
-- =====================================================================

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

  -- Totales del período
  with a as (
    select s.fecha, s.estado, s.estudiante_id, s.asignacion_id
      from public.asistencias s join public.asignaciones g on g.id = s.asignacion_id
     where s.fecha between p_desde and p_hasta and (p_aula_id is null or g.aula_id = p_aula_id))
  select jsonb_build_object(
      'total', count(*),
      'presentes', count(*) filter (where estado = 'presente'),
      'ausentes', count(*) filter (where estado = 'ausente'),
      'tardanzas', count(*) filter (where estado = 'tardanza'),
      'excusas', count(*) filter (where estado = 'excusa'),
      'pct_asistencia', case when count(*) = 0 then null else round(100.0 * count(*) filter (where estado in ('presente', 'tardanza')) / count(*), 1) end,
      'listas', count(distinct (asignacion_id, fecha)),
      'estudiantes', count(distinct estudiante_id),
      'dias_con_lista', count(distinct fecha))
    into v_resumen from a;

  -- Evolución por día
  with a as (
    select s.fecha, s.estado
      from public.asistencias s join public.asignaciones g on g.id = s.asignacion_id
     where s.fecha between p_desde and p_hasta and (p_aula_id is null or g.aula_id = p_aula_id))
  select coalesce(jsonb_agg(jsonb_build_object(
      'fecha', d.fecha, 'total', d.total, 'presentes', d.presentes, 'ausentes', d.ausentes, 'tardanzas', d.tardanzas, 'excusas', d.excusas,
      'pct', round(100.0 * (d.presentes + d.tardanzas) / d.total, 1)) order by d.fecha), '[]'::jsonb)
    into v_dias
    from (select fecha, count(*) as total, count(*) filter (where estado = 'presente') as presentes, count(*) filter (where estado = 'ausente') as ausentes,
                 count(*) filter (where estado = 'tardanza') as tardanzas, count(*) filter (where estado = 'excusa') as excusas
            from a group by fecha) d;

  -- Comparación por aula
  with a as (
    select s.fecha, s.estado, s.asignacion_id, g.aula_id
      from public.asistencias s join public.asignaciones g on g.id = s.asignacion_id
     where s.fecha between p_desde and p_hasta and (p_aula_id is null or g.aula_id = p_aula_id))
  select coalesce(jsonb_agg(jsonb_build_object(
      'aula_id', x.aula_id, 'aula', x.etiqueta, 'listas', x.listas, 'total', x.total, 'presentes', x.presentes, 'ausentes', x.ausentes,
      'tardanzas', x.tardanzas, 'excusas', x.excusas, 'pct', round(100.0 * (x.presentes + x.tardanzas) / x.total, 1)) order by x.etiqueta), '[]'::jsonb)
    into v_aulas
    from (select a.aula_id, au.grado || ' ' || au.seccion || coalesce(', ' || au.especialidad, '') as etiqueta,
                 count(distinct (a.asignacion_id, a.fecha)) as listas, count(*) as total,
                 count(*) filter (where a.estado = 'presente') as presentes, count(*) filter (where a.estado = 'ausente') as ausentes,
                 count(*) filter (where a.estado = 'tardanza') as tardanzas, count(*) filter (where a.estado = 'excusa') as excusas
            from a join public.aulas au on au.id = a.aula_id group by a.aula_id, au.grado, au.seccion, au.especialidad) x;

  -- Estudiantes en riesgo: días distintos con ausencia >= umbral
  with a as (
    select s.fecha, s.estado, s.estudiante_id
      from public.asistencias s join public.asignaciones g on g.id = s.asignacion_id
     where s.fecha between p_desde and p_hasta and (p_aula_id is null or g.aula_id = p_aula_id))
  select coalesce(jsonb_agg(to_jsonb(r) order by r.dias_ausente desc, r.nombre), '[]'::jsonb)
    into v_riesgo
    from (select a.estudiante_id, e.apellidos || ', ' || e.nombres as nombre, e.matricula,
                 count(distinct a.fecha) filter (where a.estado = 'ausente') as dias_ausente,
                 count(*) filter (where a.estado = 'tardanza') as tardanzas,
                 max(a.fecha) filter (where a.estado = 'ausente') as ultima_ausencia,
                 (select au.grado || ' ' || au.seccion || coalesce(', ' || au.especialidad, '')
                    from public.matriculas m join public.aulas au on au.id = m.aula_id
                   where m.estudiante_id = a.estudiante_id and m.estado = 'activa' limit 1) as aula
            from a join public.estudiantes e on e.id = a.estudiante_id
           group by a.estudiante_id, e.apellidos, e.nombres, e.matricula
          having count(distinct a.fecha) filter (where a.estado = 'ausente') >= p_umbral
           order by dias_ausente desc, nombre limit 100) r;

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

revoke execute on function public.panel_asistencia(date, date, uuid, int) from public, anon;
grant execute on function public.panel_asistencia(date, date, uuid, int) to authenticated;
