// Reads values on stdin so credentials never appear in command arguments or logs.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
if(process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for configuration JSON on stdin (input is hidden).');
let input='';for await (const chunk of process.stdin) { input+=chunk; if(/[\r\n]/.test(input)) break; }
const { values, deploy }=JSON.parse(input);
let existing='';try { existing=await readFile('.env.local','utf8'); } catch {}
for (const [key,value] of Object.entries(values)) {
  if (!/^[A-Z_]+$/.test(key)) throw new Error('Invalid environment key');
  existing=existing.split(/\r?\n/).filter(line=>!line.startsWith(`${key}=`)).join('\n').replace(/\n*$/,'');
  existing+=`\n${key}=${JSON.stringify(value)}\n`;
}
await writeFile('.env.local',existing);
console.log('Local mentoring environment configured.');
if (deploy) {
  const cli=process.env.APPDATA+'/npm/node_modules/vercel/dist/index.js';
  for(const [key,value] of Object.entries(values)) {
    const result=spawnSync(process.execPath,[cli,'env','add',key,'production','--force'],{input:value,encoding:'utf8',windowsHide:true});
    if(result.status!==0){ console.error(`Failed to configure ${key}`);process.exit(1); }
    console.log(`Configured ${key} on Vercel production.`);
  }
}
