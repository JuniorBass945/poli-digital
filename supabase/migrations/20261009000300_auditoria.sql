-- =====================================================================
-- Poli Digital · Fase 0 · Auditoría automática
-- Cada alta, cambio o baja en las tablas del núcleo queda registrada con
-- quién lo hizo, su rol y qué campos cambiaron.
-- =====================================================================

create or replace function app.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb;
  v_despues jsonb;
  v_fila jsonb;
begin
  if tg_op = 'INSERT' then
    v_fila := to_jsonb(new);
    v_despues := v_fila;
  elsif tg_op = 'DELETE' then
    v_fila := to_jsonb(old);
    v_antes := v_fila;
  else
    v_fila := to_jsonb(new);
    -- Solo los campos que cambiaron (sin la marca de tiempo automática).
    select jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, to_jsonb(old) -> n.key)
      into v_despues, v_antes
    from jsonb_each(to_jsonb(new)) n
    where n.key <> 'actualizado_en' and (to_jsonb(old) -> n.key) is distinct from n.value;
    if v_despues is null then
      return new;   -- no hubo cambios reales
    end if;
  end if;

  insert into public.auditoria (centro_id, tabla, registro_id, operacion, usuario_id, rol, antes, despues)
  values (
    coalesce((v_fila ->> 'centro_id')::uuid, case when tg_table_name = 'centros' then (v_fila ->> 'id')::uuid end),
    tg_table_name, v_fila ->> 'id', tg_op, auth.uid(), app.rol_actual(), v_antes, v_despues
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'centros', 'perfiles', 'docentes', 'anios_escolares', 'periodos', 'materias', 'aulas',
    'asignaciones', 'estudiantes', 'matriculas', 'tutores', 'estudiante_tutor',
    'consentimientos', 'modulos_activos'
  ] loop
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function app.auditar()', t);
  end loop;
end $$;
