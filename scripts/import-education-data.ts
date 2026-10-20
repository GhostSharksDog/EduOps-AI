import {config as loadEnv} from 'dotenv';
import {readFile,mkdir,writeFile,rename,open,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import path from 'node:path';
import {parse} from 'csv-parse';
import type {DatasetDTO,RecordKind,ImportResultVO} from '../src/modules/education/contracts';
import {runCompanyCommand} from './company-context';
import {requireCompanyContext} from '../src/platform/company/context';

const args=process.argv.slice(2);
const option=(name:string,fallback:string)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(name+'缺少参数');return value;};
const cell=(value:unknown)=>{const text=value==null?'':String(value);return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
interface SourceFile {kind:RecordKind;file:string;sha256:string;bytes:number;modifiedAt:number;fileRows:number;expectedRows:number;headers:string[];}
interface CompletedChunk {rowOffset:number;rows:number;batchId:string;newRows:number;duplicates:number;}
interface FileProgress {source:SourceFile;completed:CompletedChunk[];}
interface Checkpoint {
    version:1;organizationId:string;datasetId:string;key:string;directory:string;chunk:number;activityLimit:number;
    status:'running'|'completed'|'failed';startedAt:string;updatedAt:string;owner:ImportOwner;files:FileProgress[];error?:string;
}
interface ImportOwner {pid:number;host:string;runId:string;datasetId?:string;startedAt:string;}
function processIsRunning(owner:ImportOwner){
    if(owner.host!==hostname())throw new Error('旧导入锁来自其他计算机，无法确认该进程已终止；请在原计算机完成退出后处理');
    if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw new Error('旧导入锁缺少有效进程编号，不能自动恢复');
    try{process.kill(owner.pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw new Error('无法确认原导入进程已终止，拒绝恢复');}
}
async function readJson<T>(filename:string):Promise<T|null>{try{return JSON.parse(await readFile(filename,'utf8')) as T;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
async function atomicJson(filename:string,value:unknown){const temporary=filename+'.'+process.pid+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,filename);}
async function scanSource(directory:string,entry:{kind:RecordKind;file:string},limit:number):Promise<SourceFile>{
    const filename=path.join(directory,entry.file),before=await stat(filename),digest=createHash('sha256');
    let fileRows=0,headers:string[]=[];
    const source=createReadStream(filename);source.on('data',data=>digest.update(data));
    const parser=source.pipe(parse({columns:(columns:string[])=>{headers=columns;if(new Set(columns).size!==columns.length)throw new Error('重复列名');return columns;},bom:true,skip_empty_lines:true,relax_column_count:false,max_record_size:65536}));
    source.on('error',error=>parser.destroy(error));
    try{for await(const _row of parser)fileRows++;}catch{source.destroy();parser.destroy();throw new Error(entry.file+'CSV扫描失败，请检查编码、列名和列数');}
    const after=await stat(filename);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error(entry.file+'扫描期间文件发生变化，请停止编辑后重试');
    if(!headers.length)throw new Error(entry.file+'缺少CSV表头');
    return{...entry,sha256:digest.digest('hex'),bytes:before.size,modifiedAt:before.mtimeMs,fileRows,expectedRows:entry.kind==='oulad_activity'&&limit?Math.min(fileRows,limit):fileRows,headers};
}
function validateCheckpoint(checkpoint:Checkpoint,org:string,key:string,directory:string,chunk:number,limit:number,sources:SourceFile[]){
    if(checkpoint.version!==1||checkpoint.organizationId!==org||checkpoint.key!==key||checkpoint.directory!==directory)throw new Error('检查点不属于本次机构、数据集或目录，请选择独立检查点目录');
    if(checkpoint.chunk!==chunk||checkpoint.activityLimit!==limit)throw new Error('分块大小或活动采样配置与原检查点不同，请保留原配置，或使用新的 --manifest-directory；来源行号查重仍会避免重复写入');
    if(checkpoint.files.length!==sources.length)throw new Error('检查点文件集合不一致，请使用新数据版本');
    for(const source of sources){
        const prior=checkpoint.files.find(file=>file.source.kind===source.kind&&file.source.file===source.file);
        if(!prior||prior.source.sha256!==source.sha256||prior.source.fileRows!==source.fileRows||prior.source.expectedRows!==source.expectedRows)throw new Error(source.file+'全文件指纹或行数发生变化，禁止继续原数据版本，请另建数据版本');
        let offset=0;
        for(const completed of prior.completed){if(completed.rowOffset!==offset||completed.rows<0||completed.rows>chunk||!completed.batchId)throw new Error('检查点分块进度损坏，拒绝跳过记录');offset+=completed.rows;}
        if(offset>source.expectedRows)throw new Error('检查点进度超出原文件范围');
    }
}

async function main(){
    const started=performance.now();let sampledPeakRss=process.memoryUsage().rss;
    loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
    const mode=option('--mode','simulation'),limit=Number(option('--activity-limit','0')),chunk=Number(option('--chunk','5000'));
    if(!['simulation','oulad','finance'].includes(mode)||!Number.isInteger(limit)||limit<0||!Number.isInteger(chunk)||chunk<1||chunk>10000)throw new Error('mode须为simulation/oulad/finance，chunk须为1—10000，activity-limit为非负整数');
    const recover=args.includes('--recover-stopped'),directory=path.resolve(option('--directory',mode==='simulation'?'datasets/generated/training-sim-20261009-v3':mode==='finance'?'datasets/raw/angli-finance':'datasets/raw/oulad'));
    const org=requireCompanyContext().company.organizationId;
    if(!/^[0-9a-f-]{36}$/i.test(org))throw new Error('SYSTEM_USER_ID须为有效机构UUID');
    let input:DatasetDTO,files:{kind:RecordKind;file:string}[],declaredRows:Record<string,number>|undefined;
    if(mode==='simulation'){
        const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
        const {key,name,origin,license,schemaVersion,dataCutoff,description}=manifest;
        declaredRows=Object.fromEntries(manifest.files.map((file:{kind:string;rows:number})=>[file.kind,file.rows]));
        input={key,name,origin,license,schemaVersion,dataCutoff,description,expectedRows:declaredRows};
        const order:RecordKind[]=['campus','course','student','class','enrollment','lead','contract','trial','lesson','attendance','hours','renewal','referral','complaint','refund'];
        files=order.map(kind=>({kind,file:kind+'.csv'}));
    }else if(mode==='finance'){
        const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
        input=manifest.dataset;files=[{kind:'finance_annual',file:'annual.csv'}];declaredRows={finance_annual:3};
    }else{
        input={key:limit?'oulad-v1-sample-'+limit:'oulad-v1',name:limit?'OULAD公开学习数据（活动前'+limit+'行）':'OULAD公开学习数据（完整导入）',origin:'public',license:'CC BY 4.0',schemaVersion:'1',sourceUrl:'https://archive.ics.uci.edu/dataset/349/open+university+learning+analytics+dataset',dataCutoff:'2015-12-20T00:00:00.000Z',description:'2013—2014课程批次；日期按原始相对天数保存。截止时间记数据发布日，不是实际签到截止时间。'+(limit?'学习活动仅导入原文件前'+limit+'行，其余六表完整；不可推断全体学习活动。':'完整七表。')};
        files=[{kind:'oulad_course',file:'courses.csv'},{kind:'oulad_student',file:'studentInfo.csv'},{kind:'oulad_assessment',file:'assessments.csv'},{kind:'oulad_resource',file:'vle.csv'},{kind:'oulad_registration',file:'studentRegistration.csv'},{kind:'oulad_submission',file:'studentAssessment.csv'},{kind:'oulad_activity',file:'studentVle.csv'}];
    }
    const manifestDirectory=path.resolve(option('--manifest-directory','datasets/manifests'));
    await mkdir(manifestDirectory,{recursive:true});
    const basename='import-'+input.key+'-'+org,checkpointFile=path.join(manifestDirectory,basename+'.checkpoint.json'),lockFile=path.join(manifestDirectory,basename+'.lock.json');
    const owner:ImportOwner={pid:process.pid,host:hostname(),runId:randomUUID(),startedAt:new Date().toISOString()};
    const previousLock=await readJson<ImportOwner>(lockFile);
    if(previousLock){
        if(processIsRunning(previousLock))throw new Error('此数据集的导入进程仍在运行，请等待结束，不启动第二个导入进程');
        if(!recover)throw new Error('发现已终止进程的残留导入锁。确认原进程已退出后，添加 --recover-stopped 显式恢复');
        await unlink(lockFile);
    }
    const handle=await open(lockFile,'wx');await handle.writeFile(JSON.stringify(owner));await handle.close();
    let checkpoint:Checkpoint|null=null;
    const {educationData}=await import('../src/modules/education/server');
    const {db}=await import('../src/platform/database');
    try{
        const sources:SourceFile[]=[];
        for(const file of files){const source=await scanSource(directory,file,limit);sources.push(source);sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss);if(declaredRows&&declaredRows[file.kind]!==source.fileRows)throw new Error(file.file+'实际行数与模拟数据清单不一致，请核对原文件');console.log(file.file+'：预期 '+source.expectedRows.toLocaleString('en-US')+' 行，SHA256已核验');}
        // 数据集声明原文件规模；采样目标仅保存在检查点，不能冒充完整导入。
        input.expectedRows=Object.fromEntries(sources.map(source=>[source.kind,source.fileRows]));
        const previous=await readJson<Checkpoint>(checkpointFile);
        if(previous)validateCheckpoint(previous,org,input.key,directory,chunk,limit,sources);
        const dataset=await educationData.createDataset(org,input);console.log('数据集：'+dataset.name);
        if(previous&&previous.datasetId!==dataset.id)throw new Error('检查点绑定的数据库数据集不同，拒绝复用；请使用独立检查点目录');
        owner.datasetId=dataset.id;await atomicJson(lockFile,owner);
        const batches=(await educationData.inspect(org,dataset.id)).batches;
        const running=batches.filter(batch=>['validating','running'].includes(batch.status));
        if(running.length){
            if(!recover)throw new Error('发现未完成运行任务，请确认原进程已退出后添加 --recover-stopped');
            for(const batch of running){
                if(!batch.importProcess)throw new Error('运行批次缺少可验证的原进程信息，不能自动恢复；请人工核查原任务');
                if(processIsRunning({...batch.importProcess,startedAt:batch.createdAt}))throw new Error('原分块进程仍在运行，拒绝恢复');
            }
            await educationData.recoverStoppedImports(org,dataset.id,running.map(batch=>batch.id),Object.fromEntries(running.map(batch=>[batch.id,batch.importProcess!.runId])));
            console.log('已确认原进程终止，'+running.length+' 个未完成分块标记为等待重试；未标记为成功');
        }
        checkpoint=previous??{version:1,organizationId:org,datasetId:dataset.id,key:input.key,directory,chunk,activityLimit:limit,status:'running',startedAt:owner.startedAt,updatedAt:owner.startedAt,owner,files:sources.map(source=>({source,completed:[]}))};
        const completedById=new Map(batches.filter(batch=>batch.status==='completed').map(batch=>[batch.id,batch]));
        for(const file of checkpoint.files)for(const completed of file.completed){const batch=completedById.get(completed.batchId);if(!batch||batch.inputRows!==completed.rows||batch.kind!==file.source.kind)throw new Error('检查点声明完成的分块与数据库不一致，拒绝跳过；请核查数据库或用独立检查点目录重新查重');}
        checkpoint.owner=owner;checkpoint.status='running';checkpoint.error=undefined;checkpoint.updatedAt=new Date().toISOString();await atomicJson(checkpointFile,checkpoint);
        const session=await educationData.createImportSession(org,dataset.id,sources.map(source=>({kind:source.kind,filename:source.file,sha256:source.sha256})));
        const currentRunTotals=new Map<RecordKind,{newRows:number;duplicates:number}>();
        for(const progress of checkpoint.files){
            const source=progress.source,resumeOffset=progress.completed.reduce((sum,item)=>sum+item.rows,0);
            const currentTotals={newRows:0,duplicates:resumeOffset};currentRunTotals.set(source.kind,currentTotals);
            if(resumeOffset===source.expectedRows&&(source.expectedRows>0||progress.completed.length)){console.log(source.file+'：复用已完成 '+resumeOffset.toLocaleString('en-US')+' 行');continue;}
            const current=await stat(path.join(directory,source.file));
            const scanned=sources.find(file=>file.kind===source.kind)!;
            if(current.size!==scanned.bytes||current.mtimeMs!==scanned.modifiedAt)throw new Error(source.file+'在扫描后发生变化，停止导入');
            let offset=resumeOffset,seen=0,buffer:Record<string,string>[]=[],lastLogged=Date.now();
            const flush=async(forceEmpty=false)=>{
                if(!buffer.length&&!forceEmpty)return;
                const csv=source.headers.map(cell).join(',')+'\n'+buffer.map(row=>source.headers.map(header=>cell(row[header])).join(',')).join('\n')+(buffer.length?'\n':'');
                const mapping={__sourceFileSHA256:source.sha256,__sourceFileRows:String(source.fileRows),__importRunId:owner.runId,__importPID:String(owner.pid),__importHost:owner.host};
                const job:ImportResultVO=await educationData.importCsv(org,{datasetId:dataset.id,kind:source.kind,filename:source.file,csv,mapping,rowOffset:offset},session);
                if(job.status!=='completed')throw new Error(source.file+'：'+(job.error??'分块导入失败')+'；错误行数 '+job.rejectedRows+'，请查看导入质量报告');
                currentTotals.newRows+=job.reused?0:job.acceptedRows;currentTotals.duplicates+=job.reused?job.inputRows:job.duplicateRows;
                sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss);
                progress.completed.push({rowOffset:offset,rows:buffer.length,batchId:job.id,newRows:job.reused?0:job.acceptedRows,duplicates:job.reused?job.inputRows:job.duplicateRows});
                offset+=buffer.length;buffer=[];checkpoint!.updatedAt=new Date().toISOString();await atomicJson(checkpointFile,checkpoint);
                if(Date.now()-lastLogged>=10000||offset===source.expectedRows){console.log(source.file+'：'+offset.toLocaleString('en-US')+' / '+source.expectedRows.toLocaleString('en-US')+' 行（'+(source.expectedRows?Math.round(offset/source.expectedRows*100):100)+'%），内存 '+Math.round(process.memoryUsage().rss/1024/1024)+' MB');lastLogged=Date.now();}
            };
            const stream=createReadStream(path.join(directory,source.file)),parser=stream.pipe(parse({columns:true,bom:true,skip_empty_lines:true,max_record_size:65536}));
            stream.on('error',error=>parser.destroy(error));
            try{
                for await(const row of parser){
                    if(seen>=source.expectedRows)break;
                    seen++;if(seen<=resumeOffset)continue;
                    buffer.push(row);if(buffer.length>=chunk)await flush();
                }
                await flush();if(source.expectedRows===0)await flush(true);
            }finally{parser.destroy();stream.destroy();}
            const after=await stat(path.join(directory,source.file));if(after.size!==scanned.bytes||after.mtimeMs!==scanned.modifiedAt)throw new Error(source.file+'在导入过程中发生变化，停止导入；请恢复原文件后重试');
            if(offset!==source.expectedRows)throw new Error(source.file+'导入过程中行数发生变化，停止任务');
            console.log(source.file+'：完成 '+offset.toLocaleString('en-US')+' 行');
        }
        checkpoint.status='completed';checkpoint.updatedAt=new Date().toISOString();await atomicJson(checkpointFile,checkpoint);
        const summary=checkpoint.files.map(file=>({kind:file.source.kind,rows:file.completed.reduce((sum,item)=>sum+item.rows,0),...currentRunTotals.get(file.source.kind),fileHash:file.source.sha256,fileRows:file.source.fileRows,expectedRows:file.source.expectedRows}));
        await atomicJson(path.join(manifestDirectory,'import-'+input.key+'.json'),{datasetId:dataset.id,key:input.key,organizationId:org,importedAt:checkpoint.updatedAt,chunk,activityLimit:limit,durationSeconds:Math.round((performance.now()-started)/1000),sampledPeakRssMB:Math.round(sampledPeakRss/1024/1024),files:summary});
        console.log('导入完成。全文件指纹、预期规模及分块进度已保存，重复执行跳过已完成分块，不重复写入。');
    }catch(error){
        if(checkpoint){checkpoint.status='failed';checkpoint.updatedAt=new Date().toISOString();checkpoint.error=error instanceof Error?error.message:'导入失败';await atomicJson(checkpointFile,checkpoint);}
        throw error;
    }finally{
        await db.end();const current=await readJson<ImportOwner>(lockFile);if(current?.runId===owner.runId)await unlink(lockFile);
    }
}
Promise.resolve().then(()=>runCompanyCommand(main)).catch(error=>{console.error(error instanceof Error?error.message:'导入失败');process.exitCode=1;});
