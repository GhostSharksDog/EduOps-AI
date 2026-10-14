import pg from 'pg';
import {readFile} from 'node:fs/promises';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw Error('仅允许本机专用education_cleanup_test');
const db=new pg.Client({connectionString:url.toString()}),sql=await readFile('database/init.sql','utf8');
await db.connect();
try{
 const {rows}=await db.query("SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname='public'");
 if(rows[0].n===0)await db.query(sql);
 else {const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('operational_alert','operational_report')")).rows;if(tables.length===0){const start=sql.indexOf('-- BEGIN OPERATIONS'),end=sql.indexOf('-- END OPERATIONS');if(start<0||end<start)throw Error('初始化区块缺失');await db.query('BEGIN;\n'+sql.slice(start,end)+'\nCOMMIT;');}else if(tables.length!==2)throw Error('测试库补表不完整，停止自动准备');}
 const expected=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?([a-z_]+)"?/g)].map(m=>m[1]);
 const present=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename);
 const missing=[...new Set(expected)].filter(t=>!present.includes(t));if(missing.length)throw Error('测试库缺少当前必要表：'+missing.join('、'));
 const response=await fetch('http://127.0.0.1:28123/',{method:'POST',headers:{Authorization:'Basic '+Buffer.from('default:test_password').toString('base64')},body:'CREATE DATABASE IF NOT EXISTS education_cleanup_test'});if(!response.ok)throw Error('专用ClickHouse测试库初始化失败');
 console.log('专用测试库必要表及ClickHouse已就绪；未访问业务库。');
}finally{await db.end();}
