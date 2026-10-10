import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls } from '../../ui';
import { actualizarMateria, archivarMateria, crearMateria, listarAsignaciones, listarMaterias, reactivarMateria } from './apiEstructura';
import Confirmar from './Confirmar';
import type { Asignacion, Materia } from './tiposEstructura';
import { validarMateria } from './validarEstructura';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Dialogo = { tipo: 'nuevo' } | { tipo: 'editar'; m: Materia } | { tipo: 'archivar'; m: Materia } | { tipo: 'reactivar'; m: Materia } | null;

export default function Materias() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([listarMaterias(), listarAsignaciones()]);
      setMaterias(m);
      setAsignaciones(a);
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
  const usos = (id: string) => new Set(asignaciones.filter((a) => a.materiaId === id).map((a) => a.aulaId)).size;

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return materias.filter((m) => (verArchivadas || m.activo) && (!q || sinTildes(`${m.nombre} ${m.codigo ?? ''}`).includes(q)));
  }, [materias, busqueda, verArchivadas]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Nombre o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} />
          Mostrar archivadas
        </label>
        <Btn className="ml-auto" onClick={() => setDialogo({ tipo: 'nuevo' })}><Plus size={16} />Nueva materia</Btn>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Materia</th>
              <th className="px-3 font-medium">Código</th>
              <th className="px-3 font-medium">Se da en</th>
              <th className="px-3 font-medium">Estado</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => {
              const n = usos(m.id);
              return (
                <tr key={m.id} className="h-15 border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{m.nombre}</td>
                  <td className="px-3 text-muted">{m.codigo ?? '—'}</td>
                  <td className="px-3">{n === 0 ? <span className="text-muted">Ninguna aula</span> : `${n} ${n === 1 ? 'aula' : 'aulas'}`}</td>
                  <td className="px-3">{m.activo ? <Chip tono="ok">Activa</Chip> : <Chip tono="warn">Archivada</Chip>}</td>
                  <td className="px-3 text-right">
                    <div className="inline-flex gap-2.5">
                      <Btn variante="ghost" aria-label={`Editar ${m.nombre}`} onClick={() => setDialogo({ tipo: 'editar', m })}><Pencil size={14} />Editar</Btn>
                      {m.activo ? (
                        <Btn variante="danger" aria-label={`Archivar ${m.nombre}`} onClick={() => setDialogo({ tipo: 'archivar', m })}><Archive size={14} />Archivar</Btn>
                      ) : (
                        <Btn variante="soft" aria-label={`Reactivar ${m.nombre}`} onClick={() => setDialogo({ tipo: 'reactivar', m })}><RotateCcw size={14} />Reactivar</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">{materias.length === 0 ? 'Todavía no hay materias. Crea la primera con "Nueva materia".' : 'Ninguna materia coincide con la búsqueda.'}</td></tr>
            )}
            {cargando && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Cargando…</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-sm text-muted">Las materias son el catálogo del centro. Para dar una materia en un aula y elegir su docente, usa la pestaña Asignaciones.</p>

      {(dialogo?.tipo === 'nuevo' || dialogo?.tipo === 'editar') && (
        <FormularioMateria materia={dialogo.tipo === 'editar' ? dialogo.m : null} onClose={() => setDialogo(null)} onGuardado={terminar} />
      )}
      {dialogo?.tipo === 'archivar' && (
        <Confirmar
          titulo="Archivar materia"
          textoBoton="Archivar"
          peligro
          bloqueo={usos(dialogo.m.id) > 0 ? `Está asignada en ${usos(dialogo.m.id)} aula(s). Quítala de esas aulas desde la pestaña Asignaciones y vuelve a intentarlo.` : null}
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await archivarMateria(dialogo.m.id); terminar(`${dialogo.m.nombre} fue archivada.`); }}
        >
          <p><b className="text-ink">{dialogo.m.nombre}</b> dejará de poder asignarse a aulas. No se borra: se puede reactivar.</p>
        </Confirmar>
      )}
      {dialogo?.tipo === 'reactivar' && (
        <Confirmar
          titulo="Reactivar materia"
          textoBoton="Reactivar"
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await reactivarMateria(dialogo.m.id); terminar(`${dialogo.m.nombre} fue reactivada.`); }}
        >
          <p><b className="text-ink">{dialogo.m.nombre}</b> vuelve a poder asignarse a las aulas.</p>
        </Confirmar>
      )}
    </>
  );
}

function FormularioMateria({ materia, onClose, onGuardado }: { materia: Materia | null; onClose: () => void; onGuardado: (m: string) => void }) {
  const [nombre, setNombre] = useState(materia?.nombre ?? '');
  const [codigo, setCodigo] = useState(materia?.codigo ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const errs = validarMateria({ nombre });
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      if (materia) {
        await actualizarMateria(materia.id, nombre.trim(), codigo.trim() || null);
        onGuardado(`La materia ${nombre.trim()} fue actualizada.`);
      } else {
        await crearMateria(nombre.trim(), codigo.trim() || null);
        onGuardado(`La materia ${nombre.trim()} fue creada.`);
      }
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={materia ? 'Editar materia' : 'Nueva materia'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} noValidate className="grid gap-3">
        <Campo etiqueta="Nombre de la materia">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {errores.nombre && <span className="mt-1 block text-xs text-bad-ink">{errores.nombre}</span>}
        </Campo>
        <Campo etiqueta="Código (opcional)">
          <input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Campo>
        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : materia ? 'Guardar cambios' : 'Crear materia'}</Btn>
        </div>
      </form>
    </Modal>
  );
}
