export type Rol = 'admin' | 'direccion' | 'coordinacion' | 'docente' | 'orientacion' | 'tutor';

export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: 'Administración',
  direccion: 'Dirección',
  coordinacion: 'Coordinación académica',
  docente: 'Docente',
  orientacion: 'Orientación y psicología',
  tutor: 'Tutor o padre',
};
