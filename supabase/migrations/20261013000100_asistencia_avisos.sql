-- =====================================================================
-- Poli Digital · R1 · Asistencia y avisos a tutores (primera versión)
--
-- * asistencia_sesiones: una fila por clase (asignación) y fecha en que se pasó lista.
-- * asistencias: el estado de cada estudiante en esa clase y fecha.
-- * mensajes: cola de avisos a las familias. El canal es intercambiable: hoy un
--   enlace de WhatsApp que el docente envía a mano; más adelante, la API automática.
--
-- Las tablas son de solo lectura para el cliente (RLS). Todo se escribe con las
-- funciones guardar_asistencia y gestionar_aviso, que comprueban rol, clase y fechas.
-- =====================================================================

-- ---------- Tablas ----------
create table public.asistencia_sesiones (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  asignacion_id uuid not null references public.asignaciones (id),
  fecha date not null,
  registrado_por uuid references public.perfiles (id) on delete set null,
  registrado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (asignacion_id, fecha)
);
create index asistencia_sesiones_fecha_idx on public.asistencia_sesiones (centro_id, fecha);

create table public.asistencias (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  asignacion_id uuid not null references public.asignaciones (id),
  fecha date not null,
  estudiante_id uuid not null references public.estudiantes (id),
  estado text not null check (estado in ('presente', 'ausente', 'tardanza', 'excusa')),
  nota text,
  registrado_por uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (asignacion_id, fecha, estudiante_id)
);
create index asistencias_fecha_idx on public.asistencias (centro_id, fecha);
create index asistencias_estudiante_idx on public.asistencias (estudiante_id, fecha);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id),
  tipo text not null check (tipo in ('ausencia')),
  estudiante_id uuid not null references public.estudiantes (id),
  tutor_id uuid not null references public.tutores (id),
  asignacion_id uuid references public.asignaciones (id),
  fecha date not null,
  canal text not null default 'whatsapp_enlace' check (canal in ('whatsapp_enlace', 'whatsapp_api', 'sms', 'correo')),
  texto text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'omitido', 'cancelado')),
  creado_por uuid references public.perfiles (id) on delete set null,
  gestionado_por uuid references public.perfiles (id) on delete set null,
  gestionado_en timestamptz,
  nota text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (estudiante_id, tipo, fecha)          -- un aviso por estudiante, tipo y día
);
create index mensajes_estado_idx on public.mensajes (centro_id, estado, fecha desc);

-- ---------- Marcas de tiempo y auditoría ----------
create trigger tocar_actualizado before update on public.asistencia_sesiones for each row execute function app.tocar_actualizado();
create trigger tocar_actualizado before update on public.asistencias for each row execute function app.tocar_actualizado();
create trigger tocar_actualizado before update on public.mensajes for each row execute function app.tocar_actualizado();
-- Asistencia: se audita solo lo que se corrige (las altas ya llevan quién las registró).
create trigger auditar after update or delete on public.asistencias for each row execute function app.auditar();
create trigger auditar after insert or update or delete on public.mensajes for each row execute function app.auditar();

-- ---------- Seguridad por fila: solo lectura para el cliente ----------
alter table public.asistencia_sesiones enable row level security;
alter table public.asistencias enable row level security;
alter table public.mensajes enable row level security;

revoke all on public.asistencia_sesiones, public.asistencias, public.mensajes from anon, authenticated;
grant select on public.asistencia_sesiones, public.asistencias, public.mensajes to authenticated;

create policy asistencia_sesiones_leer on public.asistencia_sesiones for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or asignacion_id in (select a.id from public.asignaciones a join public.docentes d on d.id = a.docente_id where d.perfil_id = auth.uid())));

create policy asistencias_leer on public.asistencias for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or asignacion_id in (select a.id from public.asignaciones a join public.docentes d on d.id = a.docente_id where d.perfil_id = auth.uid())));

create policy mensajes_leer on public.mensajes for select to authenticated
  using (centro_id = app.centro_actual()
         and (app.tiene_rol('admin', 'direccion', 'coordinacion', 'orientacion')
              or creado_por = auth.uid()
              or asignacion_id in (select a.id from public.asignaciones a join public.docentes d on d.id = a.docente_id where d.perfil_id = auth.uid())));

-- ---------- Ayuda: fecha de hoy en la zona horaria del centro ----------
create or replace function app.hoy_centro() returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce((select c.zona_horaria from public.centros c where c.id = app.centro_actual()), 'America/Santo_Domingo'))::date
$$;
revoke execute on function app.hoy_centro() from public;
grant execute on function app.hoy_centro() to authenticated;

-- ---------- Guardar la asistencia de una clase y una fecha ----------
-- Reglas: el docente solo en sus clases y hasta 3 días atrás; coordinación y administración, cualquier clase y fecha.
-- No se admiten fechas futuras. La lista debe traer a TODOS los estudiantes activos del aula, cada uno con su estado.
-- Los ausentes con tutor principal generan un aviso pendiente (uno por estudiante y día); si se corrige a no ausente, se cancela.
create or replace function public.guardar_asistencia(p_asignacion_id uuid, p_fecha date, p_registros jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c_dias_docente constant int := 3;
  v_rol public.app_role := app.rol_actual();
  v_centro uuid := app.centro_actual();
  v_hoy date := app.hoy_centro();
  v_asig record;
  v_activos int;
  v_recibidos int;
  v_fila record;
  v_tutor record;
  v_centro_nombre text;
  v_texto text;
  v_fecha_txt text;
  v_presentes int := 0; v_ausentes int := 0; v_tardanzas int := 0; v_excusas int := 0;
  v_creados int := 0; v_existentes int := 0; v_n int;
  v_sin_tutor jsonb := '[]'::jsonb;
begin
  if v_rol is null or v_rol not in ('docente', 'coordinacion', 'admin') then
    raise exception 'No tienes permiso para pasar lista.' using errcode = '42501';
  end if;
  if p_fecha is null then
    raise exception 'Elige la fecha.' using errcode = '22023';
  end if;
  if p_registros is null or jsonb_typeof(p_registros) <> 'array' or jsonb_array_length(p_registros) = 0 then
    raise exception 'La lista de asistencia está vacía.' using errcode = '22023';
  end if;

  select a.id, a.aula_id, a.activo, d.perfil_id as docente_perfil, m.nombre as materia, au.grado, au.seccion, au.especialidad
    into v_asig
    from public.asignaciones a
    join public.docentes d on d.id = a.docente_id
    join public.materias m on m.id = a.materia_id
    join public.aulas au on au.id = a.aula_id
   where a.id = p_asignacion_id and a.centro_id = v_centro;
  if not found or not v_asig.activo then
    raise exception 'La clase no existe o ya no está activa.' using errcode = '22023';
  end if;
  if v_rol = 'docente' and v_asig.docente_perfil is distinct from auth.uid() then
    raise exception 'Esta clase no es tuya.' using errcode = '42501';
  end if;

  if p_fecha > v_hoy then
    raise exception 'No se puede pasar lista de una fecha futura.' using errcode = '22023';
  end if;
  if v_rol = 'docente' and p_fecha < v_hoy - c_dias_docente then
    raise exception 'Solo puedes pasar o corregir la lista de los últimos % días. Pide ayuda a coordinación.', c_dias_docente using errcode = '22023';
  end if;

  -- Validar la lista contra los estudiantes activos del aula
  if exists (select 1 from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text) where estudiante_id is null or estado is null or estado not in ('presente', 'ausente', 'tardanza', 'excusa')) then
    raise exception 'Cada estudiante necesita un estado válido (presente, ausente, tardanza o excusa).' using errcode = '22023';
  end if;
  select count(*), count(distinct estudiante_id) into v_recibidos, v_n from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text);
  if v_recibidos <> v_n then
    raise exception 'Hay estudiantes repetidos en la lista.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text)
              where not exists (select 1 from public.matriculas m
                                 where m.estudiante_id = t.estudiante_id and m.aula_id = v_asig.aula_id and m.estado = 'activa')) then
    raise exception 'La lista incluye estudiantes que no están en esta aula.' using errcode = '22023';
  end if;
  select count(*) into v_activos from public.matriculas m where m.aula_id = v_asig.aula_id and m.estado = 'activa';
  if v_activos <> v_recibidos then
    raise exception 'Faltan estudiantes por marcar: la lista trae % de % estudiantes del aula.', v_recibidos, v_activos using errcode = '22023';
  end if;

  -- Guardar sesión y asistencias
  insert into public.asistencia_sesiones (centro_id, asignacion_id, fecha, registrado_por)
    values (v_centro, p_asignacion_id, p_fecha, auth.uid())
    on conflict (asignacion_id, fecha) do update set registrado_por = auth.uid(), actualizado_en = now();

  insert into public.asistencias (centro_id, asignacion_id, fecha, estudiante_id, estado, nota, registrado_por)
    select v_centro, p_asignacion_id, p_fecha, t.estudiante_id, t.estado, t.nota, auth.uid() from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text)
    on conflict (asignacion_id, fecha, estudiante_id)
    do update set estado = excluded.estado, nota = excluded.nota, registrado_por = auth.uid();

  select count(*) filter (where estado = 'presente'), count(*) filter (where estado = 'ausente'),
         count(*) filter (where estado = 'tardanza'), count(*) filter (where estado = 'excusa')
    into v_presentes, v_ausentes, v_tardanzas, v_excusas from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text);

  -- Avisos: cancelar los pendientes de esta clase de quien ya no está ausente
  update public.mensajes ms set estado = 'cancelado', gestionado_por = auth.uid(), gestionado_en = now()
   where ms.tipo = 'ausencia' and ms.fecha = p_fecha and ms.estado = 'pendiente' and ms.asignacion_id = p_asignacion_id
     and ms.estudiante_id in (select t.estudiante_id from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text) where t.estado <> 'ausente');

  -- Avisos: crear (o reactivar) el de cada ausente que tenga tutor principal
  select c.nombre into v_centro_nombre from public.centros c where c.id = v_centro;
  v_fecha_txt := to_char(p_fecha, 'DD/MM/YYYY');
  for v_fila in
    select t.estudiante_id, e.nombres, e.apellidos
      from jsonb_to_recordset(p_registros) as t(estudiante_id uuid, estado text, nota text) join public.estudiantes e on e.id = t.estudiante_id
     where t.estado = 'ausente'
     order by e.apellidos, e.nombres
  loop
    select tu.id, tu.nombre into v_tutor
      from public.estudiante_tutor et join public.tutores tu on tu.id = et.tutor_id
     where et.estudiante_id = v_fila.estudiante_id and tu.activo
     order by et.principal desc, tu.creado_en limit 1;
    if v_tutor.id is null then
      v_sin_tutor := v_sin_tutor || to_jsonb(btrim(v_fila.nombres || ' ' || v_fila.apellidos));
      continue;
    end if;

    v_texto := 'Buenas, ' || v_tutor.nombre || '. Le saluda ' || v_centro_nombre || '. Le informamos que '
            || btrim(v_fila.nombres || ' ' || v_fila.apellidos) || ' no asistió ' ||
               case when p_fecha = v_hoy then 'hoy' else 'el ' || v_fecha_txt end
            || ' a la clase de ' || v_asig.materia || ' (' || v_asig.grado || ' ' || v_asig.seccion
            || coalesce(', ' || v_asig.especialidad, '') || '). Si hay una justificación, por favor comuníquese con el centro. Gracias.';

    insert into public.mensajes (centro_id, tipo, estudiante_id, tutor_id, asignacion_id, fecha, texto, creado_por)
      values (v_centro, 'ausencia', v_fila.estudiante_id, v_tutor.id, p_asignacion_id, p_fecha, v_texto, auth.uid())
      on conflict (estudiante_id, tipo, fecha)
      do update set estado = 'pendiente', texto = excluded.texto, tutor_id = excluded.tutor_id, asignacion_id = excluded.asignacion_id,
                    gestionado_por = null, gestionado_en = null
         where public.mensajes.estado = 'cancelado';
    get diagnostics v_n = row_count;
    if v_n > 0 then v_creados := v_creados + 1; else v_existentes := v_existentes + 1; end if;
  end loop;

  insert into public.eventos (centro_id, tipo, payload)
    values (v_centro, 'asistencia_guardada', jsonb_build_object('asignacion_id', p_asignacion_id, 'fecha', p_fecha, 'ausentes', v_ausentes, 'registrado_por', auth.uid()));

  return jsonb_build_object(
    'total', v_recibidos, 'presentes', v_presentes, 'ausentes', v_ausentes, 'tardanzas', v_tardanzas, 'excusas', v_excusas,
    'avisos_creados', v_creados, 'avisos_existentes', v_existentes, 'ausentes_sin_tutor', v_sin_tutor);
end $$;

-- ---------- Gestionar un aviso: marcar enviado, omitir o volver a pendiente ----------
create or replace function public.gestionar_aviso(p_id uuid, p_estado text, p_nota text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rol public.app_role := app.rol_actual();
  v_centro uuid := app.centro_actual();
  v_msg record;
  v_propio boolean;
begin
  if v_rol is null or v_rol not in ('docente', 'coordinacion', 'admin') then
    raise exception 'No tienes permiso para gestionar avisos.' using errcode = '42501';
  end if;
  if p_estado is null or p_estado not in ('pendiente', 'enviado', 'omitido') then
    raise exception 'Estado de aviso no válido.' using errcode = '22023';
  end if;

  select m.id, m.estado, m.creado_por, a.docente_id, d.perfil_id as docente_perfil
    into v_msg
    from public.mensajes m
    left join public.asignaciones a on a.id = m.asignacion_id
    left join public.docentes d on d.id = a.docente_id
   where m.id = p_id and m.centro_id = v_centro;
  if not found then
    raise exception 'El aviso no existe.' using errcode = '22023';
  end if;
  v_propio := v_msg.creado_por = auth.uid() or v_msg.docente_perfil = auth.uid();
  if v_rol = 'docente' and not v_propio then
    raise exception 'Este aviso no es de tus clases.' using errcode = '42501';
  end if;
  if v_msg.estado = 'cancelado' then
    raise exception 'Este aviso fue cancelado porque el estudiante ya no figura ausente.' using errcode = '22023';
  end if;

  update public.mensajes
     set estado = p_estado,
         nota = nullif(btrim(coalesce(p_nota, '')), ''),
         gestionado_por = case when p_estado = 'pendiente' then null else auth.uid() end,
         gestionado_en = case when p_estado = 'pendiente' then null else now() end
   where id = p_id;
end $$;

revoke execute on function public.guardar_asistencia(uuid, date, jsonb) from public, anon;
revoke execute on function public.gestionar_aviso(uuid, text, text) from public, anon;
grant execute on function public.guardar_asistencia(uuid, date, jsonb) to authenticated;
grant execute on function public.gestionar_aviso(uuid, text, text) to authenticated;
