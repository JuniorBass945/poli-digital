-- =====================================================================
-- Borra los datos de DEMOSTRACIÓN de asistencia creados por supabase/seed_asistencia_demo.sql
-- (los registros con la nota "demo" y las listas que quedan sin registros).
-- Úsalo solo en el proyecto de pruebas, en el SQL Editor de Supabase. No toca la asistencia real.
-- =====================================================================
begin;
alter table public.asistencias disable trigger auditar;   -- evita llenar la auditoría con miles de bajas
delete from public.asistencias where nota = 'demo';
alter table public.asistencias enable trigger auditar;
delete from public.asistencia_sesiones s
 where not exists (select 1 from public.asistencias a where a.asignacion_id = s.asignacion_id and a.fecha = s.fecha);
select (select count(*) from public.asistencias) as asistencias_que_quedan,
       (select count(*) from public.asistencia_sesiones) as listas_que_quedan;
commit;
