import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls } from '../../ui';
import { actualizarAula, anioEscolarActual, archivarAula, crearAula, estudiantesPorAula, listarAsignaciones, listarAulasCompletas, listarDocentes, reactivarAula } from './apiEstructura';
import Confirmar from './Confirmar';
import { etiquetaAulaCompleta, type Asignacion, type AulaCompleta, type Docente } from './tiposEstructura';
import { GRADOS, SECCIONES, validarAula } from './validarEstructura';

type Dialogo = { tipo: 'nuevo' } | { tipo: 'editar'; a: AulaCompleta } | { tipo: 'archivar'; a: AulaCompleta } | { tipo: 'reactivar'; a: AulaCompleta } | null;

export default function Aulas() {
  const [aulas, setAulas] = useState<AulaCompleta[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [conteo, setConteo] = useState<Map<string, number>>(new Map());
  const [anio, setAnio] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, d, s, c, y] = await Promise.all([listarAulasCompletas(), listarDocentes(), listarAsignaciones(), estudiantesPorAula(), anioEscolarActual()]);
      setAulas(a);
      setDocentes(d);
      setAsignaciones(s);
      setConteo(c);
      setAnio(y);
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

  const terminar = (texto: string) => { setDialogo(null); setMensaje(texto); setCargando(true); void cargar(); };
  const docentePorId = useMemo(() => new Map(docentes.map((d) => [d.id, d])), [docentes]);
  const visibles = aulas.filter((a) => verArchivadas || a.activo);
  const especialidades = useMemo(() => [...new Set(aulas.map((a) => a.especialidad).filter((x): x is string => !!x))].sort(), [aulas]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <div className="pb-1 text-sm text-muted">Año escolar actual: <b className="text-ink">{anio ?? 'sin configurar'}</b></div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} />
          Mostrar archivadas
        </label>
        <Btn className="ml-auto" onClick={() => setDialogo({ tipo: 'nuevo' })} disabled={!anio}><Plus size={16} />Nueva aula</Btn>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Aula</th>
              <th className="px-3 font-medium">Docente guía</th>
              <th className="px-3 text-center font-medium">Estudiantes</th>
              <th className="px-3 text-center font-medium">Materias</th>
              <th className="px-3 font-medium">Estado</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((a) => (
              <tr key={a.id} className="h-15 border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium">{etiquetaAulaCompleta(a)}</td>
                <td className="px-3">{a.guiaId ? docentePorId.get(a.guiaId)?.nombre ?? '—' : <span className="text-muted">Sin guía</span>}</td>
                <td className="px-3 text-center">{conteo.get(a.id) ?? 0}</td>
                <td className="px-3 text-center">{asignaciones.filter((s) => s.aulaId === a.id).length}</td>
                <td className="px-3">{a.activo ? <Chip tono="ok">Activa</Chip> : <Chip tono="warn">Archivada</Chip>}</td>
                <td className="px-3 text-right">
                  <div className="inline-flex gap-2.5">
                    <Btn variante="ghost" aria-label={`Editar ${etiquetaAulaCompleta(a)}`} onClick={() => setDialogo({ tipo: 'editar', a })}><Pencil size={14} />Editar</Btn>
                    {a.activo ? (
                      <Btn variante="danger" aria-label={`Archivar ${etiquetaAulaCompleta(a)}`} onClick={() => setDialogo({ tipo: 'archivar', a })}><Archive size={14} />Archivar</Btn>
                    ) : (
                      <Btn variante="soft" aria-label={`Reactivar ${etiquetaAulaCompleta(a)}`} onClick={() => setDialogo({ tipo: 'reactivar', a })}><RotateCcw size={14} />Reactivar</Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Todavía no hay aulas. Crea la primera con "Nueva aula".</td></tr>
            )}
            {cargando && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Cargando…</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-sm text-muted">Las aulas nuevas se crean en el año escolar actual. El cambio de año y la promoción de grado se harán en otra parte.</p>

      {(dialogo?.tipo === 'nuevo' || dialogo?.tipo === 'editar') && (
        <FormularioAula aula={dialogo.tipo === 'editar' ? dialogo.a : null} docentes={docentes.filter((d) => d.activo)} especialidades={especialidades} onClose={() => setDialogo(null)} onGuardado={terminar} />
      )}
      {dialogo?.tipo === 'archivar' && (
        <Confirmar
          titulo="Archivar aula"
          textoBoton="Archivar"
          peligro
          bloqueo={(conteo.get(dialogo.a.id) ?? 0) > 0 ? `Tiene ${conteo.get(dialogo.a.id)} estudiante(s) activo(s). Muévelos a otra aula desde Estudiantes y vuelve a intentarlo.` : null}
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await archivarAula(dialogo.a.id); terminar(`${etiquetaAulaCompleta(dialogo.a)} fue archivada.`); }}
        >
          <p><b className="text-ink">{etiquetaAulaCompleta(dialogo.a)}</b> se archiva y sus asignaciones de materias dejan de estar activas. No se borra: se puede reactivar.</p>
        </Confirmar>
      )}
      {dialogo?.tipo === 'reactivar' && (
        <Confirmar
          titulo="Reactivar aula"
          textoBoton="Reactivar"
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await reactivarAula(dialogo.a.id); terminar(`${etiquetaAulaCompleta(dialogo.a)} fue reactivada. Vuelve a asignarle sus materias.`); }}
        >
          <p><b className="text-ink">{etiquetaAulaCompleta(dialogo.a)}</b> vuelve a estar activa. Sus materias hay que asignarlas de nuevo.</p>
        </Confirmar>
      )}
    </>
  );
}

function FormularioAula({
  aula, docentes, especialidades, onClose, onGuardado,
}: { aula: AulaCompleta | null; docentes: Docente[]; especialidades: string[]; onClose: () => void; onGuardado: (m: string) => void }) {
  const [grado, setGrado] = useState(aula?.grado ?? '');
  const [seccion, setSeccion] = useState(aula?.seccion ?? '');
  const [especialidad, setEspecialidad] = useState(aula?.especialidad ?? '');
  const [guiaId, setGuiaId] = useState(aula?.guiaId ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const errs = validarAula({ grado, seccion });
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      if (aula) {
        await actualizarAula(aula.id, grado, seccion, especialidad.trim() || null, guiaId || null);
        onGuardado('El aula fue actualizada.');
      } else {
        await crearAula(grado, seccion, especialidad.trim() || null, guiaId || null);
        onGuardado(`El aula ${grado} ${seccion} fue creada. Ahora puedes asignarle materias.`);
      }
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={aula ? 'Editar aula' : 'Nueva aula'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} noValidate className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Grado">
            <select className={inputCls} value={grado} onChange={(e) => setGrado(e.target.value)}>
              <option value="">Elige</option>
              {GRADOS.map((g) => <option key={g}>{g}</option>)}
            </select>
            {errores.grado && <span className="mt-1 block text-xs text-bad-ink">{errores.grado}</span>}
          </Campo>
          <Campo etiqueta="Sección">
            <select className={inputCls} value={seccion} onChange={(e) => setSeccion(e.target.value)}>
              <option value="">Elige</option>
              {SECCIONES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {errores.seccion && <span className="mt-1 block text-xs text-bad-ink">{errores.seccion}</span>}
          </Campo>
        </div>
        <Campo etiqueta="Especialidad (opcional)">
          <input className={inputCls} list="especialidades-existentes" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Ej.: Informática" />
          <datalist id="especialidades-existentes">{especialidades.map((e) => <option key={e} value={e} />)}</datalist>
        </Campo>
        <Campo etiqueta="Docente guía (opcional)">
          <select className={inputCls} value={guiaId} onChange={(e) => setGuiaId(e.target.value)}>
            <option value="">Sin guía</option>
            {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </Campo>
        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : aula ? 'Guardar cambios' : 'Crear aula'}</Btn>
        </div>
      </form>
    </Modal>
  );
}
