import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Rol } from '../lib/roles';

export interface Perfil {
  id: string;
  centroId: string;
  centroNombre: string;
  rol: Rol;
  nombre: string;
}

interface Estado {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  modulosActivos: ReadonlySet<string>;
  error: string | null;
  salir: () => Promise<void>;
  recargar: () => Promise<void>;
}

const Ctx = createContext<Estado | null>(null);
export function useAuth(): Estado {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return v;
}

interface FilaPerfil {
  id: string;
  centro_id: string;
  rol: Rol;
  nombre: string;
  centros: { nombre: string } | { nombre: string }[] | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [modulosActivos, setModulosActivos] = useState<ReadonlySet<string>>(new Set());
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Sesión de Supabase Auth. El callback solo guarda la sesión: las consultas van aparte.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // 2) Perfil (rol y centro) y banderas de módulos del centro.
  const usuarioId = sesion?.user.id;
  const cargarPerfil = useCallback(async () => {
    if (!usuarioId) {
      setPerfil(null);
      setModulosActivos(new Set());
      return;
    }
    setCargandoPerfil(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('perfiles')
      .select('id, centro_id, rol, nombre, centros(nombre)')
      .eq('id', usuarioId)
      .maybeSingle();
    if (e) {
      setError('No se pudo leer tu perfil. Intenta de nuevo.');
      setCargandoPerfil(false);
      return;
    }
    const fila = data as unknown as FilaPerfil | null;
    if (!fila) {
      setPerfil(null);
      setCargandoPerfil(false);
      return;
    }
    const centro = Array.isArray(fila.centros) ? fila.centros[0] : fila.centros;
    setPerfil({ id: fila.id, centroId: fila.centro_id, centroNombre: centro?.nombre ?? '', rol: fila.rol, nombre: fila.nombre });
    const { data: mods } = await supabase.from('modulos_activos').select('modulo').eq('activo', true);
    setModulosActivos(new Set((mods ?? []).map((m) => m.modulo as string)));
    setCargandoPerfil(false);
  }, [usuarioId]);

  useEffect(() => {
    void cargarPerfil();
  }, [cargarPerfil]);

  const valor = useMemo<Estado>(
    () => ({
      cargando: cargandoSesion || cargandoPerfil,
      sesion,
      perfil,
      modulosActivos,
      error,
      salir: async () => { await supabase.auth.signOut(); },
      recargar: cargarPerfil,
    }),
    [cargandoSesion, cargandoPerfil, sesion, perfil, modulosActivos, error, cargarPerfil]
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
