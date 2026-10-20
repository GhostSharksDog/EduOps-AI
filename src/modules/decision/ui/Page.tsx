'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Card,Checkbox,DatePicker,Empty,Flex,Form,Input,Select,Skeleton,Tag,Timeline,Typography} from 'antd';
import dayjs from 'dayjs';
import {useAuthStore} from '@/modules/identity/client';
import {analysisHref,sameAnalysisRange,selectionFromSearch} from '@/shared/lib/analysis-navigation';
import type {RiskSegmentSnapshotVO} from '@/modules/segment/contracts';
import {isFinanceScope} from '@/shared/contracts/analysis';
import type {DecisionCreate,DecisionState,DecisionTask,DecisionUpdate,RecommendationVO,ReviewPreview} from '../contracts';
import {stateLabels} from '../contracts';
import {rememberReviewRecord,ReviewGuide} from '@/modules/overview/client';
import {useUnsavedChanges,protectNavigation,readEditBuffer,writeEditBuffer,clearEditBuffer} from '@/shared/ui/use-unsaved-changes';
import {useSearchParams} from 'next/navigation';
import {Workspace,WorkspaceToolbar,WorkspaceSplit,WorkspacePane} from '@/shared/ui/Workspace';
import AnalysisRangeSummary from '@/shared/ui/AnalysisRangeSummary';
import GoalEditor from './GoalEditor';
import TaskArrangementEditor from './TaskArrangementEditor';
import ReviewPanel,{FrozenReview} from './ReviewPanel';
import {defaultReviewPeriod,reviewBaselineScope} from '../domain/review';
import styles from './Decision.module.css';
const priorities={high:'高',normal:'中',low:'低'};
const stateColors:Record<DecisionState,string>={accepted:'cyan',deferred:'default',rejected:'default',executing:'blue',review_pending:'purple',completed:'green'};
export default function Page(){
 const token=useAuthStore(s=>s.token),user=useAuthStore(s=>s.user),writable=['admin','operator'].includes(user?.role??''),{message}=App.useApp();
 const [tasks,setTasks]=useState<DecisionTask[]>([]),[sources,setSources]=useState<RecommendationVO[]>([]),[owners,setOwners]=useState<{id:string;name:string}[]>([]),[selected,setSelected]=useState<RecommendationVO|null>(null),[task,setTask]=useState<DecisionTask|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[state,setState]=useState<DecisionState|undefined>(),[update,setUpdate]=useState<{state?:DecisionState;kind:DecisionUpdate['kind']}|null>(null);
 const params=useSearchParams(),detailSequence=useRef(0),openedTask=useRef<string|null>(null),detailAbort=useRef<AbortController|null>(null);
 const [mode,setMode]=useState<'tasks'|'suggestions'>('tasks'),[search,setSearch]=useState(''),[detailOpen,setDetailOpen]=useState(false),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
 const setAddress=(taskId:string|null,suggestionKey?:string)=>{const url=new URL(window.location.href);url.searchParams.delete('taskId');url.searchParams.delete('suggestionKey');if(taskId)url.searchParams.set('taskId',taskId);if(suggestionKey)url.searchParams.set('suggestionKey',suggestionKey);if(url.href!==window.location.href)window.history.pushState(null,'',url);};
 const [reviewPreview,setReviewPreview]=useState<ReviewPreview|null>(null),[freezeReview,setFreezeReview]=useState(false);
 const [snapshots,setSnapshots]=useState<RiskSegmentSnapshotVO[]>([]);
 const [quickFilter,setQuickFilter]=useState('all'),[editDirty,setEditDirty]=useState(false);
 const [form]=Form.useForm(),[feedbackForm]=Form.useForm();
 const request=useCallback(async(path:string,method='GET',body?:unknown,signal?:AbortSignal)=>{const r=await fetch(path,{method,signal,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),b=await r.json();if(!r.ok||b.status!=='ready')throw Error(b.message??'请求失败');return b.data;},[token]);
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{const [t,s,o,g]=await Promise.all([request('/api/decisions'),request('/api/decisions/recommendations'),request('/api/decisions/owners'),request('/api/segments/risk-snapshots?summary=true')]);setTasks(t);setSources(s);setOwners(o);setSnapshots(g);}catch(e){setError(e instanceof Error?e.message:'加载失败');}finally{setLoading(false);}},[request]);
 const openTask=useCallback(async(id:string,changeAddress=true)=>{detailAbort.current?.abort();const controller=new AbortController();detailAbort.current=controller;const current=++detailSequence.current;openedTask.current=id;setSelected(null);setTask(null);setUpdate(null);setDetailError('');setDetailLoading(true);setDetailOpen(true);setMode('tasks');setReviewPreview(null);setFreezeReview(false);if(changeAddress)setAddress(id);try{const value=await request('/api/decisions/'+encodeURIComponent(id),'GET',undefined,controller.signal);if(current===detailSequence.current)setTask(value);}catch(e){if(current===detailSequence.current)setDetailError((e as Error).message);}finally{if(current===detailSequence.current)setDetailLoading(false);}},[request]);
 useEffect(()=>{void refresh();return()=>{++detailSequence.current;detailAbort.current?.abort();openedTask.current=null;};},[refresh]);
 useEffect(()=>{const id=params.get('taskId');if(readEditBuffer('decision'))return;if(id&&id!==openedTask.current)void openTask(id,false);else if(!id&&!params.get('suggestionKey')&&(openedTask.current||selected)){++detailSequence.current;detailAbort.current?.abort();openedTask.current=null;setTask(null);setSelected(null);setUpdate(null);setDetailOpen(false);setDetailLoading(false);setDetailError('');}},[params,openTask]);
 const start=(s:RecommendationVO)=>{++detailSequence.current;detailAbort.current?.abort();openedTask.current=null;setTask(null);setUpdate(null);setDetailError('');setDetailLoading(false);setDetailOpen(true);setMode('suggestions');setAddress(null,s.key);setSelected(s);setReviewPreview(null);form.resetFields();let goals;try{goals={targets:[],reviewPeriod:defaultReviewPeriod(reviewBaselineScope(s))};}catch{}form.setFieldsValue({goals,action:s.recommendation,ownerId:user?.id,priority:'normal',dueDate:dayjs().add(7,'day'),reviewMethod:'核对执行记录，按同一数据来源和口径复查；数据不足时说明限制。',recordType:'demonstration',disposition:'accepted'});};
 const create=async()=>{if(!selected||saving)return false;try{const values=await form.validateFields();setSaving(true);const input:DecisionCreate={...values,goals:values.goals?.targets?.length?values.goals:undefined,segmentSnapshotId:values.segmentSnapshotId||undefined,source:selected.source,requestKey:crypto.randomUUID(),dueDate:values.dueDate.format('YYYY-MM-DD')};const result=await request('/api/decisions','POST',input);setSelected(null);setTask(result);openedTask.current=result.id;setAddress(result.id);setMode('tasks');setDetailOpen(true);if(!isFinanceScope(result.sourceSnapshot.scope))rememberReviewRecord('taskId',result.id,{datasetId:result.datasetId,scope:result.sourceSnapshot.scope});setEditDirty(false);clearEditBuffer('decision');message.success('决定已保存，原分析依据保持不变');await refresh();return true;}catch(e){if(e instanceof Error)message.error(e.message);return false;}finally{setSaving(false);}};
 const submit=async()=>{if(!task||!update||saving)return false;try{if(freezeReview&&(!reviewPreview?.canConfirm||reviewPreview.taskVersion!==task.version))throw Error('请先按当前任务版本重新预览量化复核');const values=await feedbackForm.validateFields();setSaving(true);const result=await request('/api/decisions/'+task.id,'PATCH',{...values,...update,expectedVersion:task.version,requestKey:crypto.randomUUID(),...(freezeReview&&reviewPreview?{quantitativeReview:{period:reviewPreview.period,previewToken:reviewPreview.previewToken}}:{})});setTask(result);if(!isFinanceScope(result.sourceSnapshot.scope))rememberReviewRecord('taskId',result.id,{datasetId:result.datasetId,scope:result.sourceSnapshot.scope});setUpdate(null);setReviewPreview(null);setFreezeReview(false);feedbackForm.resetFields();setEditDirty(false);clearEditBuffer('decision');message.success('记录已保存');await refresh();return true;}catch(e){if(e instanceof Error)message.error(e.message);return false;}finally{setSaving(false);}};
 const protect=useUnsavedChanges(editDirty,()=>selected?create():submit(),'决策安排或执行记录',()=>{setEditDirty(false);clearEditBuffer('decision');});
 const markDecisionDirty=()=>{setEditDirty(true);writeEditBuffer('decision',{selected,task,update,values:selected?form.getFieldsValue(true):feedbackForm.getFieldsValue(true)});};
 useEffect(()=>{const b=readEditBuffer<{selected:RecommendationVO|null;task:DecisionTask|null;update:typeof update;values:Record<string,unknown>}>('decision');if(b){setSelected(b.selected);setTask(b.task);setUpdate(b.update);setDetailOpen(true);setMode(b.selected?'suggestions':'tasks');openedTask.current=b.task?.id??null;setEditDirty(true);(b.selected?form:feedbackForm).setFieldsValue(b.values);}},[form,feedbackForm]);
 const begin=(kind:DecisionUpdate['kind'],next?:DecisionState)=>protectNavigation(()=>{setUpdate({kind,...(next?{state:next}:{})});feedbackForm.resetFields();setFreezeReview(false);});
 const exportFeedback=async()=>{try{const records=await Promise.all(visibleTasks.map(t=>request('/api/decisions/'+t.id))),escape=(v:unknown)=>'"'+String(v??'').replace(/^[=+\-@]/,"'").replaceAll('"','""')+'"',rows=[['任务','数据集','反馈性质','状态','责任人','执行动作','复核方法','记录类型','记录内容','采纳意愿','复核结论','执行前目标','量化复核指标','量化依据版本','时间'],...records.flatMap((t:DecisionTask)=>t.feedback.map(f=>[t.id,t.datasetId,t.recordType,stateLabels[t.state],t.ownerName,t.action,t.reviewMethod,f.kind,f.note,f.adoptionIntention??'',f.reviewResult??'',JSON.stringify(t.goals?.targets??[]),JSON.stringify(f.quantitativeReview?.metrics??[]),f.quantitativeReview?.definitionVersion??'',f.createdAt]))],url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='决策采纳执行复核.csv';a.click();URL.revokeObjectURL(url);}catch(e){message.error((e as Error).message);}};
 const query=new URLSearchParams(params.toString()),sourceId=query.get('sourceId'),datasetId=query.get('datasetId'),selection=selectionFromSearch(query.toString()),inRange=(s:RecommendationVO)=>(!datasetId||s.datasetId===datasetId)&&(!selection||(!isFinanceScope(s.scope)&&sameAnalysisRange(s.scope,selection.scope))),visibleSources=sources.filter(s=>(!sourceId||s.source.id===sourceId)&&inRange(s)),visibleTasks=tasks.filter(t=>inRange(t.sourceSnapshot));
 const activeTask=(t:DecisionTask)=>['accepted','executing','review_pending'].includes(t.state),today=dayjs().format('YYYY-MM-DD'),soon=dayjs().add(7,'day').format('YYYY-MM-DD'),taskRows=visibleTasks.filter(t=>(!state||t.state===state)&&(quickFilter==='all'||quickFilter==='mine'&&t.ownerId===user?.id||quickFilter==='soon'&&activeTask(t)&&t.dueDate>=today&&t.dueDate<=soon||quickFilter==='overdue'&&activeTask(t)&&t.dueDate<today)&&(!search||(t.action+' '+t.ownerName).toLowerCase().includes(search.toLowerCase())));
 const suggestionRows=visibleSources.filter(s=>!search||s.recommendation.toLowerCase().includes(search.toLowerCase()));
 const sourceHref=(s:RecommendationVO)=>isFinanceScope(s.scope)?(s.source.kind==='agent'?'/dashboard/agent?'+new URLSearchParams({datasetId:s.datasetId,financeScope:JSON.stringify(s.scope),runId:s.source.id}):'/dashboard/reports/'+s.source.id):analysisHref(s.source.kind==='agent'?'/dashboard/agent':'/dashboard/reports/'+s.source.id,{datasetId:s.datasetId,scope:s.scope},s.source.kind==='agent'?{runId:s.source.id}:{reportId:s.source.id});
 const nextLabel=(t:DecisionTask)=>t.state==='accepted'?'开始执行':t.state==='executing'?'记录执行':t.state==='review_pending'?'填写复核':'查看记录';
 const closeDetail=()=>protectNavigation(()=>{++detailSequence.current;detailAbort.current?.abort();openedTask.current=null;setTask(null);setSelected(null);setUpdate(null);setDetailOpen(false);setEditDirty(false);clearEditBuffer('decision');setAddress(null);});
 useEffect(()=>{const key=params.get('suggestionKey');if(key&&key!==selected?.key&&!readEditBuffer('decision')){const source=sources.find(s=>s.key===key);if(source)start(source);else if(!loading){setDetailError('指定的分析建议不存在或不属于当前公司。');setDetailOpen(true);setMode('suggestions');}}},[params,sources,loading]);
 return <Workspace fit className={styles.page} label="行动中心工作区" data-spatial-enter>
 <WorkspaceToolbar title="行动中心" actions={<Flex gap={8} wrap><Button href="/dashboard/help#decision">帮助</Button><Button href="/dashboard/evaluation">研究评价</Button><Button disabled={!visibleTasks.length} onClick={()=>void exportFeedback()}>导出反馈</Button><Button onClick={()=>void refresh()} loading={loading}>刷新</Button></Flex>}/>
 <ReviewGuide/>
 {selection&&<div className={styles.scopeSummary}><Tag color="orange">模拟经营</Tag><span>{selection.scope.startDate} 至 {selection.scope.endDate}</span><span>校区 {selection.scope.campusIds.join('、')||'全部'} · 课程 {selection.scope.courseIds.join('、')||'全部'}</span>{!!selection.scope.channelIds.length&&<span>渠道 {selection.scope.channelIds.join('、')}</span>}</div>}
 {error&&<Alert type="error" title={error} action={<Button onClick={()=>void refresh()}>重新加载</Button>}/>}
 <WorkspaceSplit columns="minmax(320px, 38%) minmax(0, 1fr)" className={styles.split}>
  <WorkspacePane title="待办与建议" className={`${styles.catalog} ${detailOpen?styles.mobileHidden:''}`} bodyClassName={styles.catalogBody} aria-label="行动待办列表">
   <div className={styles.listTabs}><Button type={mode==='tasks'?'primary':'default'} onClick={()=>setMode('tasks')}>任务 {visibleTasks.length}</Button><Button type={mode==='suggestions'?'primary':'default'} onClick={()=>setMode('suggestions')}>建议 {visibleSources.filter(s=>!s.taskId).length}</Button></div>
   <Input aria-label="搜索行动任务" placeholder={mode==='tasks'?'查找动作或责任人':'查找建议'} value={search} allowClear onChange={e=>setSearch(e.target.value)}/>
   {mode==='tasks'&&<><Flex className={styles.filterRow} gap={8}><Select aria-label="筛选任务状态" allowClear placeholder="全部状态" value={state} style={{flex:1,minWidth:0}} options={Object.entries(stateLabels).map(([value,label])=>({value,label:label+' '+visibleTasks.filter(t=>t.state===value).length}))} onChange={setState}/><Select aria-label="任务待办筛选" value={quickFilter} style={{width:144}} onChange={setQuickFilter} options={[{value:'all',label:'全部任务'},{value:'mine',label:'我负责的'},{value:'soon',label:'7天内到期'},{value:'overdue',label:'已逾期'}]}/></Flex>
   <div className={styles.listCount}>{loading?'正在读取…':`${taskRows.length} 项任务`}</div>
   {!loading&&!taskRows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="此筛选下暂无任务，可从分析建议创建"/>}
   {taskRows.map(t=><button type="button" className={styles.taskItem} disabled={saving} key={t.id} data-overdue={activeTask(t)&&t.dueDate<today||undefined} aria-pressed={task?.id===t.id||openedTask.current===t.id} onClick={()=>protectNavigation(()=>void openTask(t.id))}>
    <div className={styles.itemTop}><Tag color={stateColors[t.state]}>{stateLabels[t.state]}</Tag>{t.priority==='high'&&<Tag color="volcano">高优先级</Tag>}{activeTask(t)&&t.dueDate<today&&<Tag color="red">已逾期</Tag>}</div><strong>{t.action}</strong><div className={styles.itemMeta}><span className={styles.owner}><span aria-hidden="true">{t.ownerName.slice(0,1)}</span>{t.ownerName}</span><span className={styles.date}><small>期限</small>{t.dueDate}</span></div><div className={styles.itemBottom}><small>{t.recordType==='demonstration'?'模拟/演示反馈':'实际反馈'}</small><span>{nextLabel(t)} <span aria-hidden="true">↗</span></span></div>
   </button>)}</>}
   {mode==='suggestions'&&<><div className={styles.listCount}>{loading?'正在读取…':`${suggestionRows.length} 条建议`}</div>{!loading&&!suggestionRows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无此范围有效建议，先完成智能分析或报告"/>}{suggestionRows.map(s=><div className={styles.suggestionItem} key={s.key} data-selected={selected?.key===s.key}><button type="button" className={styles.suggestionSelect} disabled={saving} aria-label={'处理建议 '+s.key} onClick={()=>protectNavigation(()=>s.taskId?void openTask(s.taskId):start(s))}><div className={styles.itemTop}><Tag color={s.dataOrigin==='simulated'?'orange':'blue'}>{s.dataOrigin==='simulated'?'模拟经营':'真实财务案例'}</Tag><Tag>{s.source.kind==='agent'?'智能分析':'报告'}</Tag>{s.taskId&&<Tag color="green">已安排</Tag>}</div><Typography.Paragraph ellipsis={{rows:3}}>{s.recommendation}</Typography.Paragraph><small>{isFinanceScope(s.scope)?s.scope.years.join('、')||'全部年度':s.scope.startDate+' 至 '+s.scope.endDate}</small></button><Button size="small" type="link" href={sourceHref(s)}>查看原分析</Button></div>)}</>}
  </WorkspacePane>
  <WorkspacePane className={`${styles.detailPane} ${!detailOpen?styles.mobileHidden:''}`} aria-label="行动详情与操作" data-object-id={task?.id??selected?.key} footer={selected?<Flex gap={8} justify="end" wrap><Button disabled={saving} onClick={closeDetail}>取消安排</Button><Button type="primary" disabled={!writable} loading={saving} onClick={()=>void create()}>保存决定</Button></Flex>:undefined}>
   <Button className={styles.back} onClick={closeDetail}>返回待办列表</Button>
   {detailLoading&&<Skeleton active paragraph={{rows:8}}/>}
   {detailError&&<Alert type="error" title={detailError} action={<Button onClick={()=>openedTask.current&&void openTask(openedTask.current,false)}>重新读取</Button>}/>}
   {selected&&<section className={styles.arrangement} aria-label="确认建议及执行安排" data-spatial-reveal><Flex gap={8} wrap><Tag color={selected.dataOrigin==='simulated'?'orange':'blue'}>{selected.dataOrigin==='simulated'?'模拟经营':'真实财务案例'}</Tag><Button size="small" href={sourceHref(selected)}>查看原分析</Button></Flex><Typography.Title level={3}>确认建议及执行安排</Typography.Title><Typography.Paragraph>{selected?.recommendation}</Typography.Paragraph><Form form={form} layout="vertical" disabled={!writable||saving} onValuesChange={markDecisionDirty}><Form.Item name="disposition" label="采纳决定" rules={[{required:true}]}><Select options={[{value:'accepted',label:'采纳并建立任务'},{value:'deferred',label:'暂缓，保存安排'},{value:'rejected',label:'不采纳，保留记录'}]}/></Form.Item><Form.Item name="action" label="具体执行动作" rules={[{required:true},{max:4000}]}><Input.TextArea aria-label="决策执行动作" rows={3}/></Form.Item><Form.Item name="ownerId" label="责任人" rules={[{required:true}]}><Select options={owners.map(o=>({value:o.id,label:o.name}))}/></Form.Item><Flex gap={14} wrap><Form.Item name="priority" label="优先级" rules={[{required:true}]} style={{flex:1}}><Select options={Object.entries(priorities).map(([value,label])=>({value,label}))}/></Form.Item><Form.Item name="dueDate" label="执行期限" rules={[{required:true}]} style={{flex:1}}><DatePicker aria-label="决策期限" style={{width:'100%'}} format="YYYY-MM-DD"/></Form.Item></Flex><Form.Item name="reviewMethod" label="如何复核" rules={[{required:true},{max:2000}]}><Input.TextArea rows={2}/></Form.Item><GoalEditor source={selected} form={form}/><Form.Item name="segmentSnapshotId" label="关联已确认人群（可选）" extra="仅能关联同数据集、同校区课程及同周期的快照；财务案例不能关联模拟学员。"><Select aria-label="关联人群" allowClear disabled={!selected||isFinanceScope(selected.scope)} placeholder="选择同范围的已确认人群" options={snapshots.filter(s=>selected&&!isFinanceScope(selected.scope)&&s.datasetId===selected.datasetId&&sameAnalysisRange(s.preview.scope,selected.scope)).map(s=>({value:s.id,label:s.name+' · '+s.memberCount+'人 · v'+s.tagVersion}))}/></Form.Item><Form.Item name="recordType" label="反馈性质"><Select disabled={selected?.dataOrigin==='simulated'} options={[{value:'demonstration',label:'演示与情境评审，不计真实采用率'},{value:'actual',label:'真实使用者的实际反馈'}]}/></Form.Item></Form><details><summary>原始事实及证据</summary><Typography.Paragraph>{selected?.answer.summary}</Typography.Paragraph>{selected?.answer.facts.map(f=><div key={f.id}>{f.label}：{f.value??'未知'} {f.unit}</div>)}{selected?.evidence.map(e=><Typography.Paragraph key={e.id}>{e.summary}</Typography.Paragraph>)}</details></section>}
   {task&&<div className={styles.detail} data-spatial-reveal>
    <header className={styles.briefHeader}>
     <div className={styles.briefEyebrow}><span>执行简报</span><span>版本 {task.version}</span></div>
     <div className={styles.briefTags}><Tag color={stateColors[task.state]}>{stateLabels[task.state]}</Tag><Tag color={task.sourceSnapshot.dataOrigin==='simulated'?'orange':'blue'}>{task.sourceSnapshot.dataOrigin==='simulated'?'模拟经营':'真实财务案例'}</Tag><Tag>{task.recordType==='demonstration'?'模拟/演示反馈':'实际反馈'}</Tag></div>
     <Typography.Title level={4}>{task.action}</Typography.Title>
     <dl className={styles.briefMeta}>
      <div><dt>责任人</dt><dd><span className={styles.briefAvatar} aria-hidden="true">{task.ownerName.slice(0,1)}</span>{task.ownerName}</dd></div>
      <div data-overdue={activeTask(task)&&task.dueDate<today||undefined}><dt>执行期限</dt><dd className={styles.date}>{task.dueDate}{activeTask(task)&&task.dueDate<today&&<small>已逾期</small>}</dd></div>
      <div><dt>优先级</dt><dd>{priorities[task.priority]}<span className={styles.priorityDot} data-priority={task.priority} aria-hidden="true"/></dd></div>
     </dl>
    </header>
    <div className={styles.briefBody}>
     <div className={styles.frozenRange}>
      {isFinanceScope(task.sourceSnapshot.scope)?<Typography.Paragraph type="secondary">真实财务案例 · 冻结年度 {task.sourceSnapshot.scope.years.join('、')} · 数据集 {task.datasetId}</Typography.Paragraph>:<AnalysisRangeSummary name="任务原分析范围" origin={task.sourceSnapshot.dataOrigin} scope={task.sourceSnapshot.scope} frozen/>}
     </div>
     <section className={styles.nextAction} aria-label="任务下一步">
      <div className={styles.sectionEyebrow}>下一步</div>
      <Flex gap={8} wrap>{writable&&<>
       {task.state==='deferred'&&<Button type="primary" onClick={()=>begin('adoption','accepted')}>采纳并安排执行</Button>}
       {task.state==='accepted'&&<><Button type="primary" onClick={()=>begin('execution','executing')}>开始执行</Button><Button onClick={()=>begin('adoption','deferred')}>暂缓</Button><Button onClick={()=>begin('adoption','rejected')}>不采纳</Button></>}
       {task.state==='executing'&&<><Button type="primary" onClick={()=>begin('execution')}>补充执行记录</Button><Button onClick={()=>begin('execution','review_pending')}>提交复核</Button></>}
       {task.state==='review_pending'&&<><Button type="primary" onClick={()=>begin('review','completed')}>完成复核</Button><Button onClick={()=>begin('execution','executing')}>返回执行</Button></>}
      </>}
      {task.segmentSnapshotId&&<Button href={!isFinanceScope(task.sourceSnapshot.scope)?analysisHref('/dashboard/data/portrait',{datasetId:task.datasetId,scope:task.sourceSnapshot.scope},{snapshotId:task.segmentSnapshotId,taskId:task.id}):undefined}>查看关联人群</Button>}
      {(!writable||['completed','rejected'].includes(task.state))&&<Typography.Text type="secondary">{!writable?'当前账号可查看任务与数据依据。':task.state==='completed'?'已保存复核结果，可展开下方记录查看。':'已保留本次决定及原分析依据。'}</Typography.Text>}
      </Flex>
      <p className={styles.reviewMethod}><span>复核方法</span>{task.reviewMethod}</p>
     </section>
     {update&&<section className={styles.feedbackEditor} aria-label="任务反馈编辑" data-spatial-reveal>
      <Typography.Title level={4}>{update.kind==='review'?'填写复核结果':update.kind==='adoption'?'记录采纳决定':'记录执行动作'}</Typography.Title>
      <Alert type="info" title={task.recordType==='demonstration'?'这是演示记录，请注明模拟执行，不能填成真实机构经营改善。':'请填写实际完成的动作与可核查反馈。'}/>
      <Form form={feedbackForm} layout="vertical" onValuesChange={markDecisionDirty}>
       {update.kind==='review'&&<Card size="small" style={{marginTop:12,marginBottom:12}}><Checkbox checked={freezeReview} disabled={!reviewPreview?.canConfirm||reviewPreview.taskVersion!==task.version} onChange={e=>setFreezeReview(e.target.checked)}>随本次反馈冻结已核验的量化对比</Checkbox><Typography.Paragraph type="secondary" style={{marginBottom:0,marginTop:8}}>{reviewPreview?.canConfirm?'保存时由服务端重新核验周期、版本、批次和数字；数据变化会要求重新预览。':'先在任务详情预览量化复核。未结束或数据不足时仍可保存说明，不会判断改善或目标达成。'}</Typography.Paragraph></Card>}
       <Form.Item name="note" label="操作记录" rules={[{required:true},{max:4000}]}><Input.TextArea aria-label="决策操作记录" rows={3}/></Form.Item>
       {update.kind==='review'&&<Form.Item name="reviewResult" label="复核结论与限制" rules={[{required:true},{max:4000}]}><Input.TextArea aria-label="决策复核结论" rows={3}/></Form.Item>}
       <Form.Item name="adoptionIntention" label="使用者采纳意愿（可选）"><Select allowClear options={[{value:'yes',label:'愿意采纳'},{value:'maybe',label:'需要进一步核查'},{value:'no',label:'不愿意采纳'}]}/></Form.Item>
      </Form>
      <Flex gap={8} justify="end" wrap><Button disabled={saving} onClick={()=>protect(()=>{setUpdate(null);setEditDirty(false);clearEditBuffer('decision');})}>取消编辑</Button><Button type="primary" loading={saving} onClick={()=>void submit()}>保存记录</Button></Flex>
     </section>}
     <TaskArrangementEditor inline task={task} owners={owners} user={user} request={request} onSaved={value=>{setTask(value);void refresh();}}/>
     <div className={styles.briefSections}>
      <details className={styles.detailSection}>
       <summary><span className={styles.sectionNumber} aria-hidden="true">01</span>分析来源与依据<span className={styles.sectionHint}>保留原始结论</span></summary>
       <div className={styles.sectionBody}>
        <Button size="small" href={sourceHref(task.sourceSnapshot)}>查看原分析</Button>
        <Typography.Paragraph className={styles.sourceSummary}>{task.sourceSnapshot.answer.summary}</Typography.Paragraph>
        {!!task.sourceSnapshot.answer.facts.length&&<dl className={styles.sourceFacts}>{task.sourceSnapshot.answer.facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.value??'未知'} <small>{f.unit}</small></dd></div>)}</dl>}
        {task.sourceSnapshot.evidence.map(e=><Typography.Paragraph key={e.id} type="secondary">{e.summary}</Typography.Paragraph>)}
        <details className={styles.rawSource}><summary>冻结的分析来源、事实与引用</summary><pre>{JSON.stringify(task.sourceSnapshot,null,2)}</pre></details>
       </div>
      </details>
      <details className={styles.detailSection}>
       <summary><span className={styles.sectionNumber} aria-hidden="true">02</span>量化复核 · 按同一口径比较<span className={styles.sectionHint}>预览不改变任务</span></summary>
       <div className={styles.sectionBody}><ReviewPanel task={task} request={request} onPreview={setReviewPreview}/></div>
      </details>
      <details className={styles.detailSection}>
       <summary><span className={styles.sectionNumber} aria-hidden="true">03</span>操作历史<span className={styles.sectionHint}>{task.feedback.length} 条记录</span></summary>
       <div className={styles.sectionBody}>{task.feedback.length?<Timeline items={task.feedback.map(f=>({key:f.id,content:<><div className={styles.historyMeta}><Tag>{f.kind==='review'?'复核':f.kind==='execution'?'执行':'采纳反馈'}</Tag><time dateTime={f.createdAt}>{dayjs(f.createdAt).format('YYYY-MM-DD HH:mm')}</time></div><p>{f.note}</p>{f.reviewResult&&<p>复核结论：{f.reviewResult}</p>}{f.quantitativeReview&&<FrozenReview value={f.quantitativeReview}/>} {f.adoptionIntention&&<p>采纳意愿：{f.adoptionIntention==='yes'?'愿意':f.adoptionIntention==='maybe'?'需进一步核查':'不愿意'}</p>}</>}))}/>:<Typography.Text type="secondary">已建立任务，尚无执行与复核记录。</Typography.Text>}</div>
      </details>
     </div>
    </div>
   </div>}
   {!task&&!selected&&!detailLoading&&!detailError&&<Empty className={styles.empty} description="选择左侧任务继续处理，或把建议安排为可复核的任务"/>}
  </WorkspacePane>
 </WorkspaceSplit>
 </Workspace>;
}
