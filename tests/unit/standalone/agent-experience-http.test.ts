import {beforeEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {canAccess} from '@/modules/identity/contracts/local';
import {publicAgentResponse} from '@/modules/agent/services/public-response';
const actor={userId:'verified-user',organizationId:'verified-company',role:'viewer'};
const {retry,update}=vi.hoisted(()=>({retry:vi.fn(),update:vi.fn()}));
vi.mock('@/modules/identity/server',()=>({withCompanyRoute:(handler:unknown)=>handler}));
vi.mock('@/modules/agent/server',()=>({agentService:{retryInterpretation:retry,updateTaskState:update},readAgentBody:(request:NextRequest)=>request.json(),agentApi:async(_request:NextRequest,operation:(actor:unknown)=>unknown)=>operation(actor)}));
import {POST} from '@/app/api/agent/runs/[id]/retry-interpretation/route';
import {PATCH} from '@/app/api/agent/sessions/[id]/task-state/route';
beforeEach(()=>{vi.clearAllMocks();retry.mockResolvedValue({status:'ready',data:{id:'new-run'},message:''});update.mockResolvedValue({revision:2,goal:null});});
describe('Agent体验接口的身份绑定与公开字段',()=>{
 it('恢复只将服务端actor、路径来源和body交给业务服务，不接受身份头覆盖',async()=>{
  const id=randomUUID(),key=randomUUID(),response=await POST(new NextRequest('http://localhost/api/agent/runs/'+id+'/retry-interpretation',{method:'POST',headers:{'Content-Type':'application/json','x-tenant-id':'forged'},body:JSON.stringify({requestKey:key})}),{params:Promise.resolve({id})});
  expect(response.status).toBe(200);expect(retry).toHaveBeenCalledWith({requestKey:key},actor,id);expect(response.headers.get('cache-control')).toBe('no-store');
 });
 it('任务修改绑定已验证身份，并按严格契约传递版本',async()=>{
  const id=randomUUID(),body={action:'update',expectedRevision:1,goal:'核对出勤',userConditions:['仅查看当前课程']};
  const response=await PATCH(new NextRequest('http://localhost/api/agent/sessions/'+id+'/task-state',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id})});
  expect(response.status).toBe(200);expect(update).toHaveBeenCalledWith(actor,id,body);
 });
 it('只读问答允许自身记忆与解释恢复，正式确认仍拒绝',()=>{
  const id=randomUUID();expect(canAccess('viewer','PATCH','/api/agent/sessions/'+id+'/task-state')).toBe(true);
  expect(canAccess('viewer','POST','/api/agent/runs/'+id+'/retry-interpretation')).toBe(true);
  for(const path of ['/api/agent/actions/confirm','/api/agent/proposals/confirm','/api/agent/sessions/'+id+'/task-state/extra'])expect(canAccess('viewer','POST',path)).toBe(false);
 });
 it('剥离内部模型输入、冻结依据及任务快照，仅返回安全工具路由概要',()=>{
  const result=publicAgentResponse({steps:[{runtime:{engineVersion:'business-agent-v3',model:'test',promptVersion:'task-v3',taskRouting:{intent:'tag',groups:['tag','sql'],switches:100,reason:'internal'},freeze:{dataFingerprint:'private-freeze'},taskMemory:{goal:'internal-memory'},input:{tools:[{secret:'private-tool'}],rounds:[{messages:['private-prompt']}]}}}]});
  const text=JSON.stringify(result);for(const secret of ['private-freeze','internal-memory','private-tool','private-prompt','internal'])expect(text).not.toContain(secret);
  expect(result).toMatchObject({steps:[{runtime:{taskRouting:{intent:'tag',groups:['tag'],switches:2},inputSummary:{recorded:true,calls:1}}}]});
 });
});
