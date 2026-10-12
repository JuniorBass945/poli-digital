-- =====================================================================
-- Datos de DEMOSTRACIÓN de asistencia, para probar el panel (solo en el proyecto de pruebas).
-- Genera ~3 semanas de listas ya pasadas (días hábiles anteriores a hoy) para todas las clases
-- del "Politécnico Demo". Un estudiante de cada 7 falta mucho, para que el panel muestre casos de riesgo.
-- Todo lleva la nota "demo" y se borra con supabase/scripts/limpiar_asistencia_demo.sql.
-- Se puede ejecutar varias veces: no duplica registros. Pégalo en el SQL Editor de Supabase.
-- =====================================================================
do $$
declare
  v_centro uuid := '00000000-0000-4000-8000-00000000c001';
  v_hoy date := (now() at time zone 'America/Santo_Domingo')::date;
  v_dia date;
  g record;
  est record;
  h int;
  v_estado text;
  v_registros int := 0;
begin
  if not exists (select 1 from public.centros where id = v_centro) then
    raise exception 'No existe el centro de demostración. Carga primero supabase/seed.sql.';
  end if;

  for v_dia in select d::date from generate_series(v_hoy - 21, v_hoy - 1, interval '1 day') d where extract(isodow from d) between 1 and 5 loop
    for g in
      select a.id, a.aula_id, dc.perfil_id
        from public.asignaciones a join public.docentes dc on dc.id = a.docente_id
       where a.centro_id = v_centro and a.activo
    loop
      insert into public.asistencia_sesiones (centro_id, asignacion_id, fecha, registrado_por)
        values (v_centro, g.id, v_dia, g.perfil_id) on conflict (asignacion_id, fecha) do nothing;
      for est in select m.estudiante_id from public.matriculas m where m.aula_id = g.aula_id and m.estado = 'activa' loop
        h := abs(hashtext(est.estudiante_id::text || v_dia::text || g.id::text)) % 100;
        if abs(hashtext(est.estudiante_id::text)) % 7 = 0 then
          v_estado := case when h < 12 then 'ausente' when h < 18 then 'tardanza' else 'presente' end;
        else
          v_estado := case when h < 1 then 'ausente' when h < 4 then 'tardanza' when h < 6 then 'excusa' else 'presente' end;
        end if;
        insert into public.asistencias (centro_id, asignacion_id, fecha, estudiante_id, estado, nota, registrado_por)
          values (v_centro, g.id, v_dia, est.estudiante_id, v_estado, 'demo', g.perfil_id)
          on conflict (asignacion_id, fecha, estudiante_id) do nothing;
        v_registros := v_registros + 1;
      end loop;
    end loop;
  end loop;
  raise notice 'Listo: % registros de asistencia de demostración.', v_registros;
end $$;
