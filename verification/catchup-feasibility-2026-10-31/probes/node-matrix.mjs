import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const versions=JSON.parse(await readFile('evidence/versions.json','utf8'));
const run=path.resolve('generated/node-matrix-'+Date.now());await mkdir(run,{recursive:true});
// Save the already-tested host results before candidate runs update evidence aliases.
await mkdir(run+'/host');
for(const name of ['parser','islands','runtime-2026-10-30'])await copyFile('evidence/'+name+'.json',run+'/host/'+name+'.json');
const results=[];
for(const candidate of [versions.node.eligibleLts,versions.node.eligibleCurrent]) {
  const version=candidate.version;assert.match(version,/^v\d+\.\d+\.\d+$/);
  const folder=`node-${version}-darwin-arm64`;const filename=folder+'.tar.gz';
  const dir=run+'/'+version;await mkdir(dir);
  const base='https://nodejs.org/dist/'+version+'/';
  const shas=await fetch(base+'SHASUMS256.txt',{signal:AbortSignal.timeout(30000)});assert.ok(shas.ok);
  const shatext=await shas.text();await writeFile(dir+'/SHASUMS256.txt',shatext);
  const line=shatext.split('\n').find(line=>line.endsWith('  '+filename));assert.ok(line);
  const response=await fetch(base+filename,{signal:AbortSignal.timeout(90000)});assert.ok(response.ok);
  const archive=Buffer.from(await response.arrayBuffer());assert.ok(archive.length<100*1024*1024);
  const sha256=createHash('sha256').update(archive).digest('hex');assert.equal(sha256,line.slice(0,64));
  const archivePath=dir+'/'+filename;await writeFile(archivePath,archive);
  const listing=spawnSync('tar',['-tzf',archivePath],{encoding:'utf8',maxBuffer:20*1024*1024});assert.equal(listing.status,0);
  const entries=listing.stdout.trim().split('\n');assert.ok(entries.every(x=>x.startsWith(folder+'/')&&!x.split('/').includes('..')));
  const extracted=spawnSync('tar',['-xzf',archivePath,'-C',dir],{encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr);
  const binary=dir+'/'+folder+'/bin/node';
  const tasks=[['parser',['--test','probes/parser.test.mjs']],['islands',['probes/islands.mjs']],['runtime-2026-10-30',['probes/runtime.mjs','2026-10-30']]];
  const record={version,releaseDate:candidate.date,lts:candidate.lts,url:base+filename,sha256,archiveBytes:archive.length,binary,results:[]};
  for(const [name,args] of tasks) {
    const started=Date.now();
    const result=spawnSync(binary,args,{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8',WRANGLER_SEND_METRICS:'false'}});
    await writeFile(dir+'/'+name+'.log',result.stdout+result.stderr);
    record.results.push({name,exitCode:result.status,elapsedMs:Date.now()-started,error:result.error?.message});
    if(result.status===0)await copyFile('evidence/'+name+'.json',dir+'/'+name+'.json');
    console.log(version,name,result.status===0?'PASS':'FAIL');
  }
  results.push(record);
}
await writeFile('evidence/node-matrix.json',JSON.stringify({checkedAt:new Date().toISOString(),host:process.version,run,results},null,2));
if(results.some(x=>x.results.some(y=>y.exitCode!==0)))process.exitCode=1;
