import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { GraduationCap, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { etiquetaRoles } from '../lib/roles';
import { cx } from '../lib/cx';
import { MODULOS, modulosVisibles } from '../modules/registry';
import { Btn, Card } from '../ui';
import { EnCarga } from '../ui/Carga';
import { useHashRoute } from './useHashRoute';

// Un componente cargado de forma diferida por módulo: lo que no se usa no se descarga.
const CARGADOS: Record<string, ComponentType> = Object.fromEntries(MODULOS.map((m) => [m.id, lazy(m.cargar)]));

export default function Shell() {
  const { perfil, modulosActivos, salir } = useAuth();
  const [ruta, ir] = useHashRoute('inicio');
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = oscuro ? 'dark' : 'light';
  }, [oscuro]);

  if (!perfil) return null;
  const visibles = modulosVisibles(perfil.roles ?? [perfil.rol], modulosActivos);
  const actual = visibles.find((m) => m.id === ruta) ?? visibles[0];
  const Pantalla = CARGADOS[actual.id];

  return (
    <div className="min-h-screen lg:pl-[216px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[216px] flex-col bg-[var(--side)] text-[#E7ECF8] lg:flex">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <GraduationCap size={22} color="#1d4e9e" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold text-white">Poli Digital</div>
            <div className="text-xs text-[#9FB3DA]">{perfil.centroNombre}</div>
          </div>
        </div>
        <nav aria-label="Módulos" className="flex-1 overflow-y-auto px-3 pb-4">
          {visibles.map((m) => {
            const Icono = m.icono;
            const on = m.id === actual.id;
            return (
              <button
                key={m.id}
                onClick={() => ir(m.id)}
                aria-current={on ? 'page' : undefined}
                className={cx('mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm', on ? 'bg-white font-semibold text-[#0F2A56]' : 'font-medium text-[#C9D6EF] hover:bg-white/10')}
              >
                <Icono size={18} className="shrink-0" />
                <span>{m.etiqueta}</span>
              </button>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 rounded-xl bg-white/10 px-3.5 py-3 text-xs text-[#C9D6EF]">
          <b className="font-semibold text-white">{perfil.nombre}</b>
          <div>{etiquetaRoles(perfil.roles ?? [perfil.rol])}</div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
        <div className="font-display text-lg font-semibold lg:hidden">Poli Digital</div>
        <label className="ml-auto flex items-center gap-2 text-sm lg:hidden">
          <span className="sr-only">Módulo</span>
          <select className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" value={actual.id} onChange={(e) => ir(e.target.value)}>
            {visibles.map((m) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
          </select>
        </label>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <span className="text-sm text-muted">{perfil.nombre}</span>
        </div>
        <button aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={() => setOscuro(!oscuro)} className="rounded-xl border border-line bg-surface p-2 text-muted hover:text-ink">
          {oscuro ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Btn variante="ghost" onClick={() => void salir()}><LogOut size={15} />Salir</Btn>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-7">
        <Suspense fallback={<Card className="p-6"><EnCarga texto="Cargando el módulo…" /></Card>}>
          <Pantalla />
        </Suspense>
      </main>
    </div>
  );
}
