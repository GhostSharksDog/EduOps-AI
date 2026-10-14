import {mkdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {generateSimulation} from '../src/modules/education/domain/simulation';
import {generateSimulationV2} from '../src/modules/education/domain/simulation-v2';
import {generateSimulationV3} from '../src/modules/education/domain/simulation-v3';
import {fields} from '../src/modules/education/domain/fields';
import type {RecordKind} from '../src/modules/education/contracts';

async function main(){
const args=process.argv.slice(2);
const option=(name:string,fallback:string)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const seed=Number(option('--seed','20261009')),students=Number(option('--students','1000'));
if(!Number.isInteger(seed)||!Number.isInteger(students)||students<2||students>10000)throw new Error('seed须为整数，students须在2—10000之间');
const version=option('--version','3');
if(!['1','2','3'].includes(version))throw new Error('version须为1、2或3');
const output=path.resolve(option('--output','datasets/generated/training-sim-'+seed+(version==='1'?'':'-v'+version)));
if(await stat(output).then(()=>true,()=>false))throw new Error('输出目录已存在，请指定新目录；不会覆盖原始或已生成数据');
const simulation=version==='3'?generateSimulationV3({seed,students}):version==='2'?generateSimulationV2({seed,students}):generateSimulation({seed,students});
await mkdir(output,{recursive:true});
const files=[];
const cell=(value:unknown)=>{const text=value===null||value===undefined?'':String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
for(const [name,rows]of Object.entries(simulation.data)){
    const kind=name as RecordKind,headers=fields[kind].filter(f=>version!=='1'||!['leadId','renewalEligible','endReason'].includes(f.name)||!['contract','enrollment'].includes(kind)).map(f=>f.name);
    const csv=headers.join(',')+'\n'+rows!.map(row=>headers.map(key=>cell(row[key])).join(',')).join('\n')+'\n';
    await writeFile(path.join(output,kind+'.csv'),csv,'utf8');
    files.push({kind,file:kind+'.csv',rows:rows!.length,sha256:createHash('sha256').update(csv).digest('hex')});
}
const manifest={...simulation.dataset,seed,students,campuses:3,courses:6,period:{start:'2026-04-01',end:'2026-09-30'},scenarios:simulation.scenarios,files};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await mkdir('datasets/manifests',{recursive:true});
await writeFile('datasets/manifests/'+simulation.dataset.key+'.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,students,files},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
