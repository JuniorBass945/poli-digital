export const cx = (...partes: Array<string | false | null | undefined>) => partes.filter(Boolean).join(' ');
