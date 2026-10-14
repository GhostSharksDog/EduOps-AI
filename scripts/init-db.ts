import {config as loadEnv} from 'dotenv';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
async function main(){
 if(!process.env.DATABASE_URL)throw new Error('请显式配置 DATABASE_URL');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 const client=await pool.connect();
 try{
  const existing=await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 1`);
  if(existing.rowCount)throw new Error('数据库已有数据表，初始化已拒绝；本命令仅用于空库');
  await client.query(await readFile(new URL('../database/init.sql',import.meta.url),'utf8'));
  console.log('空库初始化完成；现存业务库无需执行本命令。');
 }finally{client.release();await pool.end();}
}
main().catch(error=>{console.error(error?.code?'初始化失败，请检查数据库权限及 pgvector 扩展':error.message);process.exitCode=1;});
