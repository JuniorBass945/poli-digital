-- =====================================================================
-- Poli Digital · R1 · Nombre dividido (título, nombres, apellidos) y control de personas repetidas
--
-- Docentes y accesos guardan ahora las partes del nombre por separado; el campo "nombre" sigue siendo el nombre
-- completo ya armado ("Lic. Carmen Peña Gómez"), así nada de lo anterior cambia. Los registros viejos quedan sin partes
-- hasta que se editen.
-- Antes de crear un docente o un acceso se busca si la persona ya existe (sin importar tildes ni mayúsculas):
-- si existe, el sistema pide elegirla; solo se permite crear otra si se confirma que es una persona distinta (homónimos).
-- Además, docente y acceso de una misma persona comparten el nombre: editar uno actualiza el otro.
-- =====================================================================

alter table public.docentes
  add column titulo text, add column nombres text, add column apellido1 text, add column apellido2 text;
alter table public.perfiles
  add column titulo text, add column nombres text, add column apellido1 text, add column apellido2 text;

-- ---------- Ayudas internas ----------
create function app.titulo_valido(p_titulo text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_titulo, '')), '');
begin
  if v is null then return null; end if;
  if v !~ '^[A-Za-zÁÉÍÓÚáéíóúÑñ.]{2,10}$' then
    raise exception 'El título no es válido.' using errcode = '22023';
  end if;
  return v;
end $$;

create function app.componer_nombre(p_titulo text, p_nombres text, p_apellido1 text, p_apellido2 text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(concat_ws(' ', nullif(btrim(coalesce(p_titulo, '')), ''), nullif(btrim(coalesce(p_nombres, '')), ''),
                                        nullif(btrim(coalesce(p_apellido1, '')), ''), nullif(btrim(coalesce(p_apellido2, '')), '')), '\s+', ' ', 'g'))
$$;

-- Palabras de un nombre sin tildes, mayúsculas ni títulos (Lic., Ing., Prof., ...).
create function app.tokens_nombre(p_texto text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(string_to_array(nullif(btrim(regexp_replace(
    regexp_replace(regexp_replace(lower(translate(coalesce(p_texto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z ]', ' ', 'g'),
      '\m(prof|profa|lic|licda|lcdo|lcda|dr|dra|ing|inga|msc|mag|arq|arqa|sr|sra|srta|coord)\M', ' ', 'g'),
    '\s+', ' ', 'g')), ''), ' '), '{}'::text[])
$$;

-- Personas del centro que podrían ser la misma: docentes y accesos cuyo nombre contiene el primer nombre y el 1.er apellido.
-- "exacta" = mismas palabras; "parecida" = comparten primer nombre y 1.er apellido.
create function app.buscar_coincidencias(p_centro uuid, p_nombres text, p_apellido1 text, p_apellido2 text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_primero text := (app.tokens_nombre(p_nombres))[1];
  v_ap1 text[] := app.tokens_nombre(p_apellido1);
  v_todo text[] := app.tokens_nombre(concat_ws(' ', p_nombres, p_apellido1, p_apellido2));
begin
  if v_primero is null or cardinality(v_ap1) = 0 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'id', x.id, 'nombre', x.nombre, 'activo', x.activo,
                                        'tiene_acceso', x.tiene_acceso, 'exacta', x.exacta) order by x.exacta desc, x.nombre)
    from (
      select 'docente' as tipo, d.id, d.nombre, d.activo, d.perfil_id is not null as tiene_acceso,
             (app.tokens_nombre(d.nombre) <@ v_todo and v_todo <@ app.tokens_nombre(d.nombre)) as exacta
        from public.docentes d
       where d.centro_id = p_centro and v_primero = any (app.tokens_nombre(d.nombre)) and v_ap1 <@ app.tokens_nombre(d.nombre)
      union all
      select 'acceso', p.id, p.nombre, p.activo, true,
             (app.tokens_nombre(p.nombre) <@ v_todo and v_todo <@ app.tokens_nombre(p.nombre))
        from public.perfiles p
       where p.centro_id = p_centro and v_primero = any (app.tokens_nombre(p.nombre)) and v_ap1 <@ app.tokens_nombre(p.nombre)
         and not exists (select 1 from public.docentes d2 where d2.perfil_id = p.id)
    ) x), '[]'::jsonb);
end $$;

-- Detiene la creación si la persona ya existe, salvo que se confirme que es otra. p_docente_elegido = el docente que se está vinculando.
create function app.exigir_persona_nueva(p_centro uuid, p_nombres text, p_apellido1 text, p_apellido2 text,
                                         p_docente_elegido uuid, p_solo_docentes boolean, p_otra_persona boolean) returns void
language plpgsql stable set search_path = '' as $$
declare c record;
begin
  -- Si se eligió un docente existente, la persona ya está identificada: no se compara con nadie más.
  if coalesce(p_otra_persona, false) or p_docente_elegido is not null then return; end if;
  for c in
    select x ->> 'tipo' as tipo, (x ->> 'id')::uuid as id, x ->> 'nombre' as nombre, (x ->> 'activo')::boolean as activo, (x ->> 'tiene_acceso')::boolean as tiene_acceso
      from jsonb_array_elements(app.buscar_coincidencias(p_centro, p_nombres, p_apellido1, p_apellido2)) x
  loop
    if p_solo_docentes and c.tipo <> 'docente' then continue; end if;
    if c.tipo = 'docente' and c.id is not distinct from p_docente_elegido then continue; end if;
    if not c.activo then
      raise exception '"%" ya existe y está dado de baja. Reactívalo desde la pestaña Docentes o confirma que es otra persona.', c.nombre using errcode = '22023';
    elsif c.tiene_acceso and not p_solo_docentes then
      raise exception '"%" ya tiene acceso al sistema. Si es otra persona con el mismo nombre, confírmalo.', c.nombre using errcode = '22023';
    elsif c.tipo = 'docente' then
      raise exception 'Ya existe el docente "%". Elígelo en lugar de crearlo otra vez, o confirma que es otra persona.', c.nombre using errcode = '22023';
    else
      raise exception '"%" ya existe. Si es otra persona con el mismo nombre, confírmalo.', c.nombre using errcode = '22023';
    end if;
  end loop;
end $$;

create function app.primer_usuario_libre(p_base text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_base text := left(p_base, 24); n int := 1;
begin
  if length(v_base) < 3 then v_base := v_base || 'usr'; end if;
  while exists (select 1 from public.perfiles where lower(usuario) = v_base || case when n = 1 then '' else n::text end) loop
    n := n + 1;
  end loop;
  return v_base || case when n = 1 then '' else n::text end;
end $$;

-- ---------- Docentes con nombre dividido ----------
create or replace function public.crear_docente_persona(p_titulo text, p_nombres text, p_apellido1 text, p_apellido2 text default null,
                                                       p_correo text default null, p_otra_persona boolean default false) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('registrar docentes'); v_titulo text; v_id uuid;
begin
  if btrim(coalesce(p_nombres, '')) = '' then raise exception 'Escribe los nombres del docente.' using errcode = '22023'; end if;
  if btrim(coalesce(p_apellido1, '')) = '' then raise exception 'Escribe el primer apellido del docente.' using errcode = '22023'; end if;
  v_titulo := app.titulo_valido(p_titulo);
  perform app.exigir_persona_nueva(v_centro, p_nombres, p_apellido1, p_apellido2, null, true, p_otra_persona);
  insert into public.docentes (centro_id, nombre, titulo, nombres, apellido1, apellido2, correo)
  values (v_centro, app.componer_nombre(v_titulo, p_nombres, p_apellido1, p_apellido2), v_titulo, btrim(p_nombres), btrim(p_apellido1),
          nullif(btrim(coalesce(p_apellido2, '')), ''), nullif(btrim(coalesce(p_correo, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_docente_persona(p_id uuid, p_titulo text, p_nombres text, p_apellido1 text, p_apellido2 text default null,
                                                            p_correo text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('editar docentes'); v_titulo text; v_nombre text; v_perfil uuid;
begin
  if btrim(coalesce(p_nombres, '')) = '' then raise exception 'Escribe los nombres del docente.' using errcode = '22023'; end if;
  if btrim(coalesce(p_apellido1, '')) = '' then raise exception 'Escribe el primer apellido del docente.' using errcode = '22023'; end if;
  v_titulo := app.titulo_valido(p_titulo);
  v_nombre := app.componer_nombre(v_titulo, p_nombres, p_apellido1, p_apellido2);
  update public.docentes
     set nombre = v_nombre, titulo = v_titulo, nombres = btrim(p_nombres), apellido1 = btrim(p_apellido1),
         apellido2 = nullif(btrim(coalesce(p_apellido2, '')), ''), correo = nullif(btrim(coalesce(p_correo, '')), '')
   where id = p_id and centro_id = v_centro
   returning perfil_id into v_perfil;
  if not found then raise exception 'El docente no existe.' using errcode = '22023'; end if;
  -- Es la misma persona: su acceso lleva el mismo nombre.
  if v_perfil is not null then
    update public.perfiles set nombre = v_nombre, titulo = v_titulo, nombres = btrim(p_nombres), apellido1 = btrim(p_apellido1),
                               apellido2 = nullif(btrim(coalesce(p_apellido2, '')), '') where id = v_perfil and centro_id = v_centro;
  end if;
end $$;

-- ---------- Accesos con nombre dividido ----------
create or replace function public.sugerir_usuario_partes(p_nombres text, p_apellido1 text) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_n text[] := app.tokens_nombre(p_nombres); v_a text[] := app.tokens_nombre(p_apellido1);
begin
  perform app.exigir_admin('crear accesos');
  if cardinality(v_n) = 0 or cardinality(v_a) = 0 then return app.primer_usuario_libre('usuario'); end if;
  return app.primer_usuario_libre(left(v_n[1], 1) || array_to_string(v_a, ''));
end $$;

create or replace function public.buscar_personas(p_nombres text, p_apellido1 text, p_apellido2 text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('buscar personas');
begin
  return app.buscar_coincidencias(v_centro, p_nombres, p_apellido1, p_apellido2);
end $$;

drop function public.validar_nuevo_acceso(text, text, public.app_role[], uuid, boolean);
create function public.validar_nuevo_acceso(p_usuario text, p_nombre text, p_roles public.app_role[],
                                            p_docente_id uuid default null, p_crear_docente boolean default false,
                                            p_titulo text default null, p_nombres text default null, p_apellido1 text default null,
                                            p_apellido2 text default null, p_otra_persona boolean default false)
returns text
language plpgsql stable security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('crear accesos'); v_u text; v_roles public.app_role[]; v_nombre text;
begin
  v_u := app.normalizar_usuario(p_usuario);
  if p_nombres is not null then
    if btrim(p_nombres) = '' or btrim(coalesce(p_apellido1, '')) = '' then
      raise exception 'Escribe los nombres y el primer apellido de la persona.' using errcode = '22023';
    end if;
    perform app.titulo_valido(p_titulo);
    v_nombre := app.componer_nombre(p_titulo, p_nombres, p_apellido1, p_apellido2);
  else
    v_nombre := btrim(coalesce(p_nombre, ''));
  end if;
  if v_nombre = '' then raise exception 'Escribe el nombre de la persona.' using errcode = '22023'; end if;
  v_roles := app.roles_validos(p_roles);
  if exists (select 1 from public.perfiles where lower(usuario) = v_u) then
    raise exception 'El usuario "%" ya existe. Prueba con "%".', v_u, app.sugerir_usuario_base(v_nombre) using errcode = '23505';
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
  if p_nombres is not null then
    perform app.exigir_persona_nueva(v_centro, p_nombres, p_apellido1, p_apellido2, p_docente_id, false, p_otra_persona);
  end if;
  return v_u;
end $$;

drop function public.registrar_acceso(uuid, text, text, public.app_role[], uuid, boolean);
create function public.registrar_acceso(p_user_id uuid, p_usuario text, p_nombre text, p_roles public.app_role[],
                                        p_docente_id uuid default null, p_crear_docente boolean default false,
                                        p_titulo text default null, p_nombres text default null, p_apellido1 text default null,
                                        p_apellido2 text default null, p_otra_persona boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_centro uuid := app.exigir_admin('crear accesos'); v_u text; v_roles public.app_role[]; v_auth record;
  v_titulo text; v_nombre text; v_partes boolean := p_nombres is not null;
begin
  v_u := app.normalizar_usuario(p_usuario);
  v_roles := app.roles_validos(p_roles);
  if v_partes then
    if btrim(p_nombres) = '' or btrim(coalesce(p_apellido1, '')) = '' then
      raise exception 'Escribe los nombres y el primer apellido de la persona.' using errcode = '22023';
    end if;
    v_titulo := app.titulo_valido(p_titulo);
    v_nombre := app.componer_nombre(v_titulo, p_nombres, p_apellido1, p_apellido2);
  else
    v_nombre := btrim(coalesce(p_nombre, ''));
  end if;
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
  if v_partes then
    perform app.exigir_persona_nueva(v_centro, p_nombres, p_apellido1, p_apellido2, p_docente_id, false, p_otra_persona);
  end if;
  insert into public.perfiles (id, centro_id, rol, nombre, usuario, titulo, nombres, apellido1, apellido2, debe_cambiar_clave, clave_vence)
  values (p_user_id, v_centro, app.rol_principal(v_roles), v_nombre, v_u, v_titulo, case when v_partes then btrim(p_nombres) end,
          case when v_partes then btrim(p_apellido1) end, case when v_partes then nullif(btrim(coalesce(p_apellido2, '')), '') end, true, now() + interval '7 days');
  insert into public.perfil_roles (centro_id, perfil_id, rol) select v_centro, p_user_id, r from unnest(v_roles) r
    on conflict (perfil_id, rol) do nothing;
  insert into public.acceso_secretos (perfil_id, clave_huella) values (p_user_id, v_auth.encrypted_password);
  perform app.vincular_docente(p_user_id, v_centro, v_nombre, v_roles, p_docente_id, p_crear_docente);
  return p_user_id;
end $$;

-- Al crear el registro de docente desde un acceso, hereda las partes del nombre.
create or replace function app.vincular_docente(p_perfil uuid, p_centro uuid, p_nombre text, p_roles public.app_role[],
                                                p_docente_id uuid, p_crear boolean) returns void
language plpgsql set search_path = '' as $$
declare v_actual uuid; v_d record; v_p record;
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
        select titulo, nombres, apellido1, apellido2 into v_p from public.perfiles where id = p_perfil;
        insert into public.docentes (centro_id, nombre, titulo, nombres, apellido1, apellido2, perfil_id)
        values (p_centro, p_nombre, v_p.titulo, v_p.nombres, v_p.apellido1, v_p.apellido2, p_perfil);
      else
        raise exception 'El rol Docente necesita un registro de docente: elige uno existente o crea uno nuevo.' using errcode = '22023';
      end if;
    end if;
  elsif v_actual is not null then
    update public.docentes set perfil_id = null where id = v_actual;
  end if;
end $$;

-- Cambiar el nombre de una persona con acceso (y de su registro de docente, si lo tiene).
create or replace function public.actualizar_persona_acceso(p_perfil_id uuid, p_titulo text, p_nombres text, p_apellido1 text, p_apellido2 text default null)
returns void
language plpgsql security invoker set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('editar accesos'); v_titulo text; v_nombre text;
begin
  if btrim(coalesce(p_nombres, '')) = '' or btrim(coalesce(p_apellido1, '')) = '' then
    raise exception 'Escribe los nombres y el primer apellido de la persona.' using errcode = '22023';
  end if;
  v_titulo := app.titulo_valido(p_titulo);
  v_nombre := app.componer_nombre(v_titulo, p_nombres, p_apellido1, p_apellido2);
  update public.perfiles set nombre = v_nombre, titulo = v_titulo, nombres = btrim(p_nombres), apellido1 = btrim(p_apellido1),
                             apellido2 = nullif(btrim(coalesce(p_apellido2, '')), '')
   where id = p_perfil_id and centro_id = v_centro;
  if not found then raise exception 'La persona no existe.' using errcode = '22023'; end if;
  update public.docentes set nombre = v_nombre, titulo = v_titulo, nombres = btrim(p_nombres), apellido1 = btrim(p_apellido1),
                             apellido2 = nullif(btrim(coalesce(p_apellido2, '')), '')
   where perfil_id = p_perfil_id and centro_id = v_centro;
end $$;

-- La lista de accesos trae también las partes del nombre.
create or replace function public.listar_accesos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_centro uuid := app.exigir_admin('ver los accesos');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'titulo', p.titulo, 'nombres', p.nombres, 'apellido1', p.apellido1, 'apellido2', p.apellido2,
      'usuario', p.usuario, 'correo', case when p.usuario is null then u.email end, 'activo', p.activo,
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

-- ---------- Permisos de ejecución ----------
revoke execute on function
  app.titulo_valido(text), app.componer_nombre(text, text, text, text), app.tokens_nombre(text),
  app.buscar_coincidencias(uuid, text, text, text), app.exigir_persona_nueva(uuid, text, text, text, uuid, boolean, boolean),
  app.primer_usuario_libre(text),
  public.crear_docente_persona(text, text, text, text, text, boolean), public.actualizar_docente_persona(uuid, text, text, text, text, text),
  public.sugerir_usuario_partes(text, text), public.buscar_personas(text, text, text),
  public.validar_nuevo_acceso(text, text, public.app_role[], uuid, boolean, text, text, text, text, boolean),
  public.registrar_acceso(uuid, text, text, public.app_role[], uuid, boolean, text, text, text, text, boolean),
  public.actualizar_persona_acceso(uuid, text, text, text, text)
  from public, anon;
grant execute on function
  app.titulo_valido(text), app.componer_nombre(text, text, text, text), app.tokens_nombre(text),
  app.buscar_coincidencias(uuid, text, text, text), app.exigir_persona_nueva(uuid, text, text, text, uuid, boolean, boolean),
  app.primer_usuario_libre(text),
  public.crear_docente_persona(text, text, text, text, text, boolean), public.actualizar_docente_persona(uuid, text, text, text, text, text),
  public.sugerir_usuario_partes(text, text), public.buscar_personas(text, text, text),
  public.validar_nuevo_acceso(text, text, public.app_role[], uuid, boolean, text, text, text, text, boolean),
  public.registrar_acceso(uuid, text, text, public.app_role[], uuid, boolean, text, text, text, text, boolean),
  public.actualizar_persona_acceso(uuid, text, text, text, text)
  to authenticated;
