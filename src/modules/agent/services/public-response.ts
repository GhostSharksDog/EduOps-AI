import {createHash} from 'node:crypto';
// 只在HTTP边界脱敏。仓储和业务服务持有完整审计记录，不用展示对象回写仓储。
export function publicAgentResponse(value:unknown):unknown {
 if(Array.isArray(value))return value.map(publicAgentResponse);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>{
  if(key==='runtime'&&item&&typeof item==='object'){
   const r=item as Record<string,unknown>,input=r.input as {rounds?:unknown[]}|undefined;
   const recovery=r.recovery as {status?:unknown;httpStatus?:unknown;round?:unknown;retryAt?:unknown}|undefined;
   const safeRecovery=recovery&&['waiting','recovered','failed'].includes(String(recovery.status))&&typeof recovery.httpStatus==='number'&&[502,503,504].includes(recovery.httpStatus)&&typeof recovery.round==='number'&&Number.isInteger(recovery.round)&&recovery.round>=0&&recovery.round<6&&typeof recovery.retryAt==='string'&&Number.isFinite(Date.parse(recovery.retryAt))?{status:recovery.status,httpStatus:recovery.httpStatus,round:recovery.round,retryAt:recovery.retryAt}:undefined;
   const routing=r.taskRouting as {intent?:unknown;groups?:unknown;switches?:unknown}|undefined;
   const safeRouting=routing&&Array.isArray(routing.groups)?{intent:['guidance','analysis','tag','workflow','knowledge','compound','clarification'].includes(String(routing.intent))?routing.intent:'clarification',groups:routing.groups.filter(g=>['guidance','analysis','tag','workflow','knowledge'].includes(String(g))),switches:typeof routing.switches==='number'?Math.max(0,Math.min(2,routing.switches)):0}:undefined;
   return [key,{engineVersion:r.engineVersion,model:r.model,promptVersion:r.promptVersion,recordedAt:r.recordedAt,...(safeRecovery?{recovery:safeRecovery}:{}),
    ...(safeRouting?{taskRouting:safeRouting}:{}),
    ...(input?{inputSummary:{recorded:!!input.rounds?.length,calls:input.rounds?.length??0,sha256:createHash('sha256').update(JSON.stringify(input)).digest('hex')}}:r.inputSummary?{inputSummary:r.inputSummary}:{})}];
  }
  return [key,publicAgentResponse(item)];
 }));
}
