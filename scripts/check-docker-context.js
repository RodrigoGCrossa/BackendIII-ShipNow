import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const identifier = randomUUID();
const marker = `docker-context-probe-${identifier}`;
const image = `shipnow-context-probe:${identifier}`;
const probes = [
  `.env.${marker}`,
  `src/.env.${marker}`,
  `logs/${marker}.txt`,
  `uploads/${marker}.txt`,
  `coverage/${marker}.txt`,
  `.cache/${marker}.txt`,
  `node_modules/${marker}.txt`,
  `src/${marker}.tmp`,
];
const created = [];

try {
  for (const file of probes) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'Archivo señuelo sin credenciales.\n', { flag: 'wx' });
    created.push(file);
  }

  const checks = `
    const fs = require('node:fs');
    const assert = require('node:assert/strict');
    for (const file of ${JSON.stringify([...probes, '.git', '.github'])}) {
      assert.equal(fs.existsSync(file), false, 'No debe entrar al contexto: ' + file);
    }
    for (const file of ['src/app.js', 'src/server.js', 'scripts/healthcheck.js', 'package-lock.json']) {
      assert.equal(fs.existsSync(file), true, 'Falta un archivo necesario: ' + file);
    }
    console.info('Contexto Docker: variables locales y generados excluidos; runtime disponible');
  `;
  const dockerfile = [
    'FROM node:24-bookworm-slim',
    'WORKDIR /context',
    'COPY . .',
    `RUN ${JSON.stringify(['node', '-e', checks])}`,
  ].join('\n');
  execFileSync('docker', ['build', '--progress=plain', '-t', image, '-f', '-', '.'], {
    input: `${dockerfile}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  assert.equal(created.length, probes.length);
  console.info('Exclusiones de .dockerignore verificadas mediante construcción real');
} finally {
  for (const file of created) await unlink(file);
  // Solo elimina la imagen temporal creada por esta ejecución.
  try { execFileSync('docker', ['image', 'rm', image], { stdio: 'ignore' }); } catch {}
}
