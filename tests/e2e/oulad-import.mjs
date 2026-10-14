// 流式导入真实存储验收：仅使用显式本机*_test库及临时公开数据夹具。
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {hostname} from 'node:os';
import path from 'node:path';
import pg from 'pg';

const root=process.cwd(),output=path.resolve(process.env.IMPORT_QA_OUTPUT??'tests/artifacts/oulad-import-'+Date.now());
if(!output.startsWith(root+path.sep))throw Error('导入验收输出必须位于项目内');
const connection='postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test';
const databaseName=new URL(connection).pathname.slice(1);assert.match(databaseName,/_test$/);
const pool=new pg.Pool({connectionString:connection});
const env={...process.env,DATABASE_URL:connection,CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:'education_cleanup_test',CLICKHOUSE_CLUSTER:'',CLICKHOUSE_REPLICATED_DB:'false',JWT_SECRET:'import_test_only_secret_more_than_32_characters',CHAT_API_BASE_URL:'http://127.0.0.1:3391/v1',CHAT_API_KEY:'fixture-only',CHAT_MODEL:'fixture',EMBEDDING_API_BASE_URL:'http://127.0.0.1:3391/v1',EMBEDDING_API_KEY:'fixture-only',EMBEDDING_MODEL:'fixture'};
const results=[];let child;
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function json(filename){try{return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function fixture(directory,activities){
    await mkdir(directory,{recursive:true});
    const files={
        'courses.csv':'code_module,code_presentation,module_presentation_length\nAAA,2013J,200\nBBB,2014J,220\n',
        'studentInfo.csv':'code_module,code_presentation,id_student,gender,region,highest_education,imd_band,age_band,num_of_prev_attempts,studied_credits,disability,final_result\nAAA,2013J,1,F,测试,测试,,0-35,0,60,N,Pass\nAAA,2013J,2,M,测试,测试,,0-35,0,60,N,Withdrawn\nBBB,2014J,1,F,测试,测试,,0-35,0,60,N,Pass\nBBB,2014J,3,F,测试,测试,,0-35,0,60,N,Fail\n',
        'assessments.csv':'code_module,code_presentation,id_assessment,assessment_type,date,weight\nAAA,2013J,10,TMA,20,50\nBBB,2014J,20,Exam,,100\n',
        'vle.csv':'id_site,code_module,code_presentation,activity_type,week_from,week_to\n100,AAA,2013J,forumng,,\n200,BBB,2014J,oucontent,,\n',
        'studentRegistration.csv':'code_module,code_presentation,id_student,date_registration,date_unregistration\nAAA,2013J,1,-20,\nAAA,2013J,2,-10,15\nBBB,2014J,1,0,\nBBB,2014J,3,,\n',
        'studentAssessment.csv':'id_assessment,id_student,date_submitted,is_banked,score\n10,1,10,0,80\n10,2,11,1,\n20,1,20,0,95\n20,3,-5,0,\n',
        'studentVle.csv':'code_module,code_presentation,id_student,id_site,date,sum_click\n'+Array.from({length:activities},(_,index)=>'AAA,2013J,'+(index%2+1)+',100,'+(index%12-2)+','+(index%4)).join('\n')+'\n',
    };
    for(const [name,content]of Object.entries(files))await writeFile(path.join(directory,name),content);
    return files['studentVle.csv'];
}
function start(org,directory,manifests,extra=[]){
    const args=['--conditions=react-server','--import','tsx','scripts/import-education-data.ts','--mode','oulad','--directory',directory,'--manifest-directory',manifests,...extra];
    const processHandle=spawn(process.execPath,args,{cwd:root,env:{...env,SYSTEM_USER_ID:org},stdio:['ignore','pipe','pipe'],windowsHide:true});child=processHandle;
    let stdout='',stderr='';processHandle.stdout.on('data',value=>stdout+=value);processHandle.stderr.on('data',value=>stderr+=value);
    const finished=new Promise((resolve,reject)=>{processHandle.once('error',reject);processHandle.once('exit',(code,signal)=>resolve({code,signal,stdout,stderr}));});
    return{process:processHandle,finished};
}
async function run(org,directory,manifests,extra=[],success=true){
    const result=await start(org,directory,manifests,extra).finished;
    if(success)assert.equal(result.code,0,result.stderr||result.stdout);else assert.notEqual(result.code,0);
    return result;
}
async function counts(org){
    const result=await pool.query('SELECT id FROM education_dataset WHERE "organizationId"=$1::uuid AND key=$2',[org,'oulad-v1']);assert.equal(result.rows.length,1);
    const id=result.rows[0].id;
    const batches=await pool.query('SELECT id FROM education_import_batch WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND status=$3',[org,id,'completed']);
    const meta=await pool.query('SELECT count(*)::int AS value FROM education_record WHERE "organizationId"=$1::uuid AND "datasetId"=$2::uuid AND "batchId"=ANY($3::uuid[])',[org,id,batches.rows.map(row=>row.id)]);
    const form=new FormData();form.set('query','SELECT count() AS value FROM education_events_v1 FINAL WHERE organization_id={org:UUID} AND dataset_id={dataset:UUID} AND batch_id IN {batches:Array(UUID)} FORMAT JSONEachRow');form.set('param_org',org);form.set('param_dataset',id);form.set('param_batches','['+batches.rows.map(row=>"'"+row.id+"'").join(',')+']');
    const response=await fetch('http://127.0.0.1:28123/?database=education_cleanup_test',{method:'POST',headers:{'X-ClickHouse-User':'default','X-ClickHouse-Key':'test_password'},body:form});assert.equal(response.status,200,await response.clone().text());
    const events=JSON.parse((await response.text()).trim());return{metadata:Number(meta.rows[0].value),events:Number(events.value),datasetId:id};
}
try{
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'education_cleanup_test');await mkdir(output,{recursive:true});
    const org=randomUUID(),directory=path.join(output,'small'),manifests=path.join(output,'small-checkpoint'),original=await fixture(directory,7);
    await run(org,directory,manifests,['--chunk','2']);let actual=await counts(org);assert.deepEqual({metadata:actual.metadata,events:actual.events},{metadata:14,events:11});results.push({case:'真实PG与CH POST分块导入',passed:true,...actual});
    await run(org,directory,manifests,['--chunk','2']);let manifest=await json(path.join(manifests,'import-oulad-v1.json'));assert.equal(manifest.files.reduce((sum,file)=>sum+file.newRows,0),0);assert.deepEqual(await counts(org),actual);results.push({case:'重复导入新增0行',passed:true});
    let rejected=await run(org,directory,manifests,['--chunk','3'],false);assert.match(rejected.stderr,/分块大小/);results.push({case:'旧检查点拒绝改chunk',passed:true});
    await run(org,directory,path.join(output,'new-chunk-checkpoint'),['--chunk','3']);assert.deepEqual(await counts(org),actual);results.push({case:'新检查点改chunk仍按来源行号去重',passed:true});
    await writeFile(path.join(directory,'studentVle.csv'),original.replace('AAA,2013J,1,100,-2,0','AAA,2013J,1,100,-2,99'));
    rejected=await run(org,directory,manifests,['--chunk','2'],false);assert.match(rejected.stderr,/全文件指纹/);
    rejected=await run(org,directory,path.join(output,'changed-file-checkpoint'),['--chunk','2'],false);assert.match(rejected.stderr,/原文件指纹/);assert.deepEqual(await counts(org),actual);results.push({case:'原文件变化在原及新检查点均拒绝',passed:true});
    await writeFile(path.join(directory,'studentVle.csv'),original);
    const stoppedOrg=randomUUID(),large=path.join(output,'stopped'),stoppedManifests=path.join(output,'stopped-checkpoint');await fixture(large,100001);
    const started=start(stoppedOrg,large,stoppedManifests),checkpointFile=path.join(stoppedManifests,'import-oulad-v1-'+stoppedOrg+'.checkpoint.json');
    let interrupted=false;
    for(let attempt=0;attempt<1200;attempt++){
        const checkpoint=await json(checkpointFile),activity=checkpoint?.files.find(file=>file.source.kind==='oulad_activity'),imported=activity?.completed.reduce((sum,chunk)=>sum+chunk.rows,0)??0;
        if(imported>0&&imported<100001){started.process.kill('SIGKILL');interrupted=true;break;}
        if(started.process.exitCode!==null)break;await delay(50);
    }
    assert.equal(interrupted,true,'未捕获部分完成状态');await started.finished;
    rejected=await run(stoppedOrg,large,stoppedManifests,[],false);assert.match(rejected.stderr,/残留导入锁/);
    await run(stoppedOrg,large,stoppedManifests,['--recover-stopped']);actual=await counts(stoppedOrg);assert.deepEqual({metadata:actual.metadata,events:actual.events},{metadata:14,events:100005});results.push({case:'真实中断后的显式恢复与完成块复用',passed:true,...actual});
    manifest=await json(path.join(stoppedManifests,'import-oulad-v1.json'));results.push({case:'保存来源指纹、行数、耗时、采样峰值内存',passed:true,durationSeconds:manifest.durationSeconds,sampledPeakRssMB:manifest.sampledPeakRssMB});
    const liveManifests=path.join(output,'live-owner-checkpoint');await mkdir(liveManifests,{recursive:true});await writeFile(path.join(liveManifests,'import-oulad-v1-'+org+'.lock.json'),JSON.stringify({pid:process.pid,host:hostname(),runId:randomUUID(),startedAt:new Date().toISOString()}));
    rejected=await run(org,directory,liveManifests,['--recover-stopped'],false);assert.match(rejected.stderr,/进程仍在运行/);results.push({case:'活跃PID拒绝恢复',passed:true});
    await writeFile(path.join(output,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),testDatabase:databaseName,results},null,2));console.log(JSON.stringify({passed:results.length,output,results},null,2));
}finally{if(child&&child.exitCode===null)child.kill('SIGKILL');await pool.end();}
