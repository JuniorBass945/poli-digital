-- =====================================================================
-- Poli Digital · R1 · Administración: tutores y consentimiento de WhatsApp
--
-- actualizar_tutor: corrige nombre, parentesco, teléfono y correo de un tutor (el teléfono
--   se guarda como 809-555-1234).
-- registrar_consentimiento: anota si el tutor aceptó recibir mensajes por un canal, con su
--   evidencia (por ejemplo, "formulario firmado en la matrícula") y si el número fue verificado.
-- Corren con los permisos de quien llama (security invoker) y exigen el rol de administración.
-- =====================================================================

create or replace function public.actualizar_tutor(
  p_id uuid, p_nombre text, p_parentesco text, p_telefono text, p_correo text default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('editar tutores');
  v_dig text;
begin
  if btrim(coalesce(p_nombre, '')) = '' then
    raise exception 'Escribe el nombre del tutor.' using errcode = '22023';
  end if;
  v_dig := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if length(v_dig) = 11 and left(v_dig, 1) = '1' then v_dig := substr(v_dig, 2); end if;
  if length(v_dig) <> 10 then
    raise exception 'El teléfono debe tener 10 dígitos, por ejemplo 809-555-1234.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_correo, '')) <> '' and btrim(p_correo) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'El correo no parece válido.' using errcode = '22023';
  end if;

  update public.tutores
     set nombre = btrim(p_nombre),
         parentesco = nullif(btrim(coalesce(p_parentesco, '')), ''),
         telefono = substr(v_dig, 1, 3) || '-' || substr(v_dig, 4, 3) || '-' || substr(v_dig, 7),
         correo = nullif(btrim(coalesce(p_correo, '')), '')
   where id = p_id and centro_id = v_centro;
  if not found then
    raise exception 'El tutor no existe.' using errcode = '22023';
  end if;
end $$;

create or replace function public.registrar_consentimiento(
  p_tutor_id uuid, p_otorgado boolean, p_verificado boolean, p_evidencia text default null, p_canal text default 'whatsapp'
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_centro uuid := app.exigir_admin('registrar consentimientos');
  v_previo public.consentimientos%rowtype;
  v_evidencia text := nullif(btrim(coalesce(p_evidencia, '')), '');
begin
  if p_canal is null or p_canal not in ('whatsapp', 'sms', 'correo') then
    raise exception 'Canal no válido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tutores t where t.id = p_tutor_id and t.centro_id = v_centro) then
    raise exception 'El tutor no existe.' using errcode = '22023';
  end if;
  if coalesce(p_otorgado, false) and v_evidencia is null then
    raise exception 'Escribe la evidencia del consentimiento (por ejemplo, "formulario firmado en la matrícula").' using errcode = '22023';
  end if;
  if coalesce(p_verificado, false) and not coalesce(p_otorgado, false) then
    raise exception 'No se puede verificar el número de un tutor que no ha dado su consentimiento.' using errcode = '22023';
  end if;

  select * into v_previo from public.consentimientos c where c.tutor_id = p_tutor_id and c.canal = p_canal;
  insert into public.consentimientos (centro_id, tutor_id, canal, otorgado, otorgado_en, verificado, evidencia)
    values (v_centro, p_tutor_id, p_canal, coalesce(p_otorgado, false),
            case when coalesce(p_otorgado, false) then now() end, coalesce(p_verificado, false), v_evidencia)
  on conflict (tutor_id, canal) do update
     set otorgado = coalesce(p_otorgado, false),
         otorgado_en = case when not coalesce(p_otorgado, false) then null
                            when v_previo.otorgado and v_previo.otorgado_en is not null then v_previo.otorgado_en
                            else now() end,
         verificado = coalesce(p_verificado, false),
         evidencia = v_evidencia;
end $$;

revoke execute on function public.actualizar_tutor(uuid, text, text, text, text) from public, anon;
revoke execute on function public.registrar_consentimiento(uuid, boolean, boolean, text, text) from public, anon;
grant execute on function public.actualizar_tutor(uuid, text, text, text, text) to authenticated;
grant execute on function public.registrar_consentimiento(uuid, boolean, boolean, text, text) to authenticated;
