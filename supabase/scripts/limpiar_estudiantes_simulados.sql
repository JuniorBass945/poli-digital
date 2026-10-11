-- =====================================================================
-- Limpieza de los estudiantes SIMULADOS de la importación de prueba
-- (los del archivo docs/ejemplos/estudiantes_simulados.xlsx, con matrícula S26-....).
--
-- Úsalo solo en el proyecto de pruebas, en el SQL Editor de Supabase.
-- Borra de verdad esos estudiantes, sus matrículas y los tutores que solo
-- estaban vinculados a ellos. No toca a los estudiantes de demostración (P26-...).
-- Las ediciones que hayas hecho a esos registros también se pierden.
-- =====================================================================
begin;

create temp table tut_sim on commit drop as
  select distinct et.tutor_id as id
  from public.estudiante_tutor et
  join public.estudiantes e on e.id = et.estudiante_id and e.matricula like 'S26-%'
  where not exists (
    select 1 from public.estudiante_tutor x
    join public.estudiantes e2 on e2.id = x.estudiante_id
    where x.tutor_id = et.tutor_id and e2.matricula not like 'S26-%');

delete from public.estudiante_tutor where estudiante_id in (select id from public.estudiantes where matricula like 'S26-%');
delete from public.matriculas where estudiante_id in (select id from public.estudiantes where matricula like 'S26-%');
delete from public.estudiantes where matricula like 'S26-%';
delete from public.consentimientos where tutor_id in (select id from tut_sim);
delete from public.tutores where id in (select id from tut_sim) and perfil_id is null;

select (select count(*) from public.estudiantes) as estudiantes_que_quedan,
       (select count(*) from public.tutores) as tutores_que_quedan;
commit;
