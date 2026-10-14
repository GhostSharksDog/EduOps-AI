// 显式追加本轮两个可空字段与索引，禁止重建或清空已有库。
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {config} from 'dotenv';
import pg from 'pg';
const normal=process.argv.includes('--normal-append'),test=process.argv.includes('--test-append');
if(normal===test)throw Error('必须明确选择正常环境或专用测试环境追加区块');
const environment={...process.env};if(normal)config({path:['.env.local','.env'],processEnv:environment,quiet:true});
const url=new URL(environment.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||(normal?(url.port!=='15434'||url.pathname!=='/metadata_dev'):(url.port!=='25432'||url.pathname!=='/education_cleanup_test')))throw Error('只允许项目正常本地库或专用_test库的明确追加');
const client=new pg.Client({connectionString:url.toString()});await client.connect();
const directory=process.env.TEST_ARTIFACT_DIR??'tests/artifacts/research-qa';await mkdir(directory,{recursive:true});
const tables=['local_user','education_dataset','education_import_batch','education_record','education_segment_snapshot','knowledge_source_version','agent_execution','operational_report','decision_task','decision_feedback','analysis_evaluation'];
async function counts(){const result={};for(const table of tables)result[table]=Number((await client.query('SELECT count(*) AS n FROM '+table)).rows[0].n);return result;}
try{
 const before=await counts(),sql=await readFile('database/init.sql','utf8'),start=sql.indexOf('-- BEGIN RESEARCH_APPEND_ONLY'),end=sql.indexOf('-- END RESEARCH_APPEND_ONLY');assert.ok(start>0&&end>start);
 const block=sql.slice(start,end);assert.ok(!/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(block));await client.query('BEGIN');
 try{await client.query(block);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}
 const after=await counts();assert.deepEqual(after,before);
 await writeFile(directory+'/'+(normal?'normal':'test')+'-schema-append.json',JSON.stringify({checkedAt:new Date().toISOString(),before,after,unchangedRows:true,addedColumns:['decision_task.goals','decision_feedback.quantitativeReview']},null,2));
 console.log('本轮必要字段和索引已追加，原业务记录计数保持一致。');
}finally{await client.end();}
