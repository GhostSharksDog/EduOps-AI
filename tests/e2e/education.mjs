import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3302';
if(!/^http:\/\/(127\.0\.0\.1|localhost):330[23]$/.test(base))throw new Error('此脚本仅在本机3302/3303专用测试服务运行');
const login=async(username)=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.TEST_PASSWORD})});assert.equal(r.status,200);return r.json();};
const admin=await login('phase2_admin'),viewer=await login('phase2_viewer');
const headers={Authorization:'Bearer '+admin.token,'Content-Type':'application/json'};
assert.equal((await fetch(base+'/api/education/datasets')).status,401);
const list=await(await fetch(base+'/api/education/datasets',{headers})).json(),sim=list.data.find(d=>d.key==='training-sim-20261009'),publicData=list.data.find(d=>d.origin==='public');assert.ok(sim&&publicData);
const scope={startDate:'2026-04-01',endDate:'2026-09-30',campusIds:[],courseIds:[],channelIds:[]};
async function query(datasetId,h=headers){const r=await fetch(base+'/api/analytics/query',{method:'POST',headers:h,body:JSON.stringify({datasetId,scope})});assert.equal(r.status,200);return(await r.json()).data;}
const analysis=await query(sim.id);assert.equal(analysis.metrics[0].value,null);assert.equal(analysis.metrics[0].unknownCount,1);assert.equal(analysis.metrics[1].value,76.56);assert.equal(analysis.metrics[2].value,76.28);
const forged=await query(sim.id,{...headers,'x-tenant-id':'00000000-0000-4000-8000-000000000999'});assert.equal(forged.scope.organizationId,analysis.scope.organizationId);
assert.ok((await query(publicData.id)).metrics.every(m=>m.status==='not_applicable'&&m.value===null));
assert.equal((await query(sim.id,{...headers,Authorization:'Bearer '+viewer.token})).metrics[1].value,76.56);
const csv=await readFile('datasets/generated/training-sim-20261009/campus.csv','utf8');
const importBody={datasetId:sim.id,kind:'campus',filename:'api-repeat.csv',csv,mapping:{}};
const repeat=await fetch(base+'/api/data/import-jobs',{method:'POST',headers,body:JSON.stringify(importBody)});assert.equal(repeat.status,200);const job=(await repeat.json()).data;assert.equal(job.acceptedRows,0);assert.equal(job.duplicateRows,3);
const second=(await(await fetch(base+'/api/data/import-jobs',{method:'POST',headers,body:JSON.stringify(importBody)})).json()).data;assert.equal(second.id,job.id);
assert.equal((await fetch(base+'/api/data/import-jobs',{method:'POST',headers:{...headers,Authorization:'Bearer '+viewer.token},body:JSON.stringify(importBody)})).status,403);
assert.equal((await fetch(base+'/api/analytics/query',{method:'POST',headers,body:JSON.stringify({datasetId:sim.id,scope:{...scope,organizationId:'forged'}})})).status,400);
const qa='tests/artifacts/phase2-qa';await mkdir(qa,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},admin);
 for(const [url,name]of [['/dashboard/analytics','analytics'],['/dashboard/data/import','import'],['/dashboard','overview']]){
  await page.goto(base+url,{waitUntil:'networkidle'});await page.getByRole('heading',{name:name==='analytics'?'运营分析':name==='import'?'教育业务数据导入':'运营总览',exact:true}).waitFor({timeout:60000});
  if(name!=='import')await page.getByText('76.56',{exact:true}).waitFor({timeout:60000});
  await page.screenshot({path:qa+'/'+name+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 await writeFile(qa+'/verification.json',JSON.stringify({testedAt:new Date().toISOString(),unauthenticated:401,viewerImport:403,viewerQuery:200,forgedTenantIgnored:true,strictScope:true,duplicateImport:true,publicSeparation:true,browserPages:['analytics','import','overview'],pageErrors:errors},null,2)+'\n');
 console.log('API权限、重复导入、来源隔离及3个浏览器页面验收通过');
}finally{await browser.close();}
