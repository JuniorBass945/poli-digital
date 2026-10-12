-- =====================================================================
-- Prueba de rendimiento de la seguridad por fila.
-- Comprueba que NINGUNA política de la base de datos llama a las funciones de seguridad
-- fila por fila: todas deben ir envueltas en "(select ...)". Si una política nueva no lo hace,
-- esta prueba falla. Es de solo lectura.
-- =====================================================================
do $$
declare
  v_mal text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into v_mal
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(app\.centro_actual\(\)|app\.tiene_rol\(|auth\.uid\(\))';
  if v_mal is not null then
    raise exception 'FALLÓ: políticas que llaman a funciones de seguridad fila por fila (envuélvelas en "(select ...)"): %', v_mal;
  end if;
  raise notice 'ok: ninguna política llama a las funciones de seguridad fila por fila (% políticas revisadas)', (select count(*) from pg_policies where schemaname = 'public');
end $$;
select 'TODAS LAS PRUEBAS DE RENDIMIENTO PASARON' as resultado;
