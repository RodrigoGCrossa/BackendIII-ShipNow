import { once } from 'node:events';
import { expect } from 'chai';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildLogger } from '../src/config/logger.js';

describe('Rotación real de Winston', () => {
  it('rota por tamaño y conserva un número acotado de archivos de errores', async () => {
    await mkdir('.cache', { recursive: true });
    const directory = await mkdtemp(path.resolve('.cache/rotation-'));
    const logger = await buildLogger({ nodeEnv:'test', logLevel:'debug', logDir:directory, logMaxBytes:1024, logMaxFiles:3 });
    try {
      await Promise.all(logger.transports.map(transport=>once(transport,'open')));
      const errors=logger.transports.find(transport=>transport.level==='error');
      for (let index=0; index<7; index++) {
        const rotated=once(errors,'open');
        logger.error(`rotation-${index}-${'x'.repeat(1500)}`);
        await rotated;
      }
      await new Promise(resolve=>{logger.once('finish',resolve);logger.end();});
      let files=[];
      for(let attempt=0;attempt<20;attempt++) {
        files=(await readdir(directory)).filter(file=>/^error\d*\.log$/.test(file));
        if(files.length>1) break;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      expect(files.length).to.be.greaterThan(1).and.at.most(3);
      let checked=0;
      for (const file of files) {
        const lines=(await readFile(path.join(directory,file),'utf8')).split('\n').filter(Boolean);
        for(const line of lines) { expect(JSON.parse(line).level).to.equal('error'); checked++; }
      }
      expect(checked).to.be.greaterThan(0);
    } finally {
      if(!logger.writableEnded) logger.end();
      await rm(directory,{recursive:true,force:true});
    }
  });
});
