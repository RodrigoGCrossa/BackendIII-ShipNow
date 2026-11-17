import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const allowedEnv=new Set(['.env.example','.env.test.example']);
for(const file of files) {
 if(/(^|\/)(node_modules|logs|uploads|coverage|seguimiento|consignas|\.cache|\.git)(\/|$)/.test(file)||/(^|\/)(AGENTS\.md|ENTREGAS\.md|.*\.pdf)$/.test(file)||/(^|\/)\.env/.test(file)&&!allowedEnv.has(file)) throw new Error(`Archivo privado o generado en Git: ${file}`);
 const content=await readFile(file,'utf8');
 if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|mongodb(?:\+srv)?:\/\/[^\s/:]+:[^\s@]+@/.test(content)) throw new Error(`Posible secreto en ${file}`);
}
for(const required of ['README.md','.env.example','package.json','package-lock.json','src/app.js','src/server.js','tests/setup.js','src/docs/openapi.json']) if(!files.includes(required)) throw new Error(`Falta ${required}`);
console.info(`Auditoría de ${files.length} archivos versionados: sin material privado ni patrones de credenciales detectados`);
