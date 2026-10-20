'use client';
import {useCallback,useEffect,useState} from 'react';
import {Alert,Button,Collapse,Flex,Select,Table,Tag,Typography} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import type {AgentRunCandidate,AgentTaskComparison,TaskRunComparison} from '@/modules/agent/contracts';

const unavailable='未记录';
function range(r:TaskRunComparison){const scope=r.context?.scope;if(!scope)return '冻结范围未记录';if('startDate' in scope)return `${scope.startDate} 至 ${scope.endDate} · 校区${scope.campusIds.length?' '+scope.campusIds.join('、'):'全部'} · 课程${scope.courseIds.length?' '+scope.courseIds.join('、'):'全部'} · 渠道${scope.channelIds.length?' '+scope.channelIds.join('、'):'全部'} · 截止 ${scope.dataCutoff??unavailable}`;if('years' in scope)return `年度：${scope.years.join('、')||'全部'}`;return `课程批次：${scope.courseKeys.join('、')||'全部'} · 相对日 ${scope.relativeDayStart??unavailable} 至 ${scope.relativeDayEnd??unavailable}`;}
function rows(result:AgentTaskComparison){return [
 {key:'version',label:'实际版本',old:result.old.engineLabel,new:result.new.engineLabel},
 {key:'model',label:'模型记录',old:result.old.model??unavailable,new:result.new.model??unavailable},
 {key:'inputs',label:'实际模型输入',old:result.old.inputsRecorded?'已记录':'缺失',new:result.new.inputsRecorded?'已记录':'缺失'},
 {key:'interactions',label:'截至该执行的用户轮次',old:result.old.interactions??unavailable,new:result.new.interactions??unavailable},
 {key:'calls',label:'模型请求次数',old:result.old.modelCalls??unavailable,new:result.new.modelCalls??unavailable},
 ...(['attempted','completed','argumentErrors','failed','pending'] as const).map((k,i)=>({key:k,label:['工具尝试','工具调用成功','参数校验错误','工具失败','工具未结束'][i],old:result.old.tools[k],new:result.new.tools[k]})),
 {key:'facts',label:'结构化事实核验',old:`${result.old.facts.verified}/${result.old.facts.total}`,new:`${result.new.facts.verified}/${result.new.facts.total}`},
 {key:'unknown',label:'未知／待观察事实',old:result.old.facts.unknown,new:result.new.facts.unknown},
 {key:'references',label:'未知证据引用',old:result.old.facts.invalidEvidenceIds.length,new:result.new.facts.invalidEvidenceIds.length},
 {key:'actions',label:'正式业务步骤完成',old:result.old.actions.total?`${result.old.actions.completed}/${result.old.actions.total}`:'不适用',new:result.new.actions.total?`${result.new.actions.completed}/${result.new.actions.total}`:'不适用'},
 {key:'completed',label:'正式计划完成',old:result.old.actions.formallyCompleted===null?'没有操作计划':result.old.actions.formallyCompleted?'已完成':'未全部完成',new:result.new.actions.formallyCompleted===null?'没有操作计划':result.new.actions.formallyCompleted?'已完成':'未全部完成'},
 {key:'manual',label:'人工任务完成与体验评价',old:'待评价',new:'待评价'},
 ];}
function csv(result:AgentTaskComparison){const data=[['项目','旧版所选执行','新版所选执行'],['执行编号',result.old.id,result.new.id],['问题',result.old.question,result.new.question],['数据集',result.old.context?.datasetId??unavailable,result.new.context?.datasetId??unavailable],['冻结范围',range(result.old),range(result.new)],['冻结数据版本',result.old.dataVersions.join('；'),result.new.dataVersions.join('；')],['知识版本',result.old.knowledgeVersions.join('；'),result.new.knowledgeVersions.join('；')],...rows(result).map(r=>[r.label,r.old,r.new]),['对照性质',result.strict?'严格对照':'描述性比较',''],['限制',result.limitations.join('；'),'']];const escape=(value:unknown)=>'"'+String(value??'').replace(/^[\s]*[=+\-@]/,"'").replaceAll('"','""')+'"',url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='Agent任务对比.csv';link.click();URL.revokeObjectURL(url);}
export default function AgentTaskComparisonPanel(){
 const token=useAuthStore(s=>s.token),[candidates,setCandidates]=useState<AgentRunCandidate[]>([]),[oldId,setOldId]=useState<string>(),[newId,setNewId]=useState<string>(),[result,setResult]=useState<AgentTaskComparison|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useCallback(async(path:string,body?:unknown)=>{const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const payload=await response.json();if(!response.ok)throw new Error(payload.message??payload.error??'查询失败');return payload.data;},[token]);
 const load=useCallback(async()=>{setLoading(true);try{setCandidates(await request('/api/agent/research/runs'));setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[request]);
 useEffect(()=>{void load();},[load]);
 const compare=async()=>{if(!oldId||!newId||busy)return;setBusy(true);setError('');try{setResult(await request('/api/agent/research/compare',{oldRunId:oldId,newRunId:newId}));}catch(e){setResult(null);setError((e as Error).message);}finally{setBusy(false);}};
 const options=candidates.map(r=>({value:r.id,label:`${r.engineLabel} · ${r.startedAt.slice(0,16).replace('T',' ')} · ${r.question.slice(0,45)} · ${r.id.slice(0,8)}`}));
 return <Flex vertical gap={14}>
  <Typography.Paragraph type="secondary" style={{margin:0}}>读取已保存执行进行比较，不调用模型、不写评分。选择记录时保留失败样本，缺少历史输入的记录只作描述性比较。</Typography.Paragraph>
  <Flex gap={12} wrap><Select aria-label="旧版Agent执行" loading={loading} showSearch optionFilterProp="label" placeholder="旧版所选执行" value={oldId} style={{flex:'1 1 290px',minWidth:0}} options={options.filter(o=>o.value!==newId)} onChange={id=>{setOldId(id);setResult(null);}}/><Select aria-label="新版Agent执行" loading={loading} showSearch optionFilterProp="label" placeholder="新版所选执行" value={newId} style={{flex:'1 1 290px',minWidth:0}} options={options.filter(o=>o.value!==oldId)} onChange={id=>{setNewId(id);setResult(null);}}/><Button type="primary" loading={busy} disabled={!oldId||!newId||oldId===newId||busy} onClick={()=>void compare()}>查看对比</Button><Button onClick={()=>void load()} loading={loading}>刷新记录</Button></Flex>
  {error&&<Alert type="error" title={error}/>}{!loading&&!candidates.length&&<Alert type="info" title="暂无执行记录" description="先在智能分析中提交问题，成功与失败的实际执行均可在这里选择。"/>}
  {result&&<><Flex align="center" justify="space-between" gap={8} wrap><Tag color={result.strict?'green':'orange'}>{result.strict?'严格对照条件完整':'描述性比较 · 条件不完全一致'}</Tag><Button onClick={()=>csv(result)}>导出CSV</Button></Flex>
   <Table size="small" pagination={false} rowKey="key" dataSource={rows(result)} scroll={{x:540}} columns={[{title:'比较项',dataIndex:'label',width:210},{title:'旧版所选执行',dataIndex:'old'},{title:'新版所选执行',dataIndex:'new'}]}/>
   <Collapse items={[{key:'scope',label:'问题、冻结范围与来源版本',children:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16}}>{[result.old,result.new].map(r=><div key={r.id} style={{overflowWrap:'anywhere'}}><Typography.Text strong>{r.engineLabel}</Typography.Text><Typography.Paragraph>{r.question}</Typography.Paragraph><Typography.Paragraph type="secondary">数据集 {r.context?.datasetId??unavailable}<br/>{range(r)}<br/>数据版本：{r.dataVersions.join('；')||unavailable}<br/>知识版本：{r.knowledgeVersions.join('；')||'无已记录来源'}<br/>提示版本：{r.promptVersion??unavailable}</Typography.Paragraph><Button size="small" href={'/dashboard/agent?sessionId='+encodeURIComponent(r.sessionId)}>查看原会话</Button></div>)}</div>},{key:'limits',label:'对比限制与人工评价',children:<><ul>{result.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul>{[result.old,result.new].map(r=><div key={r.id}><Typography.Text strong>{r.engineLabel}</Typography.Text><ul>{r.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul></div>)}</>}]} />
  </>}
 </Flex>;
}
