'use client';

import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {Alert,App,Button,Drawer,Empty,Flex,Input,Modal,Segmented,Select,Spin,Tag,Typography} from 'antd';
import {ArrowDownOutlined,CheckOutlined,CloseOutlined,HistoryOutlined,MessageOutlined,PlusOutlined,RobotOutlined,SendOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {analysisScopeSchema,learningScopeSchema,financeScopeSchema,isLearningScope,isFinanceScope} from '@/shared/contracts/analysis';
import type {AnalysisScope} from '@/shared/contracts/analysis';
import AnalysisRangeSummary from '@/shared/ui/AnalysisRangeSummary';
import {Workspace} from '@/shared/ui/Workspace';
import VisualArtwork from '@/shared/ui/VisualArtwork';
import {useUnsavedChanges,readEditBuffer,writeEditBuffer,clearEditBuffer} from '@/shared/ui/use-unsaved-changes';
import {ReviewGuide} from '@/modules/overview/client';
import type {AgentConfirmationDTO,AgentProposalVO,AgentRunVO} from '../contracts';
import RunDetails,{agentStepLabel} from './RunDetails';
import {runAnswerSummary,runStatusColor,runStatusLabel} from '../domain/run-presentation';
import TaskMemoryPanel from './TaskMemoryPanel';
import {contextScopeStatus,type AgentContextAction} from '../domain/context-actions';
import RangeEditor from './RangeEditor';
import type {RangeSelection} from './RangeEditor';
import {useAgentWorkspace} from './useAgentWorkspace';
import styles from './AgentEditorial.module.css';

interface ConfirmationTarget extends AgentConfirmationDTO {name:string;count:number;unknownCount:number|null;ruleSummary:string;scope:AnalysisScope;}
const tasks={
 operations:[{label:'解释出勤变化',prompt:'帮我看看当前范围的出勤情况，比较变化并拆解可能受影响的课程。'},{label:'创建人群并跟进',prompt:'找出出勤偏低且同课程未来30天到期的学员，准备标签、人群和跟进任务，先给我核对操作计划。'},{label:'生成经营报告',prompt:'按当前范围准备一份经营月报，先给我核对报告周期。'},{label:'怎么使用系统',prompt:'我第一次使用，怎么从分析问题到创建标签和保存人群？'}],
 learning:[{label:'看看学习情况',prompt:'查询当前范围的学习情况，解释学习活跃趋势。'},{label:'学习活跃',prompt:'哪些课程学习活跃度偏低？帮我拆解并说明数据依据。'},{label:'测评分布',prompt:'解释测评分数分布、免修和缺失情况。'},{label:'使用说明',prompt:'公开学习数据能分析什么，应该如何选择相对日期？'}],
 finance:[{label:'看看收入与成本',prompt:'收入、成本和费用有什么变化？帮我查询年度事实并解释。'},{label:'安排费用复核',prompt:'根据财务变化准备一项费用核查任务，先给我核对执行动作和复核方式。'},{label:'数据范围说明',prompt:'年度财务案例有哪些数据，哪些结论目前无法判断？'}],
};
function displayMessage(content:string){try{const value=JSON.parse(content);if(typeof value==='string')return value;return value&&typeof value.summary==='string'?value.summary:'';}catch{return content;}}

export default function Page(){
 const workspace=useAgentWorkspace(),{message,modal}=App.useApp();
 const [prompt,setPrompt]=useState(''),[target,setTarget]=useState<ConfirmationTarget|null>(null),[rangeOpen,setRangeOpen]=useState(false);
 const [historyOpen,setHistoryOpen]=useState(false),[mobileView,setMobileView]=useState<'conversation'|'result'>('conversation'),[pendingQuestion,setPendingQuestion]=useState(''),[unread,setUnread]=useState(false),[keyboardInset,setKeyboardInset]=useState(0);
 const feedRef=useRef<HTMLDivElement>(null),nearBottom=useRef(true),scrollSession=useRef(''),submissionRunIds=useRef(new Set<string>());
 const promptRef=useRef(''),draftKey=useRef('agent-prompt:new'),submissionRevision=useRef(0),draftIdentity=useRef(''),attachDraft=useRef(false);
 const identity=(workspace.user?.companyCode??'')+':'+(workspace.user?.id??'');
 const updatePrompt=(value:string)=>{promptRef.current=value;setPrompt(value);if(value.trim())writeEditBuffer(draftKey.current,value);else clearEditBuffer(draftKey.current);};
 useEffect(()=>{
  if(!workspace.user)return;
  const next='agent-prompt:'+(workspace.sessionId||'new'),changedIdentity=draftIdentity.current!==identity;
  if(changedIdentity){draftIdentity.current=identity;draftKey.current=next;const value=readEditBuffer<string>(next)??(!workspace.sessionId?new URLSearchParams(window.location.search).get('prompt')?.slice(0,4000):'')??'';promptRef.current=value;setPrompt(value);attachDraft.current=false;submissionRevision.current++;setPendingQuestion('');}
  else if(next!==draftKey.current){
   if(promptRef.current.trim())writeEditBuffer(draftKey.current,promptRef.current);
   const attach=attachDraft.current&&draftKey.current==='agent-prompt:new'&&!!workspace.sessionId;
   if(attach){clearEditBuffer(draftKey.current);attachDraft.current=false;}
   draftKey.current=next;const value=attach?promptRef.current:readEditBuffer<string>(next)??'';promptRef.current=value;setPrompt(value);if(value.trim())writeEditBuffer(next,value);
  }
 },[workspace.sessionId,identity,workspace.user,workspace.submitting]);
 useEffect(()=>{if(new URLSearchParams(window.location.search).has('runId'))setMobileView('result');},[]);
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>setKeyboardInset(Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop));update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);};},[]);
 const busy=workspace.loading||workspace.loadingSession||workspace.submitting||workspace.confirming||workspace.savingTaskState||workspace.running;
 const navigating=workspace.loading||workspace.loadingSession||workspace.confirming||workspace.savingTaskState;
 const dataset=workspace.datasets.find(item=>item.id===workspace.datasetId);
 const validation=workspace.financeMode?financeScopeSchema.safeParse(workspace.financeScope):workspace.publicMode?learningScopeSchema.safeParse(workspace.learningScope):analysisScopeSchema.safeParse(workspace.scope);
 const tools=workspace.capability?.data?.tools??[];
 const current=target?workspace.selectedRun?.proposals.find(item=>item.id===target.proposalId):undefined;
 const canConfirm=!!target&&workspace.writable&&!busy&&workspace.selectedRun?.id===target.runId&&current?.status==='awaiting_confirmation'&&current.version===target.version&&current.previewToken===target.previewToken;
 const protect=useUnsavedChanges(!!prompt.trim(),undefined,'尚未提交的问题',()=>updatePrompt(''));
 const scrollLatest=()=>{const feed=feedRef.current;if(feed){feed.scrollTo({top:feed.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});nearBottom.current=true;setUnread(false);}};
 const lastMessage=workspace.detail?.messages.at(-1);
 const conversationRevision=workspace.runs.map(run=>run.id+run.status+(run.answer?.summary??'')+run.steps.length).join('|')+'|'+lastMessage?.id+'|'+pendingQuestion;
 useEffect(()=>{const sessionChanged=scrollSession.current!==workspace.sessionId;if(sessionChanged){scrollSession.current=workspace.sessionId;nearBottom.current=true;setUnread(false);}const frame=requestAnimationFrame(()=>{if(nearBottom.current){const feed=feedRef.current;if(feed)feed.scrollTop=feed.scrollHeight;}else setUnread(true);});return()=>cancelAnimationFrame(frame);},[conversationRevision,workspace.sessionId]);
 useEffect(()=>{if(!workspace.loading&&!workspace.loadingSession&&workspace.sessionId&&workspace.runId){const url=new URL(window.location.href);if(url.searchParams.get('sessionId')!==workspace.sessionId||url.searchParams.get('runId')!==workspace.runId){url.searchParams.set('sessionId',workspace.sessionId);url.searchParams.set('runId',workspace.runId);window.history.replaceState(null,'',url);}}},[workspace.sessionId,workspace.runId,workspace.loading,workspace.loadingSession]);
 const send=async(text=prompt)=>{if(!validation.success||!text.trim()||busy||!workspace.canChat)return;const revision=++submissionRevision.current;attachDraft.current=!workspace.sessionId;submissionRunIds.current=new Set(workspace.runs.map(run=>run.id));setPendingQuestion(text.trim());updatePrompt('');setMobileView('conversation');nearBottom.current=true;const saved=await workspace.send(text);if(revision!==submissionRevision.current)return;if(!saved&&!promptRef.current.trim())updatePrompt(text);setPendingQuestion('');};
 const focusComposer=()=>{setMobileView('conversation');requestAnimationFrame(()=>{document.getElementById('agent-question-input')?.focus({preventScroll:true});});};
 const followUp=(text:string)=>protect(()=>{updatePrompt(text);focusComposer();});
 const applyRange=(next:RangeSelection)=>{
  const existing={datasetId:workspace.datasetId,...(workspace.financeMode?{financeScope:workspace.financeScope}:workspace.publicMode?{learningScope:workspace.learningScope}:{scope:workspace.scope})};
  if(JSON.stringify(existing)===JSON.stringify(next)){setRangeOpen(false);return;}
  const apply=()=>{setTarget(null);workspace.applySelection(next);setRangeOpen(false);};
  protect(()=>{if(workspace.sessionId&&next.datasetId!==workspace.datasetId){const nextDataset=workspace.datasets.find(item=>item.id===next.datasetId);modal.confirm({title:'切换本次对话的数据来源？',content:'下一轮将使用“'+(nextDataset?.name??'所选数据集')+'”。此前回答和操作计划仍使用各自原始数据，不会混合计算。',okText:'切换并继续对话',cancelText:'保留当前来源',onOk:apply});}else apply();});
 };
 const startConfirmation=(run:AgentRunVO,proposal:AgentProposalVO)=>{
  if(!proposal.previewToken||proposal.estimatedCount===null||!workspace.writable)return;
  const frozenScope=run.context?.scope;
  const scope=proposal.evidence.find(item=>item.scope)?.scope??(frozenScope&&!isLearningScope(frozenScope)&&!isFinanceScope(frozenScope)?frozenScope:workspace.scope);
  setTarget({runId:run.id,proposalId:proposal.id,version:proposal.version,previewToken:proposal.previewToken,name:proposal.name,count:proposal.estimatedCount,unknownCount:proposal.unknownCount??null,ruleSummary:proposal.ruleSummary??'请核对完整规则',scope});
 };
 const selectRun=(id:string)=>{setTarget(null);workspace.setRunId(id);setMobileView('result');const url=new URL(window.location.href);if(workspace.sessionId)url.searchParams.set('sessionId',workspace.sessionId);url.searchParams.set('runId',id);if(url.href!==window.location.href)window.history.pushState(null,'',url);};
 const selectSession=(id:string)=>{submissionRevision.current++;attachDraft.current=false;setTarget(null);setHistoryOpen(false);setPendingQuestion('');setMobileView('conversation');void workspace.loadSession(id);};
 useEffect(()=>{const restore=()=>{const params=new URLSearchParams(window.location.search),sessionId=params.get('sessionId'),runId=params.get('runId');protect(()=>{setTarget(null);if(sessionId&&sessionId!==workspace.sessionId)void workspace.loadSession(sessionId,runId??undefined);else if(runId){if(workspace.runs.some(run=>run.id===runId))workspace.setRunId(runId);else if(sessionId)void workspace.loadSession(sessionId,runId);}else if(!sessionId)workspace.newSession();});};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[workspace.sessionId,workspace.runs,workspace.loadSession,protect]);
 const suggestions=tasks[workspace.financeMode?'finance':workspace.publicMode?'learning':'operations'];
 const names=(ids:string[])=>ids.map(id=>workspace.catalog.find(item=>item.id===id)?.name??id).join('、');
 const frozen=workspace.selectedRun?.context?.scope;
 const resultDataset=workspace.datasets.find(item=>item.id===(workspace.selectedRun?.context?.datasetId??workspace.detail?.session.datasetId??workspace.datasetId));
 const resultScope=frozen&&!isLearningScope(frozen)&&!isFinanceScope(frozen)?frozen:workspace.scope;
 const resultLearning=frozen&&isLearningScope(frozen)?frozen:!frozen&&workspace.publicMode?workspace.learningScope:undefined;
 const resultFinance=frozen&&isFinanceScope(frozen)?frozen:!frozen&&workspace.financeMode?workspace.financeScope:undefined;
 const messages=workspace.detail?.messages??[];
 const pendingRunId=pendingQuestion?workspace.runs.find(run=>!submissionRunIds.current.has(run.id))?.id:undefined;
 const hasPending=!!pendingQuestion&&!(pendingRunId&&messages.some(item=>item.role==='user'&&item.runId===pendingRunId));
 const liveRun=workspace.runs.find(run=>run.status==='queued'||run.status==='running');
 const turns=workspace.runs.map((run,index)=>({run,index,user:messages.find(item=>item.role==='user'&&item.runId===run.id),assistant:messages.find(item=>item.role==='assistant'&&item.runId===run.id)}));
 const legacyMessages=messages.filter(item=>!item.runId||!workspace.runs.some(run=>run.id===item.runId));
 const currentUser=workspace.selectedRun?messages.find(item=>item.role==='user'&&item.runId===workspace.selectedRun?.id):undefined;
 const scopeStatus=contextScopeStatus({datasetId:workspace.datasetId,scope:workspace.financeMode?workspace.financeScope:workspace.publicMode?workspace.learningScope:workspace.scope},workspace.selectedRun?.context);
 const handleContextAction=(action:AgentContextAction)=>{
  const selected=workspace.selectedRun;if(!selected||action.runId!==selected.id)return;
  if(action.kind==='message'){
   if(busy||scopeStatus!=='current'||!workspace.sessionEditable)return;
   protect(()=>{if(action.sendImmediately===false){updatePrompt(action.message);focusComposer();}else void send(action.message);});
  }else if(action.kind==='continue_scope'){
   if(busy||!workspace.sessionEditable||!workspace.datasets.some(item=>item.id===action.context.datasetId))return;
   const selectedScope=action.context.scope,period=isFinanceScope(selectedScope)?(selectedScope.years.join('、')||'全部已导入')+'年度':isLearningScope(selectedScope)?'课程批次 '+(selectedScope.courseKeys.join('、')||'全部')+' · 相对日 '+(selectedScope.relativeDayStart??'起点')+' 至 '+(selectedScope.relativeDayEnd??'终点'):selectedScope.startDate+' 至 '+selectedScope.endDate+' · 校区 '+(selectedScope.campusIds.join('、')||'全部')+' · 课程 '+(selectedScope.courseIds.join('、')||'全部');
   protect(()=>modal.confirm({title:'按这条回答的范围继续？',content:<><p>下一轮将使用以下来源与范围，历史结果保持不变。</p><strong>{workspace.datasets.find(item=>item.id===action.context.datasetId)?.name}</strong><p>{period}</p></>,okText:'使用该范围',cancelText:'保留当前范围',onOk:()=>{const scope=action.context.scope;workspace.applySelection({datasetId:action.context.datasetId,...(isFinanceScope(scope)?{financeScope:scope}:isLearningScope(scope)?{learningScope:scope}:{scope})});focusComposer();}}));
  }else if(action.kind==='open_saved_result')protect(()=>window.location.assign(action.href));
  else if(action.kind==='retry_interpretation'&&!busy)void workspace.retryInterpretation(selected);
 };

 return <Workspace className={styles.workspace} style={{'--agent-keyboard-inset':keyboardInset+'px'} as CSSProperties} data-spatial-enter data-testid="agent-workspace" data-mobile-view={mobileView} aria-label="智能分析工作台">
  <header className={styles.toolbar}><div className={styles.toolbarTitle}><span className={styles.toolbarMark}><RobotOutlined aria-hidden/></span><Typography.Title level={2}>智能分析</Typography.Title><Tag data-testid="agent-company">{workspace.user?.companyName??'当前公司'}</Tag>{!workspace.writable&&<Tag>只读</Tag>}</div><Flex className={styles.headerActions} gap={8} wrap><Button icon={<HistoryOutlined/>} disabled={navigating} onClick={()=>setHistoryOpen(true)}>历史会话</Button><Button icon={<PlusOutlined/>} disabled={navigating||!workspace.canChat} onClick={()=>{submissionRevision.current++;attachDraft.current=false;workspace.newSession();setTarget(null);setPendingQuestion('');setMobileView('conversation');}}>新建会话</Button><Button disabled={navigating} onClick={()=>{submissionRevision.current++;setPendingQuestion('');void workspace.refresh();}}>刷新</Button></Flex></header>
  <div className={styles.scopeBar}><div className={styles.scopeContent}>
   {dataset&&!workspace.publicMode&&!workspace.financeMode?<AnalysisRangeSummary name={dataset.name} origin={dataset.origin} scope={workspace.scope} catalog={workspace.catalog}/>:<Flex gap={8} wrap><Tag color="blue">{workspace.financeMode?'公开年度财务':'匿名公开学习'}</Tag><Typography.Text strong>{dataset?.name??'正在加载数据来源'}</Typography.Text><Typography.Text>{workspace.financeMode?(workspace.financeScope.years.length?workspace.financeScope.years.join('、')+'年度':'全部已导入年度'):(workspace.learningScope.courseKeys.length?names(workspace.learningScope.courseKeys):'全部课程批次')+' · 相对日 '+(workspace.learningScope.relativeDayStart??'起点')+' 至 '+(workspace.learningScope.relativeDayEnd??'终点')}</Typography.Text></Flex>}
   {workspace.sessionId&&<Typography.Text className={styles.nextScopeLabel} type="secondary">下一轮查询范围 · 历史回答保留各自范围</Typography.Text>}
  </div><Button disabled={busy||!workspace.canChat} onClick={()=>setRangeOpen(true)}>修改范围</Button></div>
  {workspace.detail?.session.id===workspace.sessionId&&<TaskMemoryPanel key={workspace.sessionId} sessionId={workspace.sessionId} state={workspace.detail.session.taskState} editable={workspace.sessionEditable&&workspace.canChat} busy={busy&&!workspace.savingTaskState} saving={workspace.savingTaskState} datasetName={workspace.datasets.find(item=>item.id===workspace.detail?.session.taskState?.datasetId)?.name??dataset?.name} onSave={workspace.saveTaskState}/>}
  {!workspace.publicMode&&!workspace.financeMode&&<div className={styles.guide}><ReviewGuide/></div>}
  <div className={styles.alerts} aria-live="polite">
   {workspace.error&&workspace.error!==workspace.selectedRun?.errorMessage&&<Alert type="error" title={workspace.error} showIcon data-testid="agent-error"/>}
   {workspace.capability&&workspace.capability.status!=='ready'&&<Alert type="warning" title="智能服务暂不可用" description={workspace.capability.message} action={<Button onClick={()=>{submissionRevision.current++;setPendingQuestion('');void workspace.refresh();}}>重试连接</Button>}/>}
   {!validation.success&&<Alert type="warning" title={validation.error.issues[0]?.message??'请检查分析范围'}/>}
  </div>
  <div className={styles.mobileSwitch}><Segmented aria-label="智能分析区域" block value={mobileView} options={[{label:'对话',value:'conversation'},{label:'结果'+(workspace.selectedRun?' · '+runStatusLabel(workspace.selectedRun):''),value:'result'}]} onChange={value=>setMobileView(value as 'conversation'|'result')}/></div>
  <div className={styles.split} data-testid="agent-split-workspace">
   <section className={styles.conversationPane} aria-label="连续对话" data-testid="agent-conversation-pane">
    <div className={styles.paneHeading}><span><span className={styles.paneNumber} aria-hidden>01</span><MessageOutlined aria-hidden/> 连续对话</span><Typography.Text type="secondary">{turns.length?turns.length+'轮交流':'从一个问题开始'}</Typography.Text></div>
    <div className={styles.feedViewport} data-testid="agent-feed-viewport">
    <div className={styles.feed} ref={feedRef} role="log" aria-label="对话记录" aria-live="off" tabIndex={0} onScroll={()=>{const feed=feedRef.current;if(feed){nearBottom.current=feed.scrollHeight-feed.scrollTop-feed.clientHeight<100;if(nearBottom.current)setUnread(false);}}}>
     {workspace.loading||workspace.loadingSession?<div className={styles.feedLoading}><Spin/><Typography.Text type="secondary">正在读取会话</Typography.Text></div>:!turns.length&&!hasPending?<div className={styles.welcome}><span className={styles.welcomeMark} aria-hidden>✦</span><Typography.Title level={3}>从一个问题，<br/>找到下一步。</Typography.Title><Typography.Paragraph type="secondary">分析数据、继续追问，或一起准备业务操作。<br/>你来提问，依据与结果在右侧展开。</Typography.Paragraph><div className={styles.welcomeTasks}>{suggestions.map((task,index)=><button key={task.label} disabled={busy||!workspace.sessionEditable} onClick={()=>followUp(task.prompt)}><span className={styles.taskNumber} aria-hidden>{String(index+1).padStart(2,'0')}</span><span>{task.label}</span><span aria-hidden>↗</span></button>)}</div></div>:null}
     {!!legacyMessages.length&&<details className={styles.legacyMessages}><summary>查看早期对话（{legacyMessages.length}）</summary>{legacyMessages.map(item=><div key={item.id} className={item.role==='user'?styles.question:styles.legacyAnswer}><Typography.Text type="secondary">{item.role==='user'?'你':'助手'} · {dayjs(item.createdAt).format('MM-DD HH:mm')}</Typography.Text><Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{item.role==='assistant'?displayMessage(item.content):item.content}</Typography.Paragraph></div>)}</details>}
     {turns.map(({run,index,user,assistant})=><article key={run.id} className={styles.turn} data-testid={'agent-conversation-turn-'+run.id}>
      {(user||hasPending&&run.id===pendingRunId)&&<div className={styles.question}><span className={styles.questionLabel}>你 · {user?dayjs(user.createdAt).format('HH:mm'):'刚刚'}</span><Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{user?.content??pendingQuestion}</Typography.Paragraph></div>}
      <button type="button" className={styles.answerPreview} data-selected={workspace.runId===run.id} onClick={()=>selectRun(run.id)} aria-label={'查看第'+(index+1)+'轮分析结果'} aria-pressed={workspace.runId===run.id}>
       <span className={styles.answerPreviewMeta}><span><span aria-hidden>✦</span> 助手</span><Tag color={runStatusColor(run)}>{runStatusLabel(run)}</Tag></span>
       <span className={styles.answerPreviewText}>{runAnswerSummary(run)||(assistant&&displayMessage(assistant.content))||(run.status==='failed'?(run.steps.some(step=>step.facts?.length)?'数据已查到，智能解读未完成。请查看保留结果。':run.errorMessage??'本次未完成，请查看结果。'):run.steps.length?'已取得部分结果，正在继续处理。':'正在理解问题并准备查询。')}</span>
       <span className={styles.answerPreviewLink}>{workspace.runId===run.id?'正在查看此轮结果':'查看此轮结果'}<span aria-hidden> ↗</span></span>
      </button>
     </article>)}
     {hasPending&&!pendingRunId&&<div className={styles.question}><span className={styles.questionLabel}>你 · 刚刚</span><Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{pendingQuestion}</Typography.Paragraph></div>}
     {workspace.executionExpired&&<Alert type="warning" title="执行超过时限" description="已返回的事实和草稿仍可查看。"/>}
     {(workspace.submitting||workspace.running)&&<div className={styles.liveProgress} role="status"><div className={styles.progressHeading}><Spin size="small"/><Typography.Text>{workspace.progressMessage||'正在处理你的问题'}</Typography.Text><Typography.Text type="secondary">已等待 {workspace.elapsed} 秒</Typography.Text></div>{!!liveRun?.steps.length&&<ol className={styles.progressSteps} aria-label="正在执行的业务步骤">{liveRun.steps.slice(-4).map(step=><li key={step.id} data-status={step.status}><span className={styles.progressNode} aria-hidden>{step.status==='completed'?<CheckOutlined/>:step.status==='failed'?<CloseOutlined/>:<span/>}</span><span>{agentStepLabel(step.tool)}</span><small>{step.status==='completed'?'完成':step.status==='failed'?'失败':'进行中'}</small></li>)}</ol>}</div>}
    </div>
    {unread&&<div className={styles.newMessage}><Button size="small" icon={<ArrowDownOutlined/>} onClick={scrollLatest}>查看新消息</Button></div>}
    </div>
    {workspace.canChat&&<section className={styles.composer} id="agent-composer" data-testid="agent-composer" aria-label="问题输入区">
     {workspace.detail?.session.id===workspace.sessionId&&!workspace.sessionEditable&&!busy?<Alert type="info" title="此会话仅可查看，请新建会话提问。"/>:<>
      <div className={styles.composerInput}>
       <Input.TextArea id="agent-question-input" aria-label="Agent问题" aria-describedby="agent-composer-hint" autoSize={{minRows:2,maxRows:4}} maxLength={4000} placeholder={workspace.submitting||workspace.running?'可以先写下一问，本轮结束后发送……':workspace.financeMode?'例如：收入和费用有什么变化？':workspace.publicMode?'例如：哪些课程学习活跃度偏低？':'问一个问题，或继续追问……'} value={prompt} disabled={navigating||!workspace.sessionEditable} onChange={event=>updatePrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){event.preventDefault();void send();}}}/>
      </div>
      <div className={styles.composerFooter} data-testid="agent-composer-footer"><Typography.Text className={styles.composerHint} id="agent-composer-hint" type="secondary">{workspace.submitting||workspace.running?'正在分析，可先起草或查看历史':'Ctrl + Enter 发送 · 正式操作由你确认'}{!workspace.writable?' · 只读':''}</Typography.Text><Button type="primary" icon={<SendOutlined/>} aria-label="发送Agent问题" loading={workspace.submitting||workspace.running} disabled={busy||!workspace.sessionEditable||!prompt.trim()||!workspace.datasetId||!validation.success||workspace.capability?.status!=='ready'} onClick={()=>void send()}>发送</Button></div>
     </>}
    </section>}
   </section>
   <section className={styles.resultPane} aria-label="本轮分析结果" data-testid="agent-result-pane">
    <div className={styles.paneHeading}><span><span className={styles.paneNumber} aria-hidden>02</span>本轮分析结果</span>{workspace.selectedRun&&<Typography.Text type="secondary">{dayjs(workspace.selectedRun.startedAt).format('MM-DD HH:mm')}</Typography.Text>}</div>
    <div className={styles.resultScroll}>
     {workspace.loading||workspace.loadingSession?<div className={styles.feedLoading}><Spin/><Typography.Text type="secondary">正在读取结果</Typography.Text></div>:workspace.selectedRun?<>
      {currentUser&&<div className={styles.resultQuestion}><Typography.Text type="secondary">所选问题</Typography.Text><Typography.Paragraph ellipsis={{rows:2,expandable:true,symbol:'完整问题'}}>{currentUser.content}</Typography.Paragraph></div>}
      <RunDetails key={workspace.selectedRun.id} run={workspace.selectedRun} scope={resultScope} learningScope={resultLearning} financeScope={resultFinance} datasetId={workspace.selectedRun.context?.datasetId??workspace.detail?.session.datasetId??workspace.datasetId} sourceName={resultDataset?.name} sourceOrigin={resultDataset?.origin} tools={tools} writable={workspace.writable} busy={busy} question={currentUser?.content??''} scopeStatus={scopeStatus} canContinue={workspace.sessionEditable&&workspace.canChat&&workspace.capability?.status==='ready'} onContextAction={handleContextAction} onConfirm={startConfirmation} onFollowUp={followUp} onConfirmAction={workspace.confirmAction} onEditAction={workspace.editAction} onRetry={()=>currentUser?followUp(currentUser.content):focusComposer()} onRetryInterpretation={workspace.sessionEditable&&workspace.canChat&&workspace.capability?.status==='ready'?()=>void workspace.retryInterpretation(workspace.selectedRun!):undefined} onSelectRun={selectRun}/>
     </>:<div className={styles.resultEmpty}><VisualArtwork name="agent" className={styles.emptyArtwork} sizes="(max-width: 767px) 240px, 340px" alt="半透明曲面与相互连接的分析结构"/><span className={styles.emptyKicker}>让数据连接行动</span><Typography.Title level={4}>分析结果会显示在这里</Typography.Title><Typography.Text type="secondary">从对话开始，在这里展开数字、<br/>操作计划和每一项数据依据。</Typography.Text><div className={styles.emptyLegend} aria-hidden><span>问题</span><i/><span>依据</span><i/><span>行动</span></div></div>}
    </div>
   </section>
  </div>
  <Drawer title="历史会话" open={historyOpen} onClose={()=>setHistoryOpen(false)} size={420}>
   <Select aria-label="Agent会话" style={{width:'100%'}} placeholder="搜索已保存会话" showSearch optionFilterProp="label" value={workspace.sessionId||undefined} loading={workspace.loading} disabled={navigating} options={workspace.sessions.map(item=>({value:item.id,label:item.title+' · '+dayjs(item.updatedAt).format('MM-DD HH:mm')}))} onChange={selectSession}/>
   <div className={styles.sessionList}>{workspace.sessions.map(session=><button key={session.id} type="button" disabled={navigating} data-selected={session.id===workspace.sessionId} onClick={()=>selectSession(session.id)}><strong>{session.title}</strong><span>{dayjs(session.updatedAt).format('YYYY-MM-DD HH:mm')}{session.id===workspace.sessionId?' · 当前会话':''}</span></button>)}</div>
   {!workspace.sessions.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无已保存会话"/>}
   {!!workspace.runs.length&&<div className={styles.runPicker}><Typography.Text type="secondary">当前会话的分析结果</Typography.Text><Select aria-label="Agent执行结果" style={{width:'100%'}} value={workspace.runId||undefined} disabled={navigating} options={workspace.runs.map((run,index)=>({value:run.id,label:'第 '+(index+1)+' 次 · '+dayjs(run.startedAt).format('MM-DD HH:mm')+' · '+runStatusLabel(run)}))} onChange={id=>{selectRun(id);setHistoryOpen(false);}}/></div>}
  </Drawer>
  {rangeOpen&&<RangeEditor open workspace={workspace} onClose={()=>setRangeOpen(false)} onApply={applyRange}/>}
  <Modal title="确认发布运营标签" open={!!target} onCancel={()=>{if(!workspace.confirming)setTarget(null);}} confirmLoading={workspace.confirming} okText="确认发布此版本" cancelText="返回核对" okButtonProps={{disabled:!canConfirm}} onOk={async()=>{if(!target||!canConfirm)return;if(await workspace.confirm({runId:target.runId,proposalId:target.proposalId,version:target.version,previewToken:target.previewToken})){setTarget(null);message.success('标签已发布，可以继续保存人群。');}}}>
   <Flex vertical gap={12}><Typography.Text strong>{target?.name} · v{target?.version}</Typography.Text><Typography.Paragraph style={{margin:0}}>{target?.ruleSummary}</Typography.Paragraph><Typography.Text>覆盖 {target?.count} 人 · 未知／无法判断 {target?.unknownCount??'—'} 人</Typography.Text><Typography.Text type="secondary">{target?.scope.startDate} 至 {target?.scope.endDate}</Typography.Text><Typography.Text type="secondary">校区：{target?.scope.campusIds.length?names(target.scope.campusIds):'全部'} · 课程：{target?.scope.courseIds.length?names(target.scope.courseIds):'全部'}</Typography.Text><Typography.Text type="secondary">渠道：{target?.scope.channelIds.length?names(target.scope.channelIds):'全部（含未知）'} · 截止：{target?.scope.dataCutoff?dayjs(target.scope.dataCutoff).format('YYYY-MM-DD HH:mm:ss'):'数据集截止'}</Typography.Text><Typography.Text type="secondary">发布此规则版本，不会自动保存人群；规则或数据变化后需重新预览。</Typography.Text></Flex>
  </Modal>
 </Workspace>;
}
