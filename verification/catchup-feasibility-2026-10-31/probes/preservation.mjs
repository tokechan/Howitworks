import { readFile, access, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const project=path.resolve('../..');
const before=JSON.parse(await readFile('baseline.json','utf8'));
const missing=[],changed=[];
for(const name of before.existingPaths){try{await access(path.join(project,name));}catch{missing.push(name);}}
for(const [name,expected] of Object.entries(before.sourceHashes)){
 try {const actual=createHash('sha256').update(await readFile(path.join(project,name))).digest('hex');if(actual!==expected)changed.push(name);} catch {changed.push(name);}
}
const result={checkedAt:new Date().toISOString(),existingFiles:before.existingPaths.length,sourceHashes:Object.keys(before.sourceHashes).length,missing,changed};
await writeFile('evidence/preservation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(missing.length||changed.length)process.exitCode=1;
