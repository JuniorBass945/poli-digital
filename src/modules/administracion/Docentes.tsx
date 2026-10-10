import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, UserMinus } from 'lucide-react';
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls } from '../../ui';
import { actualizarDocente, crearDocente, darBajaDocente, listarAsignaciones, listarAulasCompletas, listarDocentes, reactivarDocente } from './apiEstructura';
import Confirmar from './Confirmar';
import { etiquetaAulaCompleta, type Asignacion, type AulaCompleta, type Docente } from './tiposEstructura';
import { MOTIVOS_BAJA_DOCENTE, etiquetaMotivoDocente, resumenClases, validarBajaDocente, validarDocente } from './validarEstructura';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Dialogo =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; d: Docente }
  | { tipo: 'baja'; d: Docente }
  | { tipo: 'reactivar'; d: Docente }
  | null;

export default function Docentes() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [aulas, setAulas] = useState<AulaCompleta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [verBajas, setVerBajas] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, a, au] = await Promise.all([listarDocentes(), listarAsignaciones(), listarAulasCompletas()]);
      setDocentes(d);
      setAsignaciones(a);
      setAulas(au);
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

  const terminar = (texto: string) => {
    setDialogo(null);
    setMensaje(texto);
    setCargando(true);
    void cargar();
  };

  const clasesDe = (id: string) => asignaciones.filter((a) => a.docenteId === id);
  const guiaDe = (id: string) => aulas.filter((a) => a.activo && a.guiaId === id);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return docentes.filter((d) => (verBajas || d.activo) && (!q || sinTildes(`${d.nombre} ${d.correo ?? ''}`).includes(q)));
  }, [docentes, busqueda, verBajas]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Mostrar dados de baja
        </label>
        <Btn className="ml-auto" onClick={() => setDialogo({ tipo: 'nuevo' })}>
          <Plus size={16} />
          Nuevo docente
        </Btn>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Docente</th>
              <th className="px-3 font-medium">Clases</th>
              <th className="px-3 font-medium">Guía de</th>
              <th className="px-3 font-medium">Estado</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => {
              const clases = clasesDe(d.id);
              const guias = guiaDe(d.id);
              return (
                <tr key={d.id} className="h-15 border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{d.nombre}</div>
                    <div className="text-xs text-muted">{d.correo ?? 'Sin correo'}</div>
                  </td>
                  <td className="px-3">{resumenClases(clases.length, new Set(clases.map((c) => c.aulaId)).size)}</td>
                  <td className="px-3">{guias.length ? guias.map(etiquetaAulaCompleta).join('; ') : <span className="text-muted">No</span>}</td>
                  <td className="px-3">{d.activo ? <Chip tono="ok">Activo</Chip> : <Chip tono="warn">Baja: {etiquetaMotivoDocente(d.bajaMotivo)}</Chip>}</td>
                  <td className="px-3 text-right">
                    <div className="inline-flex gap-2.5">
                      <Btn variante="ghost" aria-label={`Editar a ${d.nombre}`} onClick={() => setDialogo({ tipo: 'editar', d })}>
                        <Pencil size={14} />
                        Editar
                      </Btn>
                      {d.activo ? (
                        <Btn variante="danger" aria-label={`Dar de baja a ${d.nombre}`} onClick={() => setDialogo({ tipo: 'baja', d })}>
                          <UserMinus size={14} />
                          Baja
                        </Btn>
                      ) : (
                        <Btn variante="soft" aria-label={`Reactivar a ${d.nombre}`} onClick={() => setDialogo({ tipo: 'reactivar', d })}>
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
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">{docentes.length === 0 ? 'Todavía no hay docentes. Registra el primero con "Nuevo docente".' : 'Ningún docente coincide con la búsqueda.'}</td></tr>
            )}
            {cargando && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Cargando…</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-sm text-muted">El acceso al sistema de cada docente se creará más adelante con la invitación por correo; por ahora se registra su ficha.</p>

      {(dialogo?.tipo === 'nuevo' || dialogo?.tipo === 'editar') && (
        <FormularioDocente docente={dialogo.tipo === 'editar' ? dialogo.d : null} onClose={() => setDialogo(null)} onGuardado={terminar} />
      )}
      {dialogo?.tipo === 'baja' && (
        <BajaDocente d={dialogo.d} clases={clasesDe(dialogo.d.id)} guias={guiaDe(dialogo.d.id)} onClose={() => setDialogo(null)} onHecho={terminar} />
      )}
      {dialogo?.tipo === 'reactivar' && (
        <Confirmar
          titulo="Reactivar docente"
          textoBoton="Reactivar"
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await reactivarDocente(dialogo.d.id); terminar(`${dialogo.d.nombre} fue reactivado.`); }}
        >
          <p>
            <b className="text-ink">{dialogo.d.nombre}</b> vuelve a estar disponible para asignarle clases. Motivo de la baja: {etiquetaMotivoDocente(dialogo.d.bajaMotivo)}.
            {dialogo.d.bajaNota ? ` Nota: ${dialogo.d.bajaNota}.` : ''}
          </p>
        </Confirmar>
      )}
    </>
  );
}

function FormularioDocente({ docente, onClose, onGuardado }: { docente: Docente | null; onClose: () => void; onGuardado: (m: string) => void }) {
  const [nombre, setNombre] = useState(docente?.nombre ?? '');
  const [correo, setCorreo] = useState(docente?.correo ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const errs = validarDocente({ nombre, correo });
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      if (docente) {
        await actualizarDocente(docente.id, nombre.trim(), correo.trim() || null);
        onGuardado(`Los datos de ${nombre.trim()} fueron actualizados.`);
      } else {
        await crearDocente(nombre.trim(), correo.trim() || null);
        onGuardado(`${nombre.trim()} fue registrado. Ya puedes asignarle materias.`);
      }
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={docente ? 'Editar docente' : 'Nuevo docente'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} noValidate className="grid gap-3">
        <Campo etiqueta="Nombre con título (Prof., Ing. o Lic.)">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {errores.nombre && <span className="mt-1 block text-xs text-bad-ink">{errores.nombre}</span>}
        </Campo>
        <Campo etiqueta="Correo (opcional)">
          <input className={inputCls} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          {errores.correo && <span className="mt-1 block text-xs text-bad-ink">{errores.correo}</span>}
        </Campo>
        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : docente ? 'Guardar cambios' : 'Registrar docente'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function BajaDocente({
  d, clases, guias, onClose, onHecho,
}: { d: Docente; clases: Asignacion[]; guias: AulaCompleta[]; onClose: () => void; onHecho: (m: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const bloqueado = clases.length > 0 || guias.length > 0;
  const problema = validarBajaDocente(motivo, nota);
  const requiereNota = MOTIVOS_BAJA_DOCENTE.find((m) => m.codigo === motivo)?.requiereNota ?? false;

  return (
    <Confirmar
      titulo="Dar de baja al docente"
      textoBoton="Dar de baja"
      peligro
      bloqueo={
        bloqueado
          ? `Tiene ${clases.length} materia(s) asignada(s) y es guía de ${guias.length} aula(s). Reasígnalas desde la pestaña Asignaciones y vuelve a intentarlo.`
          : problema
      }
      onClose={onClose}
      onConfirmar={async () => { await darBajaDocente(d.id, motivo, nota); onHecho(`${d.nombre} fue dado de baja. Su historial se conserva.`); }}
    >
      <p>
        <b className="text-ink">{d.nombre}</b> dejará de estar disponible para asignarle clases. <b>No se borra</b>: se conserva su historial y la baja se puede deshacer.
      </p>
      <Campo etiqueta="Motivo de la baja">
        <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="">Elige un motivo</option>
          {MOTIVOS_BAJA_DOCENTE.map((m) => <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>)}
        </select>
      </Campo>
      <Campo etiqueta={requiereNota ? 'Nota (obligatoria)' : 'Nota (opcional)'}>
        <textarea rows={2} className={inputCls} value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
    </Confirmar>
  );
}
