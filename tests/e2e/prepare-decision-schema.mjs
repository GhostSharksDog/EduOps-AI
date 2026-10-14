// 本轮授权的正常环境追加区块；只创建新对象，不运行整个初始化文件或修改业务记录。
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {config} from 'dotenv';
import pg from 'pg';
const env={...process.env};config({path:['.env.local','.env'],processEnv:env,quiet:true});
const url=new URL(env.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='15434'||url.pathname!=='/metadata_dev'||!process.argv.includes('--normal-append'))throw Error('只允许显式指定本项目正常环境追加区块');
const db=new pg.Client({connectionString:url.toString()});await db.connect();
const dir=process.env.LOCAL_QA_ARTIFACT_DIR??'tests/artifacts/decision-qa';await mkdir(dir,{recursive:true});
async function counts(){const result={};for(const name of ['local_user','education_dataset','education_record','education_import_batch','knowledge_source_version','agent_execution','education_risk_proposal','education_segment_snapshot','operational_report']){const exists=await db.query('SELECT to_regclass($1) AS name',[name]);if(exists.rows[0].name)result[name]=Number((await db.query('SELECT count(*) AS n FROM '+name)).rows[0].n);}return result;}
try{const before=await counts();assert.ok(before.local_user>0&&before.education_dataset>0,'已有正常环境须保留账号和数据');const sql=await readFile('database/init.sql','utf8'),start=sql.indexOf('-- BEGIN DECISION_APPEND_ONLY'),end=sql.indexOf('-- END DECISION_APPEND_ONLY');assert.ok(start>0&&end>start);const block=sql.slice(start,end);assert.ok(!/\b(DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(block));await db.query('BEGIN');try{await db.query(block);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}const after=await counts();assert.deepEqual(after,before);await writeFile(dir+'/schema-append.json',JSON.stringify({testedAt:new Date().toISOString(),before,after,preservedExistingRows:true,added:['education_dataset.analysisType','decision_task','decision_feedback','analysis_evaluation']},null,2));console.log('仅追加新字段与表；已有账号及业务记录计数保持完整。');}finally{await db.end();}
