export interface Docente {
  id: string;
  nombre: string;
  correo: string | null;
  activo: boolean;
  bajaMotivo: string | null;
  bajaNota: string | null;
  perfilId: string | null;
}

export interface Materia {
  id: string;
  nombre: string;
  codigo: string | null;
  activo: boolean;
}

export interface AulaCompleta {
  id: string;
  grado: string;
  seccion: string;
  especialidad: string | null;
  guiaId: string | null;
  activo: boolean;
}

export interface Asignacion {
  id: string;
  aulaId: string;
  materiaId: string;
  docenteId: string;
}

export const etiquetaAulaCompleta = (a: Pick<AulaCompleta, 'grado' | 'seccion' | 'especialidad'>) =>
  `${a.grado} ${a.seccion}${a.especialidad ? `, ${a.especialidad}` : ''}`;
