import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, UserMinus } from 'lucide-react';
import { Aviso, Btn, Card, Chip, Campo, Modal, inputCls } from '../../ui';
import { listarAulas, listarEstudiantes, reactivarEstudiante } from './api';
import BajaModal from './BajaModal';
import EstudianteForm from './EstudianteForm';
import { etiquetaAula, type Aula, type EstudianteFila } from './tipos';
import { etiquetaMotivo } from './validar';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PASO = 100;

type Dialogo =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; fila: EstudianteFila }
  | { tipo: 'baja'; fila: EstudianteFila }
  | { tipo: 'reactivar'; fila: EstudianteFila }
  | null;

export default function Estudiantes() {
  const [filas, setFilas] = useState<EstudianteFila[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [aulaFiltro, setAulaFiltro] = useState('todas');
  const [verBajas, setVerBajas] = useState(false);
  const [limite, setLimite] = useState(PASO);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      const [e, a] = await Promise.all([listarEstudiantes(), listarAulas()]);
      setFilas(e);
      setAulas(a);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 6000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const aulaPorId = useMemo(() => new Map(aulas.map((a) => [a.id, a])), [aulas]);
  const activos = filas.filter((f) => f.activo).length;
  const deBaja = filas.length - activos;

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return filas.filter((f) => {
      if (!verBajas && !f.activo) return false;
      if (aulaFiltro !== 'todas' && f.aulaId !== aulaFiltro) return false;
      if (!q) return true;
      return sinTildes(`${f.nombres} ${f.apellidos} ${f.matricula} ${f.tutor?.nombre ?? ''}`).includes(q);
    });
  }, [filas, busqueda, aulaFiltro, verBajas]);

  const alTerminar = (texto: string) => {
    setDialogo(null);
    setMensaje(texto);
    setCargando(true);
    void cargar();
  };

  async function reactivar(fila: EstudianteFila) {
    try {
      await reactivarEstudiante(fila.id);
      alTerminar(`${fila.nombres} ${fila.apellidos} fue reactivado.`);
    } catch (err) {
      setDialogo(null);
      setError((err as Error).message);
    }
  }

  const comparteTutorCon = (fila: EstudianteFila) =>
    fila.tutor ? filas.filter((f) => f.id !== fila.id && f.tutor?.id === fila.tutor?.id).map((f) => f.nombres) : [];

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Nombre, matrícula o tutor"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setLimite(PASO); }}
            />
          </div>
        </Campo>
        <Campo etiqueta="Aula">
          <select className={`${inputCls} w-52`} value={aulaFiltro} onChange={(e) => { setAulaFiltro(e.target.value); setLimite(PASO); }}>
            <option value="todas">Todas las aulas</option>
            {aulas.map((a) => (
              <option key={a.id} value={a.id}>
                {etiquetaAula(a)}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Mostrar dados de baja
        </label>
        <Btn className="ml-auto" onClick={() => setDialogo({ tipo: 'nuevo' })} disabled={aulas.length === 0}>
          <Plus size={16} />
          Nuevo estudiante
        </Btn>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Estudiante</th>
              <th className="px-3 font-medium">Aula</th>
              <th className="px-3 font-medium">Tutor</th>
              <th className="px-3 font-medium">Estado</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.slice(0, limite).map((f) => {
              const aula = f.aulaId ? aulaPorId.get(f.aulaId) : undefined;
              return (
                <tr key={f.id} className="h-15 border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {f.apellidos}, {f.nombres}
                    </div>
                    <div className="text-xs text-muted">{f.matricula}</div>
                  </td>
                  <td className="px-3">{aula ? etiquetaAula(aula) : <span className="text-muted">Sin aula</span>}</td>
                  <td className="px-3">
                    {f.tutor ? (
                      <>
                        <div>{f.tutor.nombre}</div>
                        <div className="text-xs text-muted">{f.tutor.telefono}</div>
                      </>
                    ) : (
                      <span className="text-muted">Sin tutor</span>
                    )}
                  </td>
                  <td className="px-3">
                    {f.activo ? <Chip tono="ok">Activo</Chip> : <Chip tono="warn">Baja: {etiquetaMotivo(f.bajaMotivo)}</Chip>}
                  </td>
                  <td className="px-3 text-right">
                    <div className="inline-flex gap-2.5">
                      <Btn variante="ghost" aria-label={`Editar a ${f.nombres} ${f.apellidos}`} onClick={() => setDialogo({ tipo: 'editar', fila: f })}>
                        <Pencil size={14} />
                        Editar
                      </Btn>
                      {f.activo ? (
                        <Btn variante="danger" aria-label={`Dar de baja a ${f.nombres} ${f.apellidos}`} onClick={() => setDialogo({ tipo: 'baja', fila: f })}>
                          <UserMinus size={14} />
                          Baja
                        </Btn>
                      ) : (
                        <Btn variante="soft" aria-label={`Reactivar a ${f.nombres} ${f.apellidos}`} onClick={() => setDialogo({ tipo: 'reactivar', fila: f })}>
                          <RotateCcw size={14} />
                          Reactivar
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!cargando && visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  {filas.length === 0 ? 'Todavía no hay estudiantes. Registra el primero con "Nuevo estudiante".' : 'Ningún estudiante coincide con la búsqueda.'}
                </td>
              </tr>
            )}
            {cargando && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          {visibles.length} {visibles.length === 1 ? 'estudiante' : 'estudiantes'} en la lista. Activos: {activos}. De baja: {deBaja}.
        </span>
        {visibles.length > limite && (
          <Btn variante="ghost" onClick={() => setLimite(limite + PASO)}>
            Mostrar más
          </Btn>
        )}
      </div>

      {dialogo?.tipo === 'nuevo' && <EstudianteForm aulas={aulas} estudiante={null} comparteTutorCon={[]} onClose={() => setDialogo(null)} onGuardado={alTerminar} />}
      {dialogo?.tipo === 'editar' && (
        <EstudianteForm aulas={aulas} estudiante={dialogo.fila} comparteTutorCon={comparteTutorCon(dialogo.fila)} onClose={() => setDialogo(null)} onGuardado={alTerminar} />
      )}
      {dialogo?.tipo === 'baja' && <BajaModal estudiante={dialogo.fila} onClose={() => setDialogo(null)} onHecho={alTerminar} />}
      {dialogo?.tipo === 'reactivar' && (
        <Modal titulo="Reactivar estudiante" onClose={() => setDialogo(null)}>
          <p className="text-sm text-muted">
            <b className="text-ink">
              {dialogo.fila.nombres} {dialogo.fila.apellidos}
            </b>{' '}
            volverá a las listas de su aula. Motivo de la baja: {etiquetaMotivo(dialogo.fila.bajaMotivo)}.
            {dialogo.fila.bajaNota ? ` Nota: ${dialogo.fila.bajaNota}.` : ''}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Btn variante="ghost" onClick={() => setDialogo(null)}>
              Cancelar
            </Btn>
            <Btn onClick={() => void reactivar(dialogo.fila)}>Reactivar</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
