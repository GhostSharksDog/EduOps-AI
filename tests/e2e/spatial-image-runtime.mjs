// 检查实际独立部署的图片原生依赖及HTTP优化结果；不读取配置、账号、数据库或模型。
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';

const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3303';
const address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&['3303','3100'].includes(address.port)&&address.pathname==='/'&&!address.search&&!address.hash,'仅允许本地预览服务');
const dist=process.env.NEXT_DIST_DIR??'.next';
assert.ok(['.next','.next-ux','.next-validation'].includes(dist),'仅允许项目内已知独立构建目录');
const root=process.cwd(),standalone=resolve(root,dist,'standalone'),dir=resolve(root,'tests/artifacts/spatial-product-qa');
await mkdir(dir,{recursive:true});
const checks=[],images=[];
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
try{
 const requireStandalone=createRequire(resolve(standalone,'server.js'));
 const sharpPath=requireStandalone.resolve('sharp');
 assert.ok(sharpPath.startsWith(standalone+sep),'sharp必须从standalone产物加载，不可回退工作区node_modules');
 const sharp=requireStandalone('sharp');
 const probe=await sharp({create:{width:8,height:8,channels:4,background:{r:34,g:76,b:145,alpha:.5}}}).webp().toBuffer();
 const probeMetadata=await sharp(probe).metadata();
 assert.equal(probeMetadata.format,'webp');assert.equal(probeMetadata.width,8);assert.equal(probeMetadata.hasAlpha,true);
 pass('独立构建内sharp原生依赖实际编码与解码正常');
 for(const name of ['login','agent','workbench']){
  const sourcePath=resolve(root,'public/visuals/'+name+'-spatial.png');
  const source=await readFile(sourcePath),sourceMetadata=await sharp(source).metadata();
  assert.ok(sourceMetadata.width>640,'源图应大于640像素，才能检测实际缩放');
  const url=new URL('/_next/image',base);url.searchParams.set('url','/visuals/'+name+'-spatial.png');url.searchParams.set('w','640');url.searchParams.set('q','75');
  const response=await fetch(url,{headers:{Accept:'image/webp'},signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,'图片优化请求应成功：'+name);
  assert.ok(response.headers.get('content-type')?.startsWith('image/webp'),'必须返回优化后的WebP，不能200原样返回PNG：'+name);
  const output=Buffer.from(await response.arrayBuffer()),metadata=await sharp(output).metadata();
  assert.equal(metadata.format,'webp','实际二进制格式应是WebP：'+name);
  assert.equal(metadata.width,640,'实际输出宽度必须缩到640：'+name);
  assert.ok(metadata.height<sourceMetadata.height,'输出应按比例缩小：'+name);
  assert.ok(Math.abs(metadata.height-640*sourceMetadata.height/sourceMetadata.width)<=1,'保持图片原始纵横比：'+name);
  assert.ok(output.length<source.length,'优化体积必须小于原始PNG：'+name);
  assert.notEqual(sha(output),sha(source),'不能只是转发原文件：'+name);
  let alpha=null;
  if(name==='agent'){
   assert.equal(sourceMetadata.hasAlpha,true,'Agent原素材有透明背景');
   assert.equal(metadata.hasAlpha,true,'优化后仍需保留透明通道');
   const channel=await sharp(output).extractChannel('alpha').stats();
   alpha={min:channel.channels[0].min,max:channel.channels[0].max,mean:channel.channels[0].mean};
   assert.equal(alpha.min,0,'背景应保留完全透明像素');
   assert.ok(alpha.max>0&&alpha.mean<254,'不能变为全透明空图或全不透明底图');
  }
  images.push({name,path:'/visuals/'+name+'-spatial.png',request:{width:640,quality:75,accept:'image/webp'},status:response.status,contentType:response.headers.get('content-type'),cache:response.headers.get('x-nextjs-cache'),source:{width:sourceMetadata.width,height:sourceMetadata.height,bytes:source.length,format:sourceMetadata.format,hasAlpha:sourceMetadata.hasAlpha??false,sha256:sha(source)},output:{width:metadata.width,height:metadata.height,bytes:output.length,format:metadata.format,hasAlpha:metadata.hasAlpha??false,sha256:sha(output)},reductionPercent:Number((100*(1-output.length/source.length)).toFixed(2)),...(alpha?{alpha}:{})});
  pass(name+'真实HTTP缩放、WebP编码、体积压缩'+(name==='agent'?'及透明背景':''));
 }
 await writeFile(resolve(dir,'image-runtime.json'),JSON.stringify({kind:'actual-standalone-image-runtime',testedAt:new Date().toISOString(),base,dist,standaloneSharp:relative(root,sharpPath).replaceAll('\\','/'),sharpVersion:sharp.versions.sharp,libvipsVersion:sharp.versions.vips,realDatabaseUsed:false,realLoginUsed:false,cloudModelCalls:0,businessWrites:0,checks,images},null,2));
 console.log(JSON.stringify({passed:checks.length,optimizedImages:images.length,databaseUsed:false,modelCalls:0,businessWrites:0}));
}catch(error){
 await writeFile(resolve(dir,'image-runtime-failure-'+new Date().toISOString().replaceAll(':','-')+'.json'),JSON.stringify({kind:'actual-standalone-image-runtime',testedAt:new Date().toISOString(),base,dist,error:String(error),checks,images,realDatabaseUsed:false,cloudModelCalls:0,businessWrites:0},null,2));
 throw error;
}
