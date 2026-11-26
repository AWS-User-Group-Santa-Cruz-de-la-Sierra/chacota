import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEADER = '# Generado por pnpm local:init. No lo edites: se vuelve a escribir cada vez.';

/** Contenido de un archivo .env con las claves ordenadas. */
export function envFileContent(values: Record<string, string>): string {
  const lines = Object.keys(values)
    .sort()
    .map((key) => {
      if (/[\r\n]/.test(values[key]!)) throw new Error(`El valor de ${key} tiene saltos de línea`);
      return `${key}=${values[key]}`;
    });
  return `${HEADER}\n${lines.join('\n')}\n`;
}

/** Escribe los ids generados donde los leen `next dev` y `next start`. */
export function writeEnvFiles(values: Record<string, string>): void {
  const content = envFileContent(values);
  for (const name of ['.env.development.local', '.env.production.local']) {
    writeFileSync(fileURLToPath(new URL(`../../../../apps/web/${name}`, import.meta.url)), content);
  }
}
