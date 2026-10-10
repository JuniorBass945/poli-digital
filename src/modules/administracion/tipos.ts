export interface Aula {
  id: string;
  grado: string;
  seccion: string;
  especialidad: string | null;
  anio_escolar_id: string;
}

export interface TutorResumen {
  id: string;
  nombre: string;
  parentesco: string | null;
  telefono: string | null;
  correo: string | null;
}

/** Una fila de la lista de estudiantes, ya aplanada. */
export interface EstudianteFila {
  id: string;
  matricula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  activo: boolean;
  bajaEn: string | null;
  bajaMotivo: string | null;
  bajaNota: string | null;
  aulaId: string | null;
  tutor: TutorResumen | null;
}

export interface DatosEstudiante {
  matricula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  aulaId: string;
}

export interface DatosTutor {
  nombre: string;
  parentesco: string | null;
  telefono: string;
  correo: string | null;
}

export const etiquetaAula = (a: Pick<Aula, 'grado' | 'seccion' | 'especialidad'>) =>
  `${a.grado} ${a.seccion}${a.especialidad ? `, ${a.especialidad}` : ''}`;
