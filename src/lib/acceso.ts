// Accesos con nombre de usuario (sin correo real).
// Supabase Auth exige un correo, así que cada usuario tiene uno interno que NUNCA se usa para enviar nada:
// usuario@poli.test (".test" es un dominio reservado: nadie puede registrarlo ni recibir mensajes ahí).
// DEBE ser el mismo valor que DOMINIO_INTERNO en supabase/functions/accesos/index.ts (una prueba lo comprueba).
export const DOMINIO_INTERNO = 'poli.test';

export const USUARIO_FORMATO = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Convierte lo que se escribe en el login en el correo con el que entra a Supabase.
 *  Si trae @ se respeta (usuarios antiguos con correo); si no, es un nombre de usuario. */
export function credencialAEmail(texto: string): string {
  const t = texto.trim();
  if (t.includes('@')) return t;
  return `${t.toLowerCase()}@${DOMINIO_INTERNO}`;
}

export function validarUsuario(usuario: string): string | null {
  const u = usuario.trim().toLowerCase();
  if (!u) return 'Escribe el usuario.';
  if (!USUARIO_FORMATO.test(u)) return 'El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo.';
  return null;
}

export const CLAVE_MINIMA = 8;

/** Clave temporal escrita a mano por la administración. Devuelve el problema o null. La función del servidor aplica la misma regla. */
export function validarClaveTemporal(clave: string, usuario?: string): string | null {
  if (clave.length < CLAVE_MINIMA) return `La clave temporal debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (clave.length > 72) return 'La clave temporal no puede pasar de 72 caracteres.';
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return 'La clave temporal debe combinar letras y números.';
  if (usuario && clave.toLowerCase() === usuario.trim().toLowerCase()) return 'La clave temporal no puede ser igual al usuario.';
  return null;
}

/** Reglas de la clave nueva. Devuelve el problema o null. */
export function validarClaveNueva(clave: string, repetida: string, temporal?: string): string | null {
  if (clave.length < CLAVE_MINIMA) return `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) return 'La clave debe combinar letras y números.';
  if (temporal && clave === temporal) return 'La clave nueva no puede ser igual a la temporal.';
  if (clave !== repetida) return 'Las dos claves no coinciden.';
  return null;
}
