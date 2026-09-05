// Node module hook: resolves the "@/..." alias for code run outside Next
// (worker, seed, migrations). Registered via scripts/register-alias.mjs.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function candidates(specifier) {
  const rel = specifier.slice(2); // strip "@/"
  const base = path.resolve(root, rel);
  if (path.extname(base)) return [base];
  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    for (const candidate of candidates(specifier)) {
      if (existsSync(candidate)) {
        return next(pathToFileURL(candidate).href, context);
      }
    }
  }
  return next(specifier, context);
}
