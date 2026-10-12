import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, MessageCircle, Save } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { cx } from '../../lib/cx';
import { guardarClaseTrabajo, leerClaseTrabajo } from '../../lib/claseTrabajo';
import { fechaLarga, hoyISO, sumarDias } from '../../lib/fechas';
import { Aviso, Btn, Campo, Card, Chip, inputCls } from '../../ui';
import { cargarLista, guardarAsistencia, listarClases, type Clase, type Estado, type EstudianteLista, type ResultadoGuardado } from './api';

/** Días hacia atrás que un docente puede pasar o corregir la lista (la base de datos lo exige también). */
export const DIAS_DOCENTE = 3;

const ESTADOS: Array<{ id: Estado; etiqueta: string; activo: string }> = [
  { id: 'presente', etiqueta: 'Presente', activo: 'border-ok bg-ok-soft text-ok-ink' },
  { id: 'ausente', etiqueta: 'Ausente', activo: 'border-bad bg-bad-soft text-bad-ink' },
  { id: 'tardanza', etiqueta: 'Tarde', activo: 'border-warn bg-warn-soft text-warn-ink' },
  { id: 'excusa', etiqueta: 'Excusa', activo: 'border-info bg-info-soft text-info' },
];

export default function PasarLista() {
  const { perfil } = useAuth();
  const esDocente = perfil?.rol === 'docente';
  const hoy = hoyISO();
  const minimo = esDocente ? sumarDias(hoy, -DIAS_DOCENTE) : undefined;

  const [clases, setClases] = useState<Clase[]>([]);
  const [claseId, setClaseId] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [estudiantes, setEstudiantes] = useState<EstudianteLista[]>([]);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [registradoEn, setRegistradoEn] = useState<string | null>(null);
  const [cargandoClases, setCargandoClases] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);

  const clase = clases.find((c) => c.id === claseId) ?? null;
  const fechaFuera = fecha > hoy || (minimo !== undefined && fecha < minimo);

  useEffect(() => {
    listarClases()
      .then((lista) => {
        setClases(lista);
        const recordada = leerClaseTrabajo();
        setClaseId(lista.find((c) => c.id === recordada)?.id ?? lista[0]?.id ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargandoClases(false));
  }, []);

  const cargar = useCallback(async () => {
    if (!clase || fechaFuera || !fecha) {
      setEstudiantes([]);
      setEstados({});
      setRegistradoEn(null);
      return;
    }
    setCargandoLista(true);
    try {
      const l = await cargarLista(clase.aulaId, clase.id, fecha);
      setEstudiantes(l.estudiantes);
      setEstados(l.estados);
      setRegistradoEn(l.registradoEn);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoLista(false);
    }
  }, [clase, fecha, fechaFuera]);

  useEffect(() => {
    setResultado(null);
    void cargar();
  }, [cargar]);

  const conteo = useMemo(() => {
    const c = { presente: 0, ausente: 0, tardanza: 0, excusa: 0 };
    for (const e of estudiantes) c[estados[e.id] ?? 'presente']++;
    return c;
  }, [estudiantes, estados]);

  const elegirClase = (id: string) => {
    setClaseId(id);
    guardarClaseTrabajo(id);
  };

  async function guardar() {
    if (!clase) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await guardarAsistencia(clase.id, fecha, estados);
      setResultado(r);
      const l = await cargarLista(clase.aulaId, clase.id, fecha);
      setRegistradoEn(l.registradoEn);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted">Elige tu clase de trabajo, marca a quien no está y guarda. Las ausencias preparan el aviso a las familias.</p>

      {cargandoClases ? (
        <p className="text-sm text-muted">Cargando tus clases…</p>
      ) : clases.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          No tienes clases asignadas todavía. Pide a administración que te asigne tus materias en Gestión de datos.
        </Card>
      ) : (
        <>
          <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
            <Campo etiqueta="Clase de trabajo">
              <select className={`${inputCls} w-80 max-w-full`} value={claseId} onChange={(e) => elegirClase(e.target.value)}>
                {clases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etiqueta}
                    {!esDocente && c.docente ? ` (${c.docente})` : ''}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fecha">
              <input type="date" className={`${inputCls} w-44`} value={fecha} max={hoy} min={minimo} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <div className="pb-2.5 text-sm text-muted">{fecha ? fechaLarga(fecha) : ''}</div>
          </Card>

          {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}
          {fechaFuera && (
            <div className="mb-3">
              <Aviso tono="warn">
                {fecha > hoy
                  ? 'No se puede pasar lista de una fecha futura.'
                  : `Solo puedes pasar o corregir la lista de los últimos ${DIAS_DOCENTE} días. Para fechas anteriores, pide ayuda a coordinación.`}
              </Aviso>
            </div>
          )}

          {!fechaFuera && clase && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Chip tono="ok">Presentes: {conteo.presente}</Chip>
                <Chip tono="bad">Ausentes: {conteo.ausente}</Chip>
                <Chip tono="warn">Tarde: {conteo.tardanza}</Chip>
                <Chip tono="info">Excusa: {conteo.excusa}</Chip>
                {registradoEn && <Chip tono="neutral">Lista ya registrada: puedes corregirla</Chip>}
                <Btn
                  variante="ghost"
                  className="ml-auto"
                  onClick={() => setEstados(Object.fromEntries(estudiantes.map((e) => [e.id, 'presente' as Estado])))}
                  disabled={estudiantes.length === 0}
                >
                  <CheckCheck size={16} />
                  Todos presentes
                </Btn>
              </div>

              {cargandoLista ? (
                <p className="py-8 text-center text-sm text-muted">Cargando la lista…</p>
              ) : estudiantes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Esta aula no tiene estudiantes activos.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {estudiantes.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-[10rem]">
                        <div className="font-medium">{e.apellidos}, {e.nombres}</div>
                        <div className="text-xs text-muted">{e.matricula}</div>
                      </div>
                      <div role="group" aria-label={`Estado de ${e.nombres} ${e.apellidos}`} className="flex flex-wrap gap-1.5">
                        {ESTADOS.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={estados[e.id] === s.id}
                            onClick={() => setEstados({ ...estados, [e.id]: s.id })}
                            className={cx(
                              'min-w-[4.5rem] rounded-xl border px-3 py-2 text-sm font-medium',
                              estados[e.id] === s.id ? s.activo : 'border-line bg-surface text-muted hover:bg-surface-2'
                            )}
                          >
                            {s.etiqueta}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex justify-end">
                <Btn onClick={() => void guardar()} disabled={guardando || estudiantes.length === 0 || cargandoLista}>
                  <Save size={16} />
                  {guardando ? 'Guardando…' : registradoEn ? 'Guardar correcciones' : 'Guardar asistencia'}
                </Btn>
              </div>
            </Card>
          )}

          {resultado && (
            <div className="mt-4 grid gap-3">
              <Aviso tono="ok">
                Asistencia guardada: {resultado.presentes} presentes, {resultado.ausentes} ausentes, {resultado.tardanzas} tarde y {resultado.excusas} con excusa.
                {resultado.avisos_creados > 0 && ` Se prepararon ${resultado.avisos_creados} avisos para los tutores.`}
                {resultado.avisos_existentes > 0 && ` ${resultado.avisos_existentes} ya tenían aviso para ese día.`}
              </Aviso>
              {resultado.ausentes_sin_tutor.length > 0 && (
                <Aviso tono="warn">No se pudo preparar el aviso de {resultado.ausentes_sin_tutor.join(', ')}: no tienen tutor registrado.</Aviso>
              )}
              {resultado.ausentes > 0 && (
                <div>
                  <Btn variante="soft" onClick={() => { window.location.hash = '/avisos'; }}>
                    <MessageCircle size={16} />
                    Ir a Avisos a tutores
                  </Btn>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
