import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ordenarRoles, rolDeMayorAlcance, type Rol } from '../lib/roles';

export interface Perfil {
  id: string;
  centroId: string;
  centroNombre: string;
  /** Rol de mayor alcance (docente + coordinación = coordinación). Las pantallas que ya comparan `rol` siguen funcionando. */
  rol: Rol;
  /** Todos los roles de la persona. */
  roles: Rol[];
  nombre: string;
}

/** Si la persona entró con una clave temporal: no puede usar el sistema hasta cambiarla. */
export interface ClaveTemporal {
  nombre: string;
  vencida: boolean;
}

interface Estado {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  claveTemporal: ClaveTemporal | null;
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
  perfil_roles?: Array<{ rol: Rol }> | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [claveTemporal, setClaveTemporal] = useState<ClaveTemporal | null>(null);
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
      setClaveTemporal(null);
      setModulosActivos(new Set());
      return;
    }
    setCargandoPerfil(true);
    setError(null);
    // Primero el estado del acceso: con una clave temporal la base no deja leer nada más.
    const { data: estadoAcceso } = await supabase.rpc('mi_estado_acceso');
    const ea = (estadoAcceso ?? null) as { debe_cambiar?: boolean; vencida?: boolean; nombre?: string; activo?: boolean } | null;
    if (ea?.debe_cambiar) {
      setClaveTemporal({ nombre: ea.nombre ?? '', vencida: !!ea.vencida });
      setPerfil(null);
      setCargandoPerfil(false);
      return;
    }
    setClaveTemporal(null);
    if (ea && ea.activo === false) {
      setPerfil(null);
      setError('Tu acceso está desactivado. Habla con la administración del centro.');
      setCargandoPerfil(false);
      return;
    }
    const { data, error: e } = await supabase
      .from('perfiles')
      .select('id, centro_id, rol, nombre, centros(nombre), perfil_roles(rol)')
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
    const roles = ordenarRoles((fila.perfil_roles ?? []).map((r) => r.rol).concat(fila.rol));
    setPerfil({ id: fila.id, centroId: fila.centro_id, centroNombre: centro?.nombre ?? '', rol: rolDeMayorAlcance(roles), roles, nombre: fila.nombre });
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
      claveTemporal,
      modulosActivos,
      error,
      salir: async () => { await supabase.auth.signOut(); },
      recargar: cargarPerfil,
    }),
    [cargandoSesion, cargandoPerfil, sesion, perfil, claveTemporal, modulosActivos, error, cargarPerfil]
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
