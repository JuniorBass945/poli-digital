export interface Hijo {
  id: string;
  nombres: string;
  apellidos: string;
  matricula: string;
  activo: boolean;
}

export interface ConsentimientoWhatsapp {
  otorgado: boolean;
  verificado: boolean;
  otorgadoEn: string | null;
  evidencia: string | null;
}

export interface TutorFila {
  id: string;
  nombre: string;
  parentesco: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  hijos: Hijo[];
  consentimiento: ConsentimientoWhatsapp | null;
}

export type EstadoWhatsapp = 'sin_telefono' | 'pendiente' | 'otorgado' | 'verificado';

/** Situación del tutor para recibir mensajes por WhatsApp. */
export function estadoWhatsapp(t: Pick<TutorFila, 'telefono' | 'consentimiento'>): EstadoWhatsapp {
  if (!t.telefono || t.telefono.trim() === '') return 'sin_telefono';
  const c = t.consentimiento;
  if (c?.otorgado && c.verificado) return 'verificado';
  if (c?.otorgado) return 'otorgado';
  return 'pendiente';
}

export const ETIQUETA_ESTADO: Record<EstadoWhatsapp, string> = {
  sin_telefono: 'Sin teléfono',
  pendiente: 'Consentimiento pendiente',
  otorgado: 'Otorgado, sin verificar',
  verificado: 'Otorgado y verificado',
};

export const TONO_ESTADO: Record<EstadoWhatsapp, 'bad' | 'warn' | 'info' | 'ok'> = {
  sin_telefono: 'bad',
  pendiente: 'warn',
  otorgado: 'info',
  verificado: 'ok',
};
