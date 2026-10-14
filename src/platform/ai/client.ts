import 'server-only';
import {createHash} from 'node:crypto';

export interface ModelEndpoint {baseUrl:string;apiKey:string;model:string;}
export interface ChatToolCall {id:string;type:'function';function:{name:string;arguments:string};}
export interface ChatToolDefinition {type:'function';function:{name:string;description:string;parameters:Record<string,unknown>};}
export type ChatMessage = {role:'system'|'user'|'assistant';content:string|null;tool_calls?:ChatToolCall[]} | {role:'tool';content:string;tool_call_id:string};
export interface ChatCompletionVO {message:{content:string|null;tool_calls?:ChatToolCall[]};usage?:{promptTokens?:number;completionTokens?:number};}
export interface ModelRequestOptions {signal?:AbortSignal;json?:boolean;}
export interface EmbeddingClient {
 configuration():{configured:boolean;model:string;fingerprint:string};
 embed(input:string[],options?:ModelRequestOptions):Promise<number[][]>;
}
export function modelConfiguration(){
 return {chatConfigured:!!(process.env.CHAT_API_BASE_URL&&process.env.CHAT_API_KEY&&process.env.CHAT_MODEL),embeddingConfigured:!!(process.env.EMBEDDING_API_BASE_URL&&process.env.EMBEDDING_API_KEY&&process.env.EMBEDDING_MODEL)};
}
export class ModelServiceError extends Error {
 constructor(message:string,public readonly code:string,public readonly diagnostics?:{httpStatus?:number;networkReason?:string}){super(message);this.name='ModelServiceError';}
}
function safeNetworkReason(error:unknown):string{
 const allowed=new Set(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ERR_INVALID_URL','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UND_ERR_CONNECT_TIMEOUT']);
 let current=error;
 for(let depth=0;depth<4&&current&&typeof current==='object';depth++){
  const item=current as {code?:unknown;cause?:unknown};
  if(typeof item.code==='string'&&allowed.has(item.code))return item.code;
  current=item.cause;
 }
 return 'UNKNOWN';
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function chatProviderOptions(baseUrl:string):Record<string,unknown>{
 try{
  // 官方DeepSeek默认开启思考；普通模式避免工具续轮要求回传reasoning_content。
  return new URL(baseUrl).hostname==='api.deepseek.com'?{thinking:{type:'disabled'}}:{};
 }catch{return {};}
}
export function parseEmbeddingResponse(raw:unknown,count:number):number[][] {
 if(!record(raw)||!Array.isArray(raw.data)||raw.data.length!==count)throw new ModelServiceError('向量模型返回数量不正确','INVALID_EMBEDDING');
 const ordered:Array<number[]|undefined>=new Array(count);let dimensions:number|undefined;
 for(const item of raw.data){
  if(!record(item)||!Number.isInteger(item.index)||Number(item.index)<0||Number(item.index)>=count||ordered[Number(item.index)]||!Array.isArray(item.embedding))throw new ModelServiceError('向量模型返回索引不正确','INVALID_EMBEDDING');
  const vector=item.embedding;
  if(!vector.length||vector.length>16000||!vector.every(v=>typeof v==='number'&&Number.isFinite(v))||!vector.some(v=>v!==0)||(dimensions!==undefined&&dimensions!==vector.length))throw new ModelServiceError('向量模型返回维数或数值不正确','INVALID_EMBEDDING');
  dimensions=vector.length;ordered[Number(item.index)]=vector;
 }
 if(ordered.some(v=>!v))throw new ModelServiceError('向量模型返回记录缺失','INVALID_EMBEDDING');
 return ordered as number[][];
}
export function parseChatResponse(raw:unknown):ChatCompletionVO {
 if(!record(raw)||!Array.isArray(raw.choices)||!raw.choices.length||!record(raw.choices[0])||!record(raw.choices[0].message))throw new ModelServiceError('对话模型返回格式不正确','INVALID_CHAT');
 const message=raw.choices[0].message;
 if(message.content!==null&&message.content!==undefined&&typeof message.content!=='string')throw new ModelServiceError('对话模型返回内容不正确','INVALID_CHAT');
 let calls:ChatToolCall[]|undefined;
 if(message.tool_calls!==undefined){
  if(!Array.isArray(message.tool_calls)||message.tool_calls.length>8)throw new ModelServiceError('对话模型返回工具调用不正确','INVALID_CHAT');
  const ids=new Set<string>();calls=message.tool_calls.map(call=>{
   if(!record(call)||typeof call.id!=='string'||!call.id||ids.has(call.id)||call.type!=='function'||!record(call.function)||typeof call.function.name!=='string'||!call.function.name||typeof call.function.arguments!=='string'||call.function.arguments.length>20000)throw new ModelServiceError('对话模型返回工具参数不正确','INVALID_CHAT');
   ids.add(call.id);return {id:call.id,type:'function',function:{name:call.function.name,arguments:call.function.arguments}};
  });
 }
 if(!message.content&&!calls?.length)throw new ModelServiceError('对话模型没有返回内容或工具调用','EMPTY_CHAT');
 const usage=record(raw.usage)?raw.usage:undefined;
 return {message:{content:(message.content as string|null)??null,...(calls?.length?{tool_calls:calls}:{})},...(usage?{usage:{promptTokens:typeof usage.prompt_tokens==='number'?usage.prompt_tokens:undefined,completionTokens:typeof usage.completion_tokens==='number'?usage.completion_tokens:undefined}}:{})};
}
// 错误不回显端点、请求正文、密钥或供应商响应。
export class CloudModelClient {
 constructor(private readonly endpoint:ModelEndpoint){}
 private async request(resource:string,payload:unknown,options:ModelRequestOptions={}){
  if(!this.endpoint.baseUrl||!this.endpoint.apiKey||!this.endpoint.model)throw new ModelServiceError('模型尚未配置','UNCONFIGURED');
  const timeout=AbortSignal.timeout(60000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  try{
   const response=await fetch(this.endpoint.baseUrl.replace(/\/+$/,'')+'/'+resource,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.endpoint.apiKey},body:JSON.stringify(payload),signal});
   if(!response.ok)throw new ModelServiceError('模型服务调用失败，HTTP '+response.status,'MODEL_HTTP',{httpStatus:response.status});
   try{return await response.json();}catch{throw new ModelServiceError('模型服务未返回有效JSON','INVALID_JSON');}
  }catch(error){
   if(error instanceof ModelServiceError)throw error;
   if(signal.aborted)throw new ModelServiceError('模型调用超时或已取消','MODEL_TIMEOUT');
   throw new ModelServiceError('无法连接模型服务，请检查配置后重试','MODEL_NETWORK',{networkReason:safeNetworkReason(error)});
  }
 }
 async chat(messages:ChatMessage[],tools:ChatToolDefinition[]=[],options?:ModelRequestOptions):Promise<ChatCompletionVO>{return parseChatResponse(await this.request('chat/completions',{model:this.endpoint.model,messages,...chatProviderOptions(this.endpoint.baseUrl),...(tools.length?{tools,tool_choice:'auto'}:{}),...(options?.json?{response_format:{type:'json_object'}}:{})},options));}
 async embed(input:string[],options?:ModelRequestOptions):Promise<number[][]>{
  if(!input.length||input.length>64||input.some(t=>typeof t!=='string'||!t.trim()))throw new ModelServiceError('向量输入为空或批次过大','INVALID_INPUT');
  // 百炼text-embedding-v4每次最多10条；分批仍保持调用方输入顺序。
  const vectors:number[][]=[];
  for(let offset=0;offset<input.length;offset+=10){
   const batch=input.slice(offset,offset+10);
   const result=parseEmbeddingResponse(await this.request('embeddings',{model:this.endpoint.model,input:batch},options),batch.length);
   if(vectors.length&&vectors[0].length!==result[0].length)throw new ModelServiceError('向量模型批次之间维数不一致','INVALID_EMBEDDING');
   vectors.push(...result);
  }
  return vectors;
 }
}
export function createEmbeddingClient():EmbeddingClient {
 const endpoint={baseUrl:process.env.EMBEDDING_API_BASE_URL??'',apiKey:process.env.EMBEDDING_API_KEY??'',model:process.env.EMBEDDING_MODEL??''};
 const client=new CloudModelClient(endpoint);
 return {configuration:()=>({configured:!!(endpoint.baseUrl&&endpoint.apiKey&&endpoint.model),model:endpoint.model,fingerprint:createHash('sha256').update(JSON.stringify({baseUrl:endpoint.baseUrl.replace(/\/+$/,''),model:endpoint.model})).digest('hex')}),embed:(input,options)=>client.embed(input,options)};
}
