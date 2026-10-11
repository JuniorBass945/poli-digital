// Declaraciones mínimas para que la prueba pueda leer el Excel de ejemplo sin instalar @types/node.
declare module 'node:fs' {
  export function readFileSync(ruta: string): { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
