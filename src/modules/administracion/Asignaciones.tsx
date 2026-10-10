import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Aviso, Btn, Campo, Card, Chip, inputCls } from '../../ui';
import { asignarMateria, cambiarDocenteAsignacion, listarAsignaciones, listarAulasCompletas, listarDocentes, listarMaterias, quitarAsignacion } from './apiEstructura';
import Confirmar from './Confirmar';
import { etiquetaAulaCompleta, type Asignacion, type AulaCompleta, type Docente, type Materia } from './tiposEstructura';

export default function Asignaciones() {
  const [aulas, setAulas] = useState<AulaCompleta[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [aulaId, setAulaId] = useState('');
  const [materiaNueva, setMateriaNueva] = useState('');
  const [docenteNuevo, setDocenteNuevo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [quitar, setQuitar] = useState<Asignacion | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, m, d, s] = await Promise.all([listarAulasCompletas(), listarMaterias(), listarDocentes(), listarAsignaciones()]);
      setAulas(a.filter((x) => x.activo));
      setMaterias(m);
      setDocentes(d);
      setAsignaciones(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 6000);
    return () => clearTimeout(t);
  }, [mensaje]);
  useEffect(() => {
    if (!aulaId && aulas.length > 0) setAulaId(aulas[0].id);
  }, [aulas, aulaId]);

  const materiaPorId = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias]);
  const docentesActivos = docentes.filter((d) => d.activo);
  const delAula = asignaciones.filter((a) => a.aulaId === aulaId).sort((x, y) => (materiaPorId.get(x.materiaId)?.nombre ?? '').localeCompare(materiaPorId.get(y.materiaId)?.nombre ?? ''));
  const asignadas = new Set(delAula.map((a) => a.materiaId));
  const disponibles = materias.filter((m) => m.activo && !asignadas.has(m.id));
  const aula = aulas.find((a) => a.id === aulaId);

  async function ejecutar(accion: () => Promise<void>, texto: string) {
    try {
      await accion();
      setError(null);
      setMensaje(texto);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Aula">
          <select className={`${inputCls} w-72`} value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
            {aulas.map((a) => <option key={a.id} value={a.id}>{etiquetaAulaCompleta(a)}</option>)}
          </select>
        </Campo>
        {aula && <Chip tono="brand">{delAula.length} {delAula.length === 1 ? 'materia asignada' : 'materias asignadas'}</Chip>}
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      {!cargando && aulas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Primero crea al menos un aula en la pestaña Aulas.</Card>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Materia</th>
                  <th className="px-3 font-medium">Docente</th>
                  <th className="px-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {delAula.map((a) => {
                  const m = materiaPorId.get(a.materiaId);
                  const actual = docentes.find((d) => d.id === a.docenteId);
                  return (
                    <tr key={a.id} className="h-15 border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-medium">{m?.nombre ?? '—'}</td>
                      <td className="px-3">
                        <select
                          aria-label={`Docente de ${m?.nombre ?? 'la materia'}`}
                          className={`${inputCls} max-w-xs py-1.5`}
                          value={a.docenteId}
                          onChange={(e) => void ejecutar(() => cambiarDocenteAsignacion(a.id, e.target.value), `Docente de ${m?.nombre ?? 'la materia'} actualizado.`)}
                        >
                          {actual && !actual.activo && <option value={actual.id}>{actual.nombre} (de baja)</option>}
                          {docentesActivos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-3 text-right">
                        <Btn variante="danger" aria-label={`Quitar ${m?.nombre ?? 'la materia'}`} onClick={() => setQuitar(a)}><Trash2 size={14} />Quitar</Btn>
                      </td>
                    </tr>
                  );
                })}
                {!cargando && delAula.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-muted">Esta aula todavía no tiene materias. Agrega la primera abajo.</td></tr>
                )}
                {cargando && <tr><td colSpan={3} className="px-4 py-10 text-center text-muted">Cargando…</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card className="mt-4 p-4">
            <h2 className="mb-3 text-base font-semibold">Agregar una materia a esta aula</h2>
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Materia">
                <select className={`${inputCls} w-64`} value={materiaNueva} onChange={(e) => setMateriaNueva(e.target.value)}>
                  <option value="">Elige una materia</option>
                  {disponibles.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Docente">
                <select className={`${inputCls} w-64`} value={docenteNuevo} onChange={(e) => setDocenteNuevo(e.target.value)}>
                  <option value="">Elige un docente</option>
                  {docentesActivos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </Campo>
              <Btn
                disabled={!materiaNueva || !docenteNuevo || !aulaId}
                onClick={() =>
                  void ejecutar(async () => {
                    await asignarMateria(aulaId, materiaNueva, docenteNuevo);
                    setMateriaNueva('');
                    setDocenteNuevo('');
                  }, `${materiaPorId.get(materiaNueva)?.nombre ?? 'La materia'} fue asignada.`)
                }
              >
                <Plus size={16} />
                Agregar
              </Btn>
            </div>
            {disponibles.length === 0 && materias.length > 0 && <p className="mt-2 text-xs text-muted">Esta aula ya tiene todas las materias del catálogo.</p>}
          </Card>
        </>
      )}

      {quitar && (
        <Confirmar
          titulo="Quitar materia del aula"
          textoBoton="Quitar"
          peligro
          onClose={() => setQuitar(null)}
          onConfirmar={async () => {
            await quitarAsignacion(quitar.id);
            setQuitar(null);
            setMensaje(`${materiaPorId.get(quitar.materiaId)?.nombre ?? 'La materia'} fue quitada del aula.`);
            await cargar();
          }}
        >
          <p>
            <b className="text-ink">{materiaPorId.get(quitar.materiaId)?.nombre}</b> deja de darse en {aula ? etiquetaAulaCompleta(aula) : 'esta aula'}. No se borra el historial y se puede volver a asignar.
          </p>
        </Confirmar>
      )}
    </>
  );
}
