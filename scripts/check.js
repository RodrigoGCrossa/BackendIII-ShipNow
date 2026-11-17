import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function check(dir) {for(const entry of await readdir(dir,{withFileTypes:true})) {const file=`${dir}/${entry.name}`;if(entry.isDirectory()) await check(file);else if(file.endsWith('.js')) {const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status) throw new Error(result.stderr);}}}
await check('src');console.info('Sintaxis de src verificada');
