import { expect } from 'chai';
import { readdir, readFile } from 'node:fs/promises';

describe('Límites de la arquitectura por capas', () => {
  it('mantiene la persistencia fuera de routes, controllers y services', async () => {
    for (const layer of ['routes', 'controllers', 'services']) {
      for (const file of await readdir(`src/${layer}`)) {
        if (!file.endsWith('.js')) continue;
        const source = await readFile(`src/${layer}/${file}`, 'utf8');
        const imports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
        expect(imports, `${layer}/${file} no debe importar Mongoose o modelos`)
          .not.to.satisfy(values => values.some(value => value === 'mongoose' || value.includes('/models/')));
        if (layer !== 'services') {
          expect(imports, `${layer}/${file} no debe acceder al Repository`)
            .not.to.satisfy(values => values.some(value => value.includes('/repositories/')));
        }
      }
    }
  });

  it('centraliza la lectura de las variables de entorno', async () => {
    async function inspect(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await inspect(filename);
        else if (filename.endsWith('.js') && filename !== 'src/config/env.config.js') {
          expect(await readFile(filename, 'utf8'), filename).not.to.include('process.env');
        }
      }
    }
    await inspect('src');
  });
});
