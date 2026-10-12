-- =====================================================================
-- Poli Digital · R1 · Inicio de administración: pendientes de datos
--
-- pendientes_datos() cuenta, en un solo paso, lo que le falta completar a la administración
-- para que el sistema funcione bien (por ejemplo, tutores sin teléfono). Solo para el rol admin.
-- Corre con los permisos de quien llama (security invoker).
-- =====================================================================

create or replace function public.pendientes_datos() returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('ver los pendientes de datos');
begin
  return jsonb_build_object(
    'estudiantes_activos', (select count(*) from public.estudiantes e where e.centro_id = v_centro and e.activo),
    'tutores', (select count(*) from public.tutores t where t.centro_id = v_centro and t.activo),
    'docentes', (select count(*) from public.docentes d where d.centro_id = v_centro and d.activo),
    'aulas', (select count(*) from public.aulas a where a.centro_id = v_centro and a.activo),
    'estudiantes_sin_tutor', (select count(*) from public.estudiantes e
        where e.centro_id = v_centro and e.activo and not exists (select 1 from public.estudiante_tutor et where et.estudiante_id = e.id)),
    'estudiantes_sin_aula', (select count(*) from public.estudiantes e
        where e.centro_id = v_centro and e.activo and not exists (select 1 from public.matriculas m where m.estudiante_id = e.id and m.estado = 'activa')),
    'tutores_sin_telefono', (select count(*) from public.tutores t
        where t.centro_id = v_centro and t.activo and btrim(coalesce(t.telefono, '')) = ''),
    'tutores_sin_consentimiento', (select count(*) from public.tutores t
        where t.centro_id = v_centro and t.activo and btrim(coalesce(t.telefono, '')) <> ''
          and not exists (select 1 from public.consentimientos c where c.tutor_id = t.id and c.canal = 'whatsapp' and c.otorgado)),
    'aulas_sin_materias', (select count(*) from public.aulas a
        where a.centro_id = v_centro and a.activo and not exists (select 1 from public.asignaciones g where g.aula_id = a.id and g.activo)),
    'docentes_sin_clases', (select count(*) from public.docentes d
        where d.centro_id = v_centro and d.activo and not exists (select 1 from public.asignaciones g where g.docente_id = d.id and g.activo))
  );
end $$;

revoke execute on function public.pendientes_datos() from public, anon;
grant execute on function public.pendientes_datos() to authenticated;
