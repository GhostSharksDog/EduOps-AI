'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,Button,Collapse,Empty,Input,Pagination,Segmented,Skeleton,Tag,Typography} from 'antd';
import {ArrowRightOutlined,CheckSquareOutlined,ClockCircleOutlined,FileTextOutlined,QuestionCircleOutlined,ReloadOutlined,SearchOutlined,SolutionOutlined} from '@ant-design/icons';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuthStore} from '@/modules/identity/client';
import type {WorkbenchItem,WorkbenchKind,WorkbenchQuery,WorkbenchResult} from '@/shared/contracts/workbench';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import {Workspace,WorkspacePane,WorkspaceSplit,WorkspaceToolbar} from '@/shared/ui/Workspace';
import VisualArtwork from '@/shared/ui/VisualArtwork';
import {getWorkbenchEntries,getWorkbenchQuickEntries,workbenchGroups,type WorkbenchEntry} from './config/menuConfig';
import styles from './WorkbenchPage.module.css';

type View='work'|'tools';
type MobilePane='todos'|'recent';
interface LocationState {view:View;q:string;type:WorkbenchQuery['type'];page:number;mobilePane:MobilePane;}
const types=['all','task','plan','material'] as const;
const typeLabels={all:'全部',task:'任务',plan:'方案',material:'材料'};
const kindLabels:Record<WorkbenchKind,string>={task:'决策任务',plan:'操作方案',material:'业务知识',analysis:'智能分析',report:'报告',tag:'运营标签',segment:'已保存人群'};

function readLocation(params:URLSearchParams):LocationState {
 const type=params.get('type'),page=Number(params.get('page')??1);
 return {view:params.get('view')==='tools'?'tools':'work',q:(params.get('q')??'').slice(0,100),type:types.includes(type as WorkbenchQuery['type'])?type as WorkbenchQuery['type']:'all',page:Number.isInteger(page)&&page>=1&&page<=1000?page:1,mobilePane:params.get('mobilePane')==='recent'?'recent':'todos'};
}
function address(state:LocationState){
 const query=new URLSearchParams();
 if(state.view==='tools')query.set('view','tools');
 if(state.q)query.set('q',state.q);
 if(state.type!=='all')query.set('type',state.type);
 if(state.page!==1)query.set('page',String(state.page));
 if(state.mobilePane!=='todos')query.set('mobilePane',state.mobilePane);
 return '/dashboard/workbench'+(query.size?'?'+query.toString():'');
}
function timeLabel(value:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'时间未知':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
function safeHref(value:string){return /^\/dashboard(?:\/[^\s]*)?(?:\?[^\s]*)?$/.test(value)&&!value.startsWith('//')?value:'/dashboard/workbench';}
function itemTone(item:WorkbenchItem){
 if(item.overdue)return 'error';
 if(/fail|expired|stale|blocked|pending|review/.test(item.status))return 'warning';
 if(/completed|published|ready|approved/.test(item.status))return 'success';
 return undefined;
}
function ItemRow({item,recent=false}:{item:WorkbenchItem;recent?:boolean}){
 const title=<Typography.Paragraph className={styles.itemTitle} ellipsis={{rows:2,expandable:true,symbol:'展开'}}>{item.title||kindLabels[item.kind]}</Typography.Paragraph>;
 return <article className={`${styles.item} ${recent?styles.recentItem:''}`} data-workbench-item={item.kind} data-object-id={item.id} data-state={item.overdue?'overdue':itemTone(item)??'default'}>
  <span className={styles.itemIcon} data-kind={item.kind} aria-hidden="true">{item.kind==='task'?<CheckSquareOutlined/>:item.kind==='plan'?<SolutionOutlined/>:item.kind==='material'||item.kind==='report'?<FileTextOutlined/>:<ClockCircleOutlined/>}</span>
  <div className={styles.itemContent}>
   {recent&&<div className={styles.coverType}><span>{kindLabels[item.kind]}</span><span aria-hidden="true">{item.version!==undefined?'V'+item.version:'↗'}</span></div>}
   <div className={styles.itemHeading}>{title}<Tag color={itemTone(item)} className={styles.status}>{item.overdue?'已逾期':item.statusLabel}</Tag></div>
   <div className={styles.itemMeta}>
    <span>{recent?kindLabels[item.kind]:item.dueDate?'期限 '+item.dueDate.slice(0,10):'更新 '+timeLabel(item.updatedAt)}</span>
    {recent&&<span>{timeLabel(item.updatedAt)}</span>}
    {item.version!==undefined&&<span>v{item.version}</span>}
   </div>
   {(item.dataset||item.periodLabel)&&<div className={styles.itemContext}>{item.dataset&&<><span className={styles.origin} data-origin={item.dataset.origin}>{item.dataset.origin==='simulated'?'模拟数据':'公开数据'}</span><span className={styles.datasetName} title={item.dataset.name}>{item.dataset.name}</span></>}{item.periodLabel&&<span className={styles.period} title={item.periodLabel}>{item.periodLabel}</span>}</div>}
  </div>
  <Link className={styles.itemAction} href={safeHref(item.href)} aria-label={(item.canAct?item.actionLabel:'查看')+'：'+(item.title||kindLabels[item.kind])}>{recent?<ArrowRightOutlined/>:<>{item.canAct?item.actionLabel:'查看'}<ArrowRightOutlined/></>}</Link>
 </article>;
}
function ToolLink({entry}:{entry:WorkbenchEntry}){
 return <Link href={entry.path} className={styles.toolLink} data-entry-key={entry.key}><span className={styles.toolIcon}>{entry.icon}</span><div><strong>{entry.title}</strong><p>{entry.description}</p></div><ArrowRightOutlined/></Link>;
}

export default function WorkbenchPage(){
 const api=useBusinessApi(),params=useSearchParams(),search=params.toString();
 const role=useAuthStore(state=>state.user?.role),identity=useAuthStore(state=>state.user?.id),company=useAuthStore(state=>state.user?.companyCode??state.user?.ownedBy);
 const location=useMemo(()=>readLocation(new URLSearchParams(search)),[search]);
 const [searchInput,setSearchInput]=useState(location.q),[expanded,setExpanded]=useState<string[]>(()=>workbenchGroups.filter(group=>!group.defaultCollapsed).map(group=>group.key));
 const [response,setResponse]=useState<{key:string;data:WorkbenchResult}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const development=process.env.NODE_ENV==='development';
 const entries=useMemo(()=>getWorkbenchEntries(role,development),[role,development]);
 const quickEntries=useMemo(()=>getWorkbenchQuickEntries(role,development),[role,development]);
 const queryKey=[company,identity,location.type,location.page].join(':');
 const data=response?.key===queryKey?response.data:null;
 const query=location.q.trim().toLocaleLowerCase();
 const filtered=useMemo(()=>[...entries,...(query?quickEntries.filter(entry=>entry.group==='common'):[])].filter(entry=>!query||(entry.title+' '+entry.description).toLocaleLowerCase().includes(query)),[entries,quickEntries,query]);
 const groups=workbenchGroups.filter(group=>filtered.some(entry=>entry.group===group.key));
 const commonMatches=filtered.filter(entry=>entry.group==='common');

 const updateAddress=useCallback((patch:Partial<LocationState>,replace=false)=>{
  const current=readLocation(new URLSearchParams(window.location.search)),next=address({...current,...patch});
  if(window.location.pathname+window.location.search!==next)window.history[replace?'replaceState':'pushState'](null,'',next);
 },[]);
 // A workbench is company-wide personal work, not the scope or object from its referring page.
 useEffect(()=>{const target=address(location);if(window.location.pathname+window.location.search!==target)window.history.replaceState(null,'',target);},[location]);
 useEffect(()=>setSearchInput(location.q),[location.q]);
 useEffect(()=>{
  if(searchInput===location.q)return;
  const timer=window.setTimeout(()=>updateAddress({q:searchInput,view:searchInput.trim()?'tools':location.view},true),280);
  return()=>window.clearTimeout(timer);
 },[searchInput,location.q,location.view,updateAddress]);
 useEffect(()=>{
  if(location.view!=='work'){setLoading(false);return;}
  const controller=new AbortController();let active=true;
  setLoading(true);setError('');
  api<WorkbenchResult>('/api/workbench?'+new URLSearchParams({type:location.type,page:String(location.page)}),undefined,'GET',controller.signal)
   .then(result=>{if(active)setResponse({key:queryKey,data:result});})
   .catch(e=>{if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'暂时无法读取个人工作，请重试。');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[api,queryKey,location.type,location.page,location.view,revision]);
 useEffect(()=>{
  if(!data||data.todos.status!=='ready'||data.todos.total===null)return;
  const lastPage=Math.max(1,Math.ceil(data.todos.total/10));
  if(location.page>lastPage)updateAddress({page:lastPage},true);
 },[data,location.page,updateAddress]);

 const refresh=()=>setRevision(value=>value+1);
 const retry=<Button size="small" onClick={refresh} loading={loading} icon={<ReloadOutlined/>}>重试</Button>;
 const counts=data?.counts;
 const filterOptions=types.map(type=>({value:type,label:<span className={styles.filterLabel}>{typeLabels[type]}<span>{counts?.[type]??'—'}</span></span>}));
 const sourcesFailed=!!data&&Object.values(data.sources).some(source=>source.status==='error');
 const noDataLoading=loading&&!data;

 return <Workspace fit label="独立工作台" className={styles.workspace} data-testid="workbench-workspace" data-spatial-enter>
  <WorkspaceToolbar title="工作台" className={styles.toolbar} actions={<><Button size="small" icon={<ReloadOutlined/>} onClick={refresh} loading={loading} aria-label="刷新个人工作" disabled={location.view==='tools'}/><Link className={styles.help} href="/dashboard/help#workbench"><QuestionCircleOutlined/><span>帮助</span></Link></>}>
   <div className={styles.toolbarControls}><Segmented aria-label="工作台视图" value={location.view} options={[{label:'我的工作',value:'work'},{label:'全部功能',value:'tools'}]} onChange={value=>updateAddress({view:value as View,...(value==='work'?{q:''}:{})})}/><Input className={styles.search} aria-label="搜索功能" prefix={<SearchOutlined/>} placeholder="查找功能" value={searchInput} maxLength={100} allowClear onChange={event=>setSearchInput(event.target.value)} onPressEnter={()=>updateAddress({view:'tools',q:searchInput},true)}/></div>
  </WorkspaceToolbar>

  <nav className={styles.quickLinks} aria-label="常用功能" data-testid="quick-links">
   {quickEntries.map((entry,index)=><Link key={entry.key} href={entry.path} className={styles.quickLink} data-entry-key={entry.key} data-featured={index<2||undefined} data-spatial-hover>{index===0&&<VisualArtwork name="workbench" className={styles.quickArtwork} sizes="(max-width: 767px) 180px, 360px" alt=""/>}<span className={styles.quickIcon}>{entry.icon}</span><span className={styles.quickCopy}><strong>{entry.title}</strong>{index<2&&<small>{entry.description}</small>}</span><ArrowRightOutlined className={styles.quickArrow}/></Link>)}
  </nav>

  {location.view==='work'?<>
   <Segmented className={styles.mobileTabs} aria-label="个人工作分区" block value={location.mobilePane} options={[{label:'待办',value:'todos'},{label:'最近工作',value:'recent'}]} onChange={value=>updateAddress({mobilePane:value as MobilePane},true)}/>
   {error&&<Alert type="error" showIcon title="个人工作暂时无法读取" description={data?'已有内容保留，可能不是最新状态。':error} action={retry} className={styles.pageAlert}/>}
   <WorkspaceSplit columns="minmax(0,2fr) minmax(280px,1fr)" className={styles.mainSplit}>
    <WorkspacePane className={styles.todoPane} bodyClassName={styles.todoBody} data-active={location.mobilePane==='todos'} title="待处理事项" actions={<span className={styles.muted}>只显示与我有关的记录</span>} data-testid="workbench-todos" aria-label="我的待办" footer={data&&data.todos.status!=='error'?<div className={styles.pagination}><span className={styles.muted}>{data.todos.total===null?'部分来源未读到，总数暂不确定':data.todos.total+' 项待办'}</span>{data.todos.total===null?<div className={styles.unknownPaging}><Button size="small" disabled={location.page===1||loading} onClick={()=>updateAddress({page:location.page-1})}>上一页</Button><span>第 {location.page} 页</span><Button size="small" disabled={data.todos.items.length<10||location.page>=1000||loading} onClick={()=>updateAddress({page:location.page+1})}>下一页</Button></div>:<Pagination size="small" current={location.page} pageSize={10} total={data.todos.total} showSizeChanger={false} hideOnSinglePage disabled={loading} onChange={page=>updateAddress({page})}/>}</div>:undefined}>
     <div className={styles.todoFilters}><Segmented aria-label="待办类型" value={location.type} options={filterOptions} onChange={value=>updateAddress({type:value as WorkbenchQuery['type'],page:1})}/></div>
     {noDataLoading?<div className={styles.skeleton}><Skeleton active paragraph={{rows:3}}/><Skeleton active paragraph={{rows:3}}/></div>:data?<>
      {data.todos.status!=='ready'&&<Alert className={styles.sectionAlert} type={data.todos.status==='error'?'error':'warning'} showIcon title={data.todos.status==='error'?'待办读取失败':'部分待办暂未读到'} description={data.todos.message??'可先查看已读取的记录，重试后更新。'} action={retry}/>}
      {!!data.todos.items.length?<div className={styles.itemList} aria-busy={loading}>{data.todos.items.map(item=><ItemRow key={item.kind+':'+item.id} item={item}/>)}</div>:data.todos.status==='ready'?<div className={styles.empty}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={location.type==='all'?'暂无待处理事项':'暂无待处理'+typeLabels[location.type]}><Link href="/dashboard/agent">开始一次智能分析<ArrowRightOutlined/></Link></Empty></div>:null}
     </>:!error?<div className={styles.empty}><Skeleton active/></div>:null}
    </WorkspacePane>
    <WorkspacePane className={styles.recentPane} bodyClassName={styles.recentBody} data-active={location.mobilePane==='recent'} title="最近工作" actions={<span className={styles.muted}>已保存记录 · 最多6条</span>} data-testid="workbench-recent" aria-label="我的最近工作">
     {noDataLoading?<div className={styles.skeleton}><Skeleton active paragraph={{rows:3}}/><Skeleton active paragraph={{rows:3}}/></div>:data?<>
      {data.recent.status!=='ready'&&<Alert className={styles.sectionAlert} type={data.recent.status==='error'?'error':'warning'} showIcon title={data.recent.status==='error'?'最近工作读取失败':'部分最近工作暂未读到'} description={data.recent.message??'可以继续查看已读取的工作，或重新读取。'} action={retry}/>}
      {!!data.recent.items.length?<div className={styles.itemList} aria-busy={loading}>{data.recent.items.slice(0,6).map(item=><ItemRow key={item.kind+':'+item.id} item={item} recent/>)}</div>:data.recent.status==='ready'?<div className={styles.empty}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有已保存的工作记录"/></div>:null}
      {sourcesFailed&&data.recent.status==='ready'&&<p className={styles.partialNote}>部分来源尚未读到，当前列表可能不完整。</p>}
     </>:null}
    </WorkspacePane>
   </WorkspaceSplit>
  </>:<WorkspacePane title={query?'功能搜索结果':'全部功能'} className={styles.toolsPane} bodyClassName={styles.toolsBody} data-testid="workbench-tools" aria-label="全部功能目录" actions={<span className={styles.muted}>{filtered.length} 个可用入口</span>}>
   {!filtered.length?<div className={styles.empty}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的功能"><Button onClick={()=>{setSearchInput('');updateAddress({q:''},true);}}>清除搜索</Button></Empty></div>:<>
    {!!commonMatches.length&&<section className={styles.commonResults} aria-label="匹配的常用功能"><h3>常用功能</h3><div className={styles.toolGrid}>{commonMatches.map(entry=><ToolLink key={entry.key} entry={entry}/>)}</div></section>}
    <Collapse className={styles.groups} ghost activeKey={query?groups.map(group=>group.key):expanded} onChange={keys=>{if(!query)setExpanded(Array.isArray(keys)?keys:[keys]);}} items={groups.map(group=>({key:group.key,label:<div className={styles.groupTitle}><strong>{group.title}</strong><span>{group.description}</span></div>,children:<div className={styles.toolGrid}>{filtered.filter(entry=>entry.group===group.key).map(entry=><ToolLink key={entry.key} entry={entry}/>)}</div>}))}/>
   </>}
  </WorkspacePane>}
 </Workspace>;
}
