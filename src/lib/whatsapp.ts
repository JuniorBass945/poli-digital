/** Número en formato internacional para wa.me: 10 dígitos de Dominicana llevan el 1 delante. */
export function telefonoWhatsapp(telefono: string | null | undefined): string | null {
  const d = (telefono ?? '').replace(/\D/g, '');
  if (d.length === 10) return `1${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/** Enlace de WhatsApp con el mensaje ya escrito, o null si el teléfono no sirve. */
export function enlaceWhatsapp(telefono: string | null | undefined, texto: string): string | null {
  const numero = telefonoWhatsapp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}
