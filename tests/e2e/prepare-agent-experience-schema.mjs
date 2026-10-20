// 已有环境只追加一个可空任务状态字段，不执行整份初始化SQL。
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {config} from 'dotenv';
import pg from 'pg';
const normal=process.argv.includes('--normal-append'),test=process.argv.includes('--test-append');
assert.notEqual(normal,test,'须明确选择正常或专用测试环境');
const env={...process.env};if(normal)config({path:['.env.local','.env'],processEnv:env,quiet:true});
const url=new URL(env.COMPANY_PG_ADMIN_URL&&normal?env.COMPANY_PG_ADMIN_URL:env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'只允许本项目本地追加');
assert.equal(url.port,normal?'15434':'25432');
if(normal&&url.pathname==='/postgres')url.pathname='/metadata_dev';
assert.equal(url.pathname,normal?'/metadata_dev':'/education_cleanup_test');
const sql=await readFile('database/init.sql','utf8'),start=sql.indexOf('-- BEGIN AGENT_TASK_STATE_APPEND_ONLY'),end=sql.indexOf('-- END AGENT_TASK_STATE_APPEND_ONLY');
assert.ok(start>0&&end>start);
const block=sql.slice(start,end);assert.match(block,/ALTER TABLE agent_session ADD COLUMN IF NOT EXISTS "taskState" JSONB;/);
assert.ok(!/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|CREATE)\b/i.test(block));
const client=new pg.Client({connectionString:url.toString()}),dir='tests/artifacts/agent-experience-qa';await mkdir(dir,{recursive:true});
try{
 await client.connect();assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name,normal?'metadata_dev':'education_cleanup_test');
 const before=(await client.query(`SELECT (SELECT count(*)::int FROM agent_session) AS sessions,(SELECT count(*)::int FROM agent_execution) AS runs,(SELECT count(*)::int FROM local_user) AS accounts,(SELECT count(*)::int FROM education_dataset) AS datasets`)).rows[0];
 await client.query('BEGIN');
 try{await client.query("SET LOCAL lock_timeout='5s'");await client.query(block);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}
 const after=(await client.query(`SELECT (SELECT count(*)::int FROM agent_session) AS sessions,(SELECT count(*)::int FROM agent_execution) AS runs,(SELECT count(*)::int FROM local_user) AS accounts,(SELECT count(*)::int FROM education_dataset) AS datasets`)).rows[0];
 assert.deepEqual(after,before);
 await writeFile(dir+'/'+(normal?'normal':'test')+'-schema.json',JSON.stringify({testedAt:new Date().toISOString(),addedColumn:'agent_session.taskState',nullable:true,rowsUnchanged:true,before,after},null,2));
 console.log('仅任务状态可空字段已就绪，原会话、执行、账号和数据集数量保持一致。');
}catch(error){console.error('追加未完成，未重新初始化数据库。请检查本地部署权限或已有结构。');process.exitCode=1;}finally{await client.end();}
