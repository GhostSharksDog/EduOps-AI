import {afterEach,describe,expect,it,vi} from 'vitest';
import {CloudModelClient,createEmbeddingClient,parseChatResponse,parseEmbeddingResponse} from '@/platform/ai/client';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('模型供应商响应校验',()=>{
 it('最终说明显式请求JSON，不再附带可写工具，普通工具轮保持兼容',async()=>{
  const fetchMock=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"summary":"完成"}'}}]})));
  vi.stubGlobal('fetch',fetchMock);const client=new CloudModelClient({baseUrl:'https://api.deepseek.com',apiKey:'test-only',model:'test'});
  await client.chat([{role:'user',content:'json说明'}],[],{json:true});const payload=JSON.parse(fetchMock.mock.calls[0][1].body);expect(payload.response_format).toEqual({type:'json_object'});expect(payload).not.toHaveProperty('tools');
  await client.chat([{role:'user',content:'普通问题'}]);expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('response_format');
 });
 it('根据index还原批量顺序，而不依赖供应商数组顺序',()=>{
  expect(parseEmbeddingResponse({data:[{index:1,embedding:[0,1]},{index:0,embedding:[1,0]}]},2)).toEqual([[1,0],[0,1]]);
 });
 it.each([
  {data:[{index:0,embedding:[1,0]},{index:0,embedding:[1,0]}]},
  {data:[{index:0,embedding:[1,0]},{index:1,embedding:[1]}]},
  {data:[{index:0,embedding:[1,NaN]},{index:1,embedding:[1,0]}]},
  {data:[{index:0,embedding:[0,0]},{index:1,embedding:[1,0]}]},
  {data:[{index:0,embedding:[1,0]}]}
 ])('拒绝无效向量响应',raw=>expect(()=>parseEmbeddingResponse(raw,2)).toThrow());
 it('接受Function Calling并拒绝重复调用编号',()=>{
  const call={id:'c1',type:'function',function:{name:'query_metrics',arguments:'{}'}};
  expect(parseChatResponse({choices:[{message:{content:null,tool_calls:[call]}}]}).message.tool_calls).toEqual([call]);
  expect(()=>parseChatResponse({choices:[{message:{content:null,tool_calls:[call,call]}}]})).toThrow();
 });
 it('空回答不是成功',()=>expect(()=>parseChatResponse({choices:[{message:{content:null}}]})).toThrow());
 it('配置指纹不包含密钥，更换模型会更换向量空间',()=>{
  vi.stubEnv('EMBEDDING_API_BASE_URL','http://localhost:29999/v1');vi.stubEnv('EMBEDDING_MODEL','test-embedding');vi.stubEnv('EMBEDDING_API_KEY','test-key-one');
  const first=createEmbeddingClient().configuration();vi.stubEnv('EMBEDDING_API_KEY','test-key-two');
  expect(createEmbeddingClient().configuration().fingerprint).toBe(first.fingerprint);
  expect(JSON.stringify(first)).not.toContain('test-key');vi.stubEnv('EMBEDDING_MODEL','other');
  expect(createEmbeddingClient().configuration().fingerprint).not.toBe(first.fingerprint);
 });
 it('HTTP失败不回显供应商错误或密钥',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private-provider-details',{status:401})));
  const client=new CloudModelClient({baseUrl:'https://invalid.example/v1',apiKey:'private-key',model:'test'});
  await expect(client.embed(['口径'])).rejects.toThrow('HTTP 401');
  await expect(client.embed(['口径'])).rejects.toMatchObject({diagnostics:{httpStatus:401}});
 });
 it('网络诊断只保留允许的错误码，不包含私密cause信息',async()=>{
  const cause=Object.assign(new Error('private-url-and-key'),{code:'ENOTFOUND'});
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('private-details',{cause})));
  const client=new CloudModelClient({baseUrl:'https://invalid.example/v1',apiKey:'private-key',model:'test'});
  const error=await client.embed(['connection-test']).catch(e=>e);
  expect(error).toMatchObject({code:'MODEL_NETWORK',diagnostics:{networkReason:'ENOTFOUND'}});
  expect(JSON.stringify(error)).not.toContain('private');
 });
 it.each([
  ['https://api.deepseek.com',true],
  ['https://api.deepseek.com/v1',true],
  ['https://other.example/v1',false],
  ['https://api.deepseek.com.other.example/v1',false]
 ])('仅官方DeepSeek端点显式关闭思考模式：%s',async(baseUrl,isDeepSeek)=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}]})));
  vi.stubGlobal('fetch',fetchMock);
  const tools=[{type:'function' as const,function:{name:'echo',description:'test',parameters:{type:'object'}}}];
  await new CloudModelClient({baseUrl,apiKey:'test-only',model:'test'}).chat([{role:'user',content:'test'}],tools);
  const payload=JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(payload.tools).toEqual(tools);expect(payload.tool_choice).toBe('auto');
  if(isDeepSeek)expect(payload.thinking).toEqual({type:'disabled'});else expect(payload).not.toHaveProperty('thinking');
 });
 it('向量按每批10条调用，供应商乱序时仍还原所有输入顺序',async()=>{
  const fetchMock=vi.fn().mockImplementation(async(_url,options)=>{
   const {input}=JSON.parse(options.body);
   return new Response(JSON.stringify({data:input.map((text:string,index:number)=>({index,embedding:[Number(text)+1,1]})).reverse()}));
  });
  vi.stubGlobal('fetch',fetchMock);
  const input=Array.from({length:23},(_,i)=>String(i));
  const result=await new CloudModelClient({baseUrl:'https://embedding.example/v1',apiKey:'test-only',model:'test'}).embed(input);
  expect(fetchMock.mock.calls.map(call=>JSON.parse(call[1].body).input.length)).toEqual([10,10,3]);
  expect(result).toEqual(input.map(text=>[Number(text)+1,1]));
 });
 it('跨批次向量维数变化时拒绝整个索引结果',async()=>{
  const fetchMock=vi.fn().mockImplementation(async(_url,options)=>{
   const {input}=JSON.parse(options.body),dimensions=fetchMock.mock.calls.length===1?2:3;
   return new Response(JSON.stringify({data:input.map((_:string,index:number)=>({index,embedding:Array.from({length:dimensions},()=>1)}))}));
  });
  vi.stubGlobal('fetch',fetchMock);
  await expect(new CloudModelClient({baseUrl:'https://embedding.example/v1',apiKey:'test-only',model:'test'}).embed(Array.from({length:11},()=> 'test'))).rejects.toMatchObject({code:'INVALID_EMBEDDING'});
 });
 it('后续向量批次失败时不重试也不返回部分结果',async()=>{
  const fetchMock=vi.fn().mockImplementation(async(_url,options)=>{
   if(fetchMock.mock.calls.length===2)return new Response('',{status:503});
   const {input}=JSON.parse(options.body);
   return new Response(JSON.stringify({data:input.map((_:string,index:number)=>({index,embedding:[1,0]}))}));
  });
  vi.stubGlobal('fetch',fetchMock);
  await expect(new CloudModelClient({baseUrl:'https://embedding.example/v1',apiKey:'test-only',model:'test'}).embed(Array.from({length:23},()=> 'test'))).rejects.toMatchObject({code:'MODEL_HTTP'});
  expect(fetchMock).toHaveBeenCalledTimes(2);
 });
 it('透传取消信号并区分超时',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,options)=>Promise.reject(options.signal.reason)));
  const signal=AbortSignal.abort();const client=new CloudModelClient({baseUrl:'http://localhost:29999/v1',apiKey:'test-only',model:'test'});
  await expect(client.chat([{role:'user',content:'test'}],[],{signal})).rejects.toMatchObject({code:'MODEL_TIMEOUT'});
 });
});
