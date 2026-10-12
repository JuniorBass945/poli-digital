-- =====================================================================
-- Poli Digital · R1 · Accesos de usuarios del personal
--
-- 1) Varios roles por persona (tabla perfil_roles). perfiles.rol se conserva como "rol principal".
-- 2) Nombre de usuario propio (único, sin importar mayúsculas), solo para entrar. La app muestra el nombre real.
-- 3) Clave temporal: la persona NO recibe ningún permiso de datos hasta cambiarla de verdad (se exige en la base,
--    no en la pantalla). Vence a los 7 días.
-- 4) Seguridad: nunca queda un centro sin administrador; nadie se quita su propio rol de administración.
-- La creación de la cuenta de acceso (contraseña) la hace la Edge Function "accesos" (supabase/functions/accesos).
-- =====================================================================

-- ---------- Columnas nuevas en perfiles ----------
alter table public.perfiles
  add column usuario text,
  add column debe_cambiar_clave boolean not null default false,
  add column clave_vence timestamptz,
  add column clave_cambiada_en timestamptz,
  add constraint perfiles_usuario_formato check (usuario is null or usuario ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
create unique index perfiles_usuario_unico on public.perfiles (lower(usuario)) where usuario is not null;

-- Huella de la contraseña temporal: sirve para comprobar que de verdad se cambió. Nadie del cliente la ve.
create table public.acceso_secretos (
  perfil_id uuid primary key references public.perfiles (id) on delete cascade,
  clave_huella text not null
);
alter table public.acceso_secretos enable row level security;   -- sin políticas ni permisos: solo las funciones
revoke all on public.acceso_secretos from anon, authenticated;

-- ---------- Roles de cada persona ----------
create table public.perfil_roles (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  rol public.app_role not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (perfil_id, rol)
);
create index perfil_roles_centro_idx on public.perfil_roles (centro_id);

insert into public.perfil_roles (centro_id, perfil_id, rol)
select centro_id, id, rol from public.perfiles;

-- Mientras perfiles.rol exista, todo perfil nuevo o con rol cambiado queda también en perfil_roles.
create function app.sincronizar_rol_principal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfil_roles (centro_id, perfil_id, rol) values (new.centro_id, new.id, new.rol)
  on conflict (perfil_id, rol) do nothing;
  return new;
end $$;
create trigger perfiles_sincronizar_rol after insert or update of rol on public.perfiles
  for each row execute function app.sincronizar_rol_principal();

-- ---------- Funciones de seguridad con varios roles ----------
-- Una persona sin cambiar su clave temporal (o desactivada) no tiene centro ni roles: RLS no le muestra nada.
create or replace function app.centro_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.centro_id from public.perfiles p where p.id = auth.uid() and p.activo and not p.debe_cambiar_clave
$$;

create or replace function app.tiene_rol(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p join public.perfil_roles r on r.perfil_id = p.id
     where p.id = auth.uid() and p.activo and not p.debe_cambiar_clave and r.rol = any (roles))
$$;

-- Rol de mayor alcance (para las funciones que distinguen "puede todo" de "solo sus clases").
-- Orden: admin y coordinación > docente > dirección > orientación > tutor.
create or replace function app.rol_actual() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select r.rol from public.perfiles p join public.perfil_roles r on r.perfil_id = p.id
   where p.id = auth.uid() and p.activo and not p.debe_cambiar_clave
   order by array_position(array['admin', 'coordinacion', 'docente', 'direccion', 'orientacion', 'tutor']::public.app_role[], r.rol)
   limit 1
$$;

-- RLS de perfil_roles
alter table public.perfil_roles enable row level security;
revoke all on public.perfil_roles from anon, authenticated;   -- Supabase da permisos amplios por defecto a tablas nuevas
grant select, insert, delete on public.perfil_roles to authenticated;
create policy perfil_roles_leer on public.perfil_roles for select to authenticated
  using (centro_id = (select app.centro_actual())
         and (perfil_id = (select auth.uid()) or (select app.tiene_rol('admin', 'direccion', 'coordinacion'))));
create policy perfil_roles_admin on public.perfil_roles for all to authenticated
  using (centro_id = (select app.centro_actual()) and (select app.tiene_rol('admin')))
  with check (centro_id = (select app.centro_actual()) and (select app.tiene_rol('admin')));

create trigger auditar after insert or update or delete on public.perfil_roles
  for each row execute function app.auditar();
create trigger tocar_actualizado before update on public.perfil_roles
  for each row execute function app.tocar_actualizado();

-- ---------- Guardia: nunca un centro sin administrador ----------
create function app.cuidar_ultimo_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_centro uuid; v_perfil uuid;
begin
  if tg_table_name = 'perfil_roles' then
    if old.rol <> 'admin' then return coalesce(new, old); end if;
    if tg_op = 'UPDATE' and new.rol = 'admin' then return new; end if;
    v_centro := old.centro_id; v_perfil := old.perfil_id;
    -- Si se está borrando el perfil entero (cascada) no estorbamos.
    if not exists (select 1 from public.perfiles where id = v_perfil) then return old; end if;
  else
    if tg_op = 'DELETE' then return old; end if;
    if not (old.activo and not new.activo) then return new; end if;
    v_centro := old.centro_id; v_perfil := old.id;
  end if;
  if not exists (
    select 1 from public.perfil_roles r join public.perfiles p on p.id = r.perfil_id
     where r.centro_id = v_centro and r.rol = 'admin' and p.activo and p.id <> v_perfil) then
    raise exception 'El centro debe conservar al menos un administrador activo.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger perfil_roles_ultimo_admin before delete or update of rol on public.perfil_roles
  for each row execute function app.cuidar_ultimo_admin();
create trigger perfiles_ultimo_admin before update of activo on public.perfiles
  for each row execute function app.cuidar_ultimo_admin();

-- ---------- Ayudas internas ----------
create function app.roles_validos(p_roles public.app_role[]) returns public.app_role[]
language plpgsql immutable set search_path = '' as $$
declare v public.app_role[];
begin
  select coalesce(array_agg(distinct r), '{}') into v from unnest(coalesce(p_roles, '{}')) r;
  if cardinality(v) = 0 then
    raise exception 'Elige al menos un rol.' using errcode = '22023';
  end if;
  if 'tutor' = any (v) then
    raise exception 'Los tutores no tienen acceso al sistema.' using errcode = '22023';
  end if;
  return v;
end $$;

create function app.rol_principal(p_roles public.app_role[]) returns public.app_role
language sql immutable set search_path = '' as $$
  select r from unnest(p_roles) r
   order by array_position(array['admin', 'coordinacion', 'docente', 'direccion', 'orientacion', 'tutor']::public.app_role[], r) limit 1
$$;

create function app.normalizar_usuario(p_usuario text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_usuario, '')));
begin
  if v !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo.' using errcode = '22023';
  end if;
  return v;
end $$;

-- Sugerencia: inicial del nombre + apellido, sin tildes; si existe, agrega un número.
create function app.sugerir_usuario_base(p_nombre text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text; t text[]; base text; n int := 1;
begin
  v := lower(translate(coalesce(p_nombre, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
  v := regexp_replace(v, '[^a-z ]', ' ', 'g');
  v := regexp_replace(v, '\m(prof|profa|lic|licda|lcdo|lcda|dr|dra|ing|coord|sr|sra|srta|msc|mag)\M', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  t := regexp_split_to_array(v, ' ');
  if v = '' then base := 'usuario';
  elsif cardinality(t) = 1 then base := t[1];
  elsif cardinality(t) = 2 then base := left(t[1], 1) || t[2];
  else base := left(t[1], 1) || t[cardinality(t) - 1];
  end if;
  base := left(base, 24);
  if length(base) < 3 then base := base || 'usr'; end if;
  while exists (select 1 from public.perfiles where lower(usuario) = base || case when n = 1 then '' else n::text end) loop
    n := n + 1;
  end loop;
  return base || case when n = 1 then '' else n::text end;
end $$;

-- Vincula (o desvincula) el registro de docente según el rol. Usa el nombre de la persona si hay que crearlo.
create function app.vincular_docente(p_perfil uuid, p_centro uuid, p_nombre text, p_roles public.app_role[],
                                     p_docente_id uuid, p_crear boolean) returns void
language plpgsql set search_path = '' as $$
declare v_actual uuid; v_d record;
begin
  select id into v_actual from public.docentes where perfil_id = p_perfil;
  if 'docente' = any (p_roles) then
    if p_docente_id is not null then
      select id, perfil_id, activo into v_d from public.docentes where id = p_docente_id and centro_id = p_centro;
      if not found or not v_d.activo then
        raise exception 'El docente elegido no existe o está inactivo.' using errcode = '22023';
      end if;
      if v_d.perfil_id is not null and v_d.perfil_id <> p_perfil then
        raise exception 'Ese docente ya tiene un acceso asignado a otra persona.' using errcode = '22023';
      end if;
      if v_actual is not null and v_actual <> p_docente_id then
        update public.docentes set perfil_id = null where id = v_actual;
      end if;
      update public.docentes set perfil_id = p_perfil where id = p_docente_id;
    elsif v_actual is null then
      if coalesce(p_crear, false) then
        insert into public.docentes (centro_id, nombre, perfil_id) values (p_centro, p_nombre, p_perfil);
      else
        raise exception 'El rol Docente necesita un registro de docente: elige uno existente o crea uno nuevo.' using errcode = '22023';
      end if;
    end if;
  elsif v_actual is not null then
    update public.docentes set perfil_id = null where id = v_actual;
  end if;
end $$;

-- ---------- Lectura para la administración ----------
create or replace function public.sugerir_usuario(p_nombre text) returns text
language plpgsql stable security invoker set search_path = '' as $$
begin
  perform app.exigir_admin('crear accesos');
  return app.sugerir_usuario_base(p_nombre);
end $$;

create or replace function public.listar_accesos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('ver los accesos');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'usuario', p.usuario,
      'correo', case when p.usuario is null then u.email end,
      'activo', p.activo,
      'roles', (select coalesce(jsonb_agg(r.rol order by r.rol), '[]'::jsonb) from public.perfil_roles r where r.perfil_id = p.id),
      'docente_id', (select d.id from public.docentes d where d.perfil_id = p.id),
      'estado', case when not p.activo then 'sin_acceso'
                     when p.debe_cambiar_clave and p.clave_vence < now() then 'vencida'
                     when p.debe_cambiar_clave then 'pendiente' else 'activo' end,
      'clave_vence', case when p.debe_cambiar_clave then p.clave_vence end,
      'ultimo_ingreso', u.last_sign_in_at) order by p.nombre)
    from public.perfiles p join auth.users u on u.id = p.id
   where p.centro_id = v_centro), '[]'::jsonb);
end $$;

-- ---------- Crear un acceso (lo llama la Edge Function) ----------
-- Paso 1 (como administrador): revisa todo ANTES de crear la cuenta de acceso.
create or replace function public.validar_nuevo_acceso(p_usuario text, p_nombre text, p_roles public.app_role[],
                                                       p_docente_id uuid default null, p_crear_docente boolean default false)
returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('crear accesos'); v_u text; v_roles public.app_role[];
begin
  v_u := app.normalizar_usuario(p_usuario);
  if btrim(coalesce(p_nombre, '')) = '' then raise exception 'Escribe el nombre de la persona.' using errcode = '22023'; end if;
  v_roles := app.roles_validos(p_roles);
  if exists (select 1 from public.perfiles where lower(usuario) = v_u) then
    raise exception 'El usuario "%" ya existe. Prueba con "%".', v_u, app.sugerir_usuario_base(p_nombre) using errcode = '23505';
  end if;
  if 'docente' = any (v_roles) then
    if p_docente_id is null and not coalesce(p_crear_docente, false) then
      raise exception 'El rol Docente necesita un registro de docente: elige uno existente o crea uno nuevo.' using errcode = '22023';
    end if;
    if p_docente_id is not null and not exists (
      select 1 from public.docentes where id = p_docente_id and centro_id = v_centro and activo and perfil_id is null) then
      raise exception 'El docente elegido no existe, está inactivo o ya tiene un acceso.' using errcode = '22023';
    end if;
  end if;
  return v_u;
end $$;

-- Paso 2 (como administrador, después de crear la cuenta): crea el perfil, los roles y el vínculo con el docente.
create or replace function public.registrar_acceso(p_user_id uuid, p_usuario text, p_nombre text, p_roles public.app_role[],
                                                   p_docente_id uuid default null, p_crear_docente boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('crear accesos'); v_u text; v_roles public.app_role[]; v_auth record; v_nombre text := btrim(p_nombre);
begin
  v_u := app.normalizar_usuario(p_usuario);
  v_roles := app.roles_validos(p_roles);
  select id, email, encrypted_password, raw_user_meta_data, created_at into v_auth from auth.users where id = p_user_id;
  if not found
     or coalesce(v_auth.raw_user_meta_data ->> 'creado_por', '') <> auth.uid()::text
     or v_auth.created_at < now() - interval '10 minutes'
     or split_part(v_auth.email, '@', 1) <> v_u then
    raise exception 'La cuenta de acceso no corresponde a esta solicitud.' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfiles where id = p_user_id) then
    raise exception 'Esa cuenta ya tiene perfil.' using errcode = '23505';
  end if;
  insert into public.perfiles (id, centro_id, rol, nombre, usuario, debe_cambiar_clave, clave_vence)
  values (p_user_id, v_centro, app.rol_principal(v_roles), v_nombre, v_u, true, now() + interval '7 days');
  insert into public.perfil_roles (centro_id, perfil_id, rol) select v_centro, p_user_id, r from unnest(v_roles) r
    on conflict (perfil_id, rol) do nothing;
  insert into public.acceso_secretos (perfil_id, clave_huella) values (p_user_id, v_auth.encrypted_password);
  perform app.vincular_docente(p_user_id, v_centro, v_nombre, v_roles, p_docente_id, p_crear_docente);
  return p_user_id;
end $$;

-- ---------- Restablecer clave (la contraseña la cambia la Edge Function; esto deja el estado listo) ----------
-- Paso 1: revisa. Paso 2: registra (también reactiva a quien no tenía acceso).
create or replace function public.validar_reinicio_acceso(p_perfil_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('restablecer accesos'); v_p record;
begin
  select usuario, centro_id into v_p from public.perfiles where id = p_perfil_id;
  if not found or v_p.centro_id <> v_centro then raise exception 'La persona no existe.' using errcode = '22023'; end if;
  if p_perfil_id = auth.uid() then
    raise exception 'No puedes restablecer tu propia clave. Pide a otro administrador que lo haga.' using errcode = '22023';
  end if;
  return v_p.usuario;
end $$;

create or replace function public.registrar_reinicio_acceso(p_perfil_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('restablecer accesos'); v_huella text;
begin
  if not exists (select 1 from public.perfiles where id = p_perfil_id and centro_id = v_centro) then
    raise exception 'La persona no existe.' using errcode = '22023';
  end if;
  if p_perfil_id = auth.uid() then raise exception 'No puedes restablecer tu propia clave.' using errcode = '22023'; end if;
  select encrypted_password into v_huella from auth.users where id = p_perfil_id;
  update public.perfiles set activo = true, debe_cambiar_clave = true, clave_vence = now() + interval '7 days'
   where id = p_perfil_id;
  insert into public.acceso_secretos (perfil_id, clave_huella) values (p_perfil_id, coalesce(v_huella, ''))
    on conflict (perfil_id) do update set clave_huella = excluded.clave_huella;
end $$;

-- ---------- Quitar el acceso (la persona queda guardada pero no puede entrar) ----------
create or replace function public.quitar_acceso(p_perfil_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('quitar accesos');
begin
  if p_perfil_id = auth.uid() then raise exception 'No puedes quitarte tu propio acceso.' using errcode = '22023'; end if;
  update public.perfiles set activo = false where id = p_perfil_id and centro_id = v_centro;
  if not found then raise exception 'La persona no existe.' using errcode = '22023'; end if;
end $$;

-- ---------- Cambiar los roles de una persona ----------
create or replace function public.cambiar_roles_acceso(p_perfil_id uuid, p_roles public.app_role[],
                                                       p_docente_id uuid default null, p_crear_docente boolean default false)
returns void
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('cambiar roles'); v_roles public.app_role[]; v_p record;
begin
  v_roles := app.roles_validos(p_roles);
  select nombre, centro_id into v_p from public.perfiles where id = p_perfil_id;
  if not found or v_p.centro_id <> v_centro then raise exception 'La persona no existe.' using errcode = '22023'; end if;
  if p_perfil_id = auth.uid() and not ('admin' = any (v_roles)) then
    raise exception 'No puedes quitarte tu propio rol de administración.' using errcode = '22023';
  end if;
  perform app.vincular_docente(p_perfil_id, v_centro, v_p.nombre, v_roles, p_docente_id, p_crear_docente);
  delete from public.perfil_roles where perfil_id = p_perfil_id and not (rol = any (v_roles));
  insert into public.perfil_roles (centro_id, perfil_id, rol) select v_centro, p_perfil_id, r from unnest(v_roles) r
    on conflict (perfil_id, rol) do nothing;
  update public.perfiles set rol = app.rol_principal(v_roles) where id = p_perfil_id;
end $$;

create or replace function public.renombrar_acceso(p_perfil_id uuid, p_nombre text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('editar accesos');
begin
  if btrim(coalesce(p_nombre, '')) = '' then raise exception 'Escribe el nombre de la persona.' using errcode = '22023'; end if;
  update public.perfiles set nombre = btrim(p_nombre) where id = p_perfil_id and centro_id = v_centro;
  if not found then raise exception 'La persona no existe.' using errcode = '22023'; end if;
end $$;

-- ---------- Lo que ve cada persona al entrar ----------
create or replace function public.mi_estado_acceso() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('nombre', p.nombre, 'activo', p.activo,
                              'debe_cambiar', p.debe_cambiar_clave,
                              'vencida', p.debe_cambiar_clave and p.clave_vence < now())
      from public.perfiles p where p.id = auth.uid()), jsonb_build_object('sin_perfil', true))
$$;

-- La persona ya cambió su clave temporal: se comprueba que la contraseña cambió de verdad.
create or replace function public.marcar_clave_cambiada() returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_actual text; v_huella text;
begin
  select debe_cambiar_clave, clave_vence, activo into v_p from public.perfiles where id = auth.uid();
  if not found or not v_p.activo then raise exception 'Tu acceso no está activo.' using errcode = '42501'; end if;
  if not v_p.debe_cambiar_clave then return; end if;
  if v_p.clave_vence < now() then
    raise exception 'Tu clave temporal venció. Pide al administrador una nueva.' using errcode = '42501';
  end if;
  select encrypted_password into v_actual from auth.users where id = auth.uid();
  select clave_huella into v_huella from public.acceso_secretos where perfil_id = auth.uid();
  if v_huella is null or v_actual is not distinct from v_huella then
    raise exception 'Todavía no has cambiado tu clave.' using errcode = '22023';
  end if;
  update public.perfiles set debe_cambiar_clave = false, clave_vence = null, clave_cambiada_en = now() where id = auth.uid();
  delete from public.acceso_secretos where perfil_id = auth.uid();
end $$;

-- ---------- Permisos de ejecución ----------
revoke execute on function
  app.sincronizar_rol_principal(), app.cuidar_ultimo_admin(), app.roles_validos(public.app_role[]), app.rol_principal(public.app_role[]),
  app.normalizar_usuario(text), app.sugerir_usuario_base(text), app.vincular_docente(uuid, uuid, text, public.app_role[], uuid, boolean),
  public.sugerir_usuario(text), public.listar_accesos(),
  public.validar_nuevo_acceso(text, text, public.app_role[], uuid, boolean),
  public.registrar_acceso(uuid, text, text, public.app_role[], uuid, boolean),
  public.validar_reinicio_acceso(uuid), public.registrar_reinicio_acceso(uuid), public.quitar_acceso(uuid),
  public.cambiar_roles_acceso(uuid, public.app_role[], uuid, boolean), public.renombrar_acceso(uuid, text),
  public.mi_estado_acceso(), public.marcar_clave_cambiada()
  from public, anon;
grant execute on function
  app.roles_validos(public.app_role[]), app.rol_principal(public.app_role[]), app.normalizar_usuario(text),
  app.sugerir_usuario_base(text), app.vincular_docente(uuid, uuid, text, public.app_role[], uuid, boolean),
  public.sugerir_usuario(text), public.listar_accesos(),
  public.validar_nuevo_acceso(text, text, public.app_role[], uuid, boolean),
  public.registrar_acceso(uuid, text, text, public.app_role[], uuid, boolean),
  public.validar_reinicio_acceso(uuid), public.registrar_reinicio_acceso(uuid), public.quitar_acceso(uuid),
  public.cambiar_roles_acceso(uuid, public.app_role[], uuid, boolean), public.renombrar_acceso(uuid, text),
  public.mi_estado_acceso(), public.marcar_clave_cambiada()
  to authenticated;
