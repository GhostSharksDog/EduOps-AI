'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, App, Button, Card, Collapse, Drawer, Empty, Flex, Form, Input, Select, Skeleton, Tag, Typography, Upload} from 'antd';
import {FileTextOutlined, ImportOutlined} from '@ant-design/icons';
import {useSearchParams} from 'next/navigation';
import {Workspace,WorkspaceToolbar,WorkspaceSplit,WorkspacePane} from '@/shared/ui/Workspace';
import styles from './KnowledgeWorkspace.module.css';
import {useAuthStore} from '@/modules/identity/client';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import MarkdownContent from '@/shared/ui/MarkdownContent';
import {useUnsavedChanges, readEditBuffer, writeEditBuffer, clearEditBuffer} from '@/shared/ui/use-unsaved-changes';
import type {CapabilityResult} from '@/shared/contracts/analysis';
import type {ReportVO} from '@/modules/report/contracts';
import type {CreateKnowledgeSourceDTO, KnowledgeCapabilityVO, KnowledgeKind, KnowledgeSearchResultVO, KnowledgeSource} from '../contracts';
import {knowledgeExamples} from '../domain/examples';

const labels: Record<KnowledgeKind, string> = {definition:'指标与字段说明', procedure:'运营制度', analysis_snapshot:'历史分析摘要', reviewed_case:'审核案例'};
const statuses = {draft:'待审核', approved:'审核通过', superseded:'历史版本'};
const indexes = {pending:'待准备', indexing:'正在准备', ready:'可用于问答', failed:'准备失败'};
interface SourceForm {title:string; kind:KnowledgeKind; content:string; reportId?:string;}
type Editor = {open:boolean; base:KnowledgeSource|null; editing?:boolean};
type Buffer = {editor:Editor; values:SourceForm};

export default function Page() {
 const {message, modal} = App.useApp(), api = useBusinessApi();
 const params=useSearchParams();
 const token = useAuthStore(s => s.token), role = useAuthStore(s => s.user?.role), canWrite = role === 'admin' || role === 'operator';
 const [sources, setSources] = useState<KnowledgeSource[]>([]), [capability, setCapability] = useState<CapabilityResult<KnowledgeCapabilityVO>|null>(null);
 const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [indexingId, setIndexingId] = useState('');
 const [searching, setSearching] = useState(false), [query, setQuery] = useState(''), [result, setResult] = useState<KnowledgeSearchResultVO|null>(null), [searchMessage, setSearchMessage] = useState(''), [searchFailed, setSearchFailed] = useState(false);
 const [editor, setEditor] = useState<Editor>({open:false, base:null}), [selected, setSelected] = useState<KnowledgeSource|null>(null), [dirty, setDirty] = useState(false);
 const [form] = Form.useForm<SourceForm>(), kind = Form.useWatch('kind', form), content = Form.useWatch('content', form);
 const [reports, setReports] = useState<ReportVO[]>([]), [filter, setFilter] = useState(''), [kindFilter, setKindFilter] = useState<KnowledgeKind>(), [stateFilter, setStateFilter] = useState<string>();
 const [templateOpen, setTemplateOpen] = useState(false), [previewOpen, setPreviewOpen] = useState(false);
 const savingRef = useRef(false), searchRef = useRef(false), indexRef = useRef(false), viewSequence=useRef(0), viewedId=useRef<string|null>(null),viewAbort=useRef<AbortController|null>(null);
 const [viewLoading,setViewLoading]=useState(false),[viewError,setViewError]=useState(''),[detailOpen,setDetailOpen]=useState(false),[searchOpen,setSearchOpen]=useState(false);
 const updateAddress=(id:string|null)=>{const url=new URL(window.location.href);if(id)url.searchParams.set('sourceId',id);else url.searchParams.delete('sourceId');if(url.href!==window.location.href)window.history.pushState(null,'',url);};
 const request = useCallback(async <T,>(path:string, method='GET', body?:unknown,signal?:AbortSignal):Promise<T> => api<T>('/api/knowledge'+path, body, method,signal), [api]);
 const refresh = useCallback(async () => {
  setLoading(true);
  try {
   setError('');
   const [list, cap] = await Promise.all([request<KnowledgeSource[]>('/sources'), fetch('/api/knowledge', {headers:{Authorization:'Bearer '+token}}).then(r => r.json())]);
   setSources(list ?? []); setCapability(cap);
  } catch(e) {setError((e as Error).message);} finally {setLoading(false);}
 }, [request, token]);
 useEffect(() => {
  void refresh();
  const buffer = readEditBuffer<Buffer>('knowledge');
  if(buffer && canWrite) {setEditor(buffer.editor); setDetailOpen(true); setDirty(true); form.setFieldsValue(buffer.values);}
  return()=>{++viewSequence.current;viewAbort.current?.abort();viewedId.current=null;};
 }, [refresh, request, form, canWrite]);
 useEffect(() => {
  if(kind === 'analysis_snapshot' && editor.open) api<ReportVO[]>('/api/reports').then(rows => setReports(rows.filter(r => r.status === 'completed'))).catch(e => message.error(e.message));
 }, [kind, editor.open, api, message]);

 const closeEditor = () => {setEditor({open:false, base:null}); setDirty(false); setTemplateOpen(false); setPreviewOpen(false); clearEditBuffer('knowledge');};
 async function save():Promise<boolean> {
  if(savingRef.current) return false;
  let values:SourceForm;
  try {values = await form.validateFields();} catch {return false;}
  savingRef.current = true; setSaving(true);
  try {
   const base = editor.base; let saved:KnowledgeSource;
   if(editor.editing && base) saved = await request('/sources/'+base.id, 'PATCH', {title:values.title, content:values.content, expectedContentHash:base.contentHash});
   else {
    const latest = base ? Math.max(Number(base.version),...sources.filter(s => s.logicalSourceId === base.logicalSourceId).map(s => Number(s.version))) : undefined;
    const input:CreateKnowledgeSourceDTO = {title:values.title, kind:values.kind, content:values.content, evidence:base?.evidence ?? [], ...(base ? {logicalSourceId:base.logicalSourceId, expectedVersion:latest, period:base.period, dataCutoff:base.dataCutoff} : {}), ...(values.kind === 'analysis_snapshot' && values.reportId ? {reportId:values.reportId} : {})};
    saved = await request('/sources', 'POST', input);
   }
   closeEditor(); viewedId.current=saved.id; setSelected(saved); setDetailOpen(true); updateAddress(saved.id); message.success('草稿已保存，请核对并审核。'); await refresh(); return true;
  } catch(e) {message.error((e as Error).message); return false;} finally {savingRef.current = false; setSaving(false);}
 }
 const protect = useUnsavedChanges(dirty && editor.open, save, '知识正文', () => {setDirty(false); clearEditBuffer('knowledge');});
 function openCreate(base:KnowledgeSource|null=null, editing=false) {
  ++viewSequence.current;viewAbort.current?.abort();setViewError('');setViewLoading(false);setDetailOpen(true);setSelected(null); setEditor({open:true, base, editing}); setDirty(false); setTemplateOpen(false); setPreviewOpen(false); clearEditBuffer('knowledge');
  form.resetFields(); form.setFieldsValue({title:base?.title ?? '', kind:base?.kind ?? 'definition', content:base?.content ?? ''});
 }
 function markDirty() {setDirty(true); writeEditBuffer('knowledge', {editor, values:form.getFieldsValue(true)});}
 async function importText(file:File) {
  if(!/\.(txt|md|markdown)$/i.test(file.name) || file.size > 80000) {message.error('请选择不超过80KB的UTF-8文本或Markdown文件。'); return Upload.LIST_IGNORE;}
  try {
   const text = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer());
   if(!text.trim() || text.length > 20000) throw new Error('正文应为1至20,000字符。');
   form.setFieldsValue({content:text, title:form.getFieldValue('title') || file.name.replace(/\.(txt|md|markdown)$/i, '').slice(0, 160)});
   markDirty(); message.success('已读入 '+file.name+'，请核对正文。');
  } catch(e) {message.error((e as Error).message);} return Upload.LIST_IGNORE;
 }
 function applyTemplate(title:string) {
  const example = knowledgeExamples.find(e => e.title === title && e.kind === kind);
  if(!example) return;
  const apply = () => {form.setFieldsValue({title:example.title, content:example.content}); markDirty(); setTemplateOpen(false);};
  if(form.getFieldValue('content')?.trim()) modal.confirm({title:'使用模板替换当前正文？', content:'标题和正文将替换为所选示例，类别不变。', okText:'替换内容', cancelText:'保留正文', onOk:apply});
  else apply();
 }
 async function approve(source:KnowledgeSource) {
  if(indexRef.current) return; indexRef.current = true; setIndexingId(source.id);
  try {
   const updated = await request<KnowledgeSource>('/sources/'+source.id+'/approve', 'POST', {expectedVersion:Number(source.version), expectedContentHash:source.contentHash});
   if(viewedId.current===source.id)setSelected(updated); message.success(updated.isCurrent ? '已可用于智能分析。' : '此版本已准备完成，更新版本仍保持生效。');
  } catch(e) {
   message.error((e as Error).message);
   try {const updated=await request<KnowledgeSource>('/sources/'+source.id);if(viewedId.current===source.id)setSelected(updated);} catch {/* 保留正在核对的正文。 */}
  } finally {indexRef.current = false; setIndexingId(''); await refresh();}
 }
 function confirmApprove(source:KnowledgeSource) {
  modal.confirm({title:source.status === 'draft' ? '核对并审核此版本' : '重新准备此版本', content:`将审核“${source.title}” v${source.version}。准备成功后才切换为可检索版本；失败时已有版本继续使用。`, okText:'确认审核并准备', cancelText:'返回核对', onOk:() => approve(source)});
 }
 async function search() {
  if(searchRef.current || !query.trim()) return; searchRef.current = true; setSearching(true); setSearchMessage(''); setResult(null); setSearchFailed(false);
  try {
   const response = await request<KnowledgeSearchResultVO>('/search', 'POST', {query}); setResult(response);
   setSearchMessage(response.hits.length ? '已找到可用材料。' : '未找到相关材料，可调整问题或审核相关草稿。');
  } catch(e) {setSearchFailed(true); setSearchMessage((e as Error).message);} finally {searchRef.current = false; setSearching(false);}
 }
 const groups = useMemo(() => {
  const map = new Map<string, KnowledgeSource[]>(); sources.forEach(s => map.set(s.logicalSourceId, [...(map.get(s.logicalSourceId) ?? []), s]));
  return [...map].map(([id, versions]) => {
   versions.sort((a,b) => Number(b.version)-Number(a.version)); return {id, versions, latest:versions[0], current:versions.find(s => s.isCurrent), pending:versions.find(s => !s.isCurrent && s.status !== 'superseded' && (s.status === 'draft' || s.indexStatus !== 'ready'))};
  }).filter(g => (!filter || g.versions.some(s => s.title.toLowerCase().includes(filter.toLowerCase()))) && (!kindFilter || g.latest.kind === kindFilter) && (!stateFilter || g.versions.some(s => stateFilter === 'ready' ? s.isCurrent && s.indexStatus === 'ready' && !s.needsReindex : stateFilter === 'failed' ? s.indexStatus === 'failed' : s.status === stateFilter)));
 }, [sources, filter, kindFilter, stateFilter]);
 const view = async (id:string,changeAddress=true) => {viewAbort.current?.abort();const controller=new AbortController();viewAbort.current=controller;const current=++viewSequence.current;viewedId.current=id;setEditor({open:false,base:null});setDirty(false);setSelected(null);setViewLoading(true);setViewError('');setDetailOpen(true);if(changeAddress)updateAddress(id);try {const source=await request<KnowledgeSource>('/sources/'+encodeURIComponent(id),'GET',undefined,controller.signal);if(current===viewSequence.current)setSelected(source);} catch(e) {if(current===viewSequence.current)setViewError((e as Error).message);}finally{if(current===viewSequence.current)setViewLoading(false);}};
 useEffect(()=>{const id=params.get('sourceId');if(id&&id!==viewedId.current&&!readEditBuffer<Buffer>('knowledge'))void view(id,false);else if(!id&&!editor.open){++viewSequence.current;viewAbort.current?.abort();viewedId.current=null;setSelected(null);setViewError('');setViewLoading(false);setDetailOpen(false);}},[params,request]);
 const badges = (source:KnowledgeSource) => <Flex gap={4} wrap><Tag>{statuses[source.status]}</Tag><Tag color={source.indexStatus === 'ready' && !source.needsReindex ? 'green' : source.indexStatus === 'failed' ? 'red' : 'default'}>{source.needsReindex ? '需重新准备' : indexes[source.indexStatus]}</Tag>{source.isCurrent && <Tag color="blue">当前生效</Tag>}</Flex>;
 const usable = (source:KnowledgeSource|undefined) => !!source && source.status === 'approved' && source.isCurrent && source.indexStatus === 'ready' && !source.needsReindex;
 const indexExpired = !!selected && selected.indexStatus === 'indexing' && Date.now()-Date.parse(selected.updatedAt) >= 120000;
 const needsAction = selected && (selected.indexStatus !== 'indexing' || indexExpired) && (selected.status === 'draft' || selected.indexStatus === 'failed' || selected.needsReindex || selected.indexStatus === 'pending' || indexExpired);
 const available = sources.filter(usable).length, total = new Set(sources.map(s => s.logicalSourceId)).size;
 const groupStatus = (group:typeof groups[number]) => <Flex gap={4} wrap>{usable(group.current) ? <Tag color="green">可用 · v{group.current!.version}</Tag> : group.current ? <Tag color="orange">生效版需重新准备</Tag> : <Tag>暂无可用版</Tag>}{group.pending && <Tag color={group.pending.indexStatus === 'failed' ? 'red' : 'orange'}>{group.pending.indexStatus === 'failed' ? '准备失败' : group.pending.indexStatus === 'indexing' ? '正在准备' : group.pending.status === 'draft' ? '待审核' : '待准备'} · v{group.pending.version}</Tag>}{!group.pending && !usable(group.current) && <Tag>{indexes[group.latest.indexStatus]}</Tag>}</Flex>;

 return <Workspace className={styles.workspace} fit label="业务知识工作区">
  <WorkspaceToolbar title="业务知识" actions={<Flex gap={8} wrap><Button href="/dashboard/help#knowledge">帮助</Button><Button onClick={()=>setSearchOpen(true)}>检索测试</Button><Button loading={loading} onClick={()=>void refresh()}>刷新</Button>{canWrite&&<Button type="primary" disabled={saving} onClick={()=>protect(()=>openCreate())}>添加材料</Button>}</Flex>}/>
  {error&&<Alert type="error" title={error} action={<Button onClick={()=>void refresh()}>重新加载</Button>}/>}
  {capability?.status==='unconfigured'&&<Alert type="warning" title="材料可保存，问答准备尚未配置" action={canWrite?<Button href="/dashboard/system/diagnostics">检查配置</Button>:undefined}/>}
  {capability?.status==='error'&&<Alert type="error" title={capability.message}/>}
  <WorkspaceSplit columns="minmax(260px, 320px) minmax(0, 1fr)" className={styles.split}>
   <WorkspacePane title="材料目录" className={`${styles.catalog} ${detailOpen?styles.mobileHidden:''}`} bodyClassName={styles.catalogBody} aria-label="知识材料目录">
    <Input aria-label="知识标题搜索" placeholder="查找材料" value={filter} onChange={e=>setFilter(e.target.value)} allowClear/>
    <Flex gap={8} className={styles.filters}><Select aria-label="知识类型筛选" placeholder="全部类别" allowClear value={kindFilter} onChange={setKindFilter} style={{flex:1,minWidth:0}} options={Object.entries(labels).map(([value,label])=>({value,label}))}/><Select aria-label="知识状态筛选" placeholder="全部状态" allowClear value={stateFilter} onChange={setStateFilter} style={{width:114}} options={[{value:'ready',label:'当前可用'},{value:'draft',label:'待审核'},{value:'failed',label:'准备失败'}]}/></Flex>
    <Typography.Text type="secondary" className={styles.count}>{loading?'正在读取…':`共 ${total} 份 · ${available} 份可用`}</Typography.Text>
    {loading&&<Skeleton active paragraph={{rows:5}}/>}
    {!loading&&!groups.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filter||kindFilter||stateFilter?'没有符合筛选的材料':'添加并审核后，可用于智能分析'}/>}
    {groups.map(g=><div className={styles.group} key={g.id} data-selected={selected?.logicalSourceId===g.id||editor.base?.logicalSourceId===g.id}>
     <button type="button" className={styles.material} disabled={saving} aria-pressed={selected?.logicalSourceId===g.id} onClick={()=>protect(()=>void view((g.pending??g.current??g.latest).id))}><span className={styles.materialTitle}>{g.current?.title??g.latest.title}</span><span className={styles.materialKind}>{labels[g.latest.kind]}</span>{groupStatus(g)}<small>{new Date(g.latest.updatedAt).toLocaleDateString('zh-CN')} · {g.versions.length} 个版本</small></button>
     {g.current&&g.pending&&<Button size="small" type="link" onClick={()=>protect(()=>void view(g.current!.id))}>查看生效版 v{g.current.version}</Button>}
    </div>)}
   </WorkspacePane>
   <WorkspacePane className={`${styles.reading} ${!detailOpen?styles.mobileHidden:''}`} data-object-id={selected?.id??editor.base?.id} aria-label={editor.open?'知识编辑区':'知识阅读区'} footer={editor.open?<Flex gap={8} justify="end" wrap><Button disabled={saving} onClick={()=>protect(()=>{closeEditor();if(viewedId.current)void view(viewedId.current,false);else setDetailOpen(false);})}>取消编辑</Button><Button type="primary" loading={saving} onClick={()=>void save()}>保存并核对</Button></Flex>:selected?<Flex gap={8} wrap>{canWrite&&selected.status==='draft'&&<Button disabled={!!indexingId} onClick={()=>protect(()=>openCreate(selected,true))}>编辑草稿</Button>}{canWrite&&<Button disabled={!!indexingId} onClick={()=>protect(()=>openCreate(selected))}>创建新版</Button>}{canWrite&&selected.status!=='superseded'&&needsAction&&<Button type="primary" loading={indexingId===selected.id} onClick={()=>confirmApprove(selected)}>{selected.status==='draft'?'核对并审核':'重试准备'}</Button>}</Flex>:undefined}>
    <Button className={styles.back} onClick={()=>protect(()=>{closeEditor();++viewSequence.current;viewAbort.current?.abort();setViewLoading(false);setViewError('');setDetailOpen(false);viewedId.current=null;setSelected(null);updateAddress(null);})}>返回材料目录</Button>
    {viewLoading&&<Skeleton active title paragraph={{rows:8}}/>}
    {viewError&&<Alert type="error" title={viewError} action={<Button onClick={()=>viewedId.current&&void view(viewedId.current,false)}>重试读取</Button>}/>}
    {editor.open?<>
     <div className={styles.readerHeading}><Typography.Title level={3}>{editor.editing?'编辑材料草稿':editor.base?'创建材料新版本':'添加材料'}</Typography.Title><Typography.Text type="secondary">保存后核对正文，再审核此版本。</Typography.Text></div>
     <div className={styles.editorTabs}><Button type={!previewOpen?'primary':'default'} onClick={()=>setPreviewOpen(false)}>编辑正文</Button><Button type={previewOpen?'primary':'default'} onClick={()=>setPreviewOpen(true)}>阅读预览</Button></div>
     <Form form={form} layout="vertical" onValuesChange={markDirty} style={{display:previewOpen?'none':undefined}}>
      <Flex gap={14} wrap><Form.Item name="title" label="标题" rules={[{required:true,message:'请输入标题'}]} style={{flex:'2 1 220px'}}><Input maxLength={160}/></Form.Item><Form.Item name="kind" label="类别" rules={[{required:true,message:'请选择类别'}]} style={{flex:'1 1 180px'}}><Select disabled={!!editor.base} options={Object.entries(labels).map(([value,label])=>({value,label}))}/></Form.Item></Flex>
      {kind==='analysis_snapshot'&&!editor.base&&<Form.Item name="reportId" label="摘要来源报告" rules={[{required:true,message:'请选择成功报告，以便绑定数据依据'}]} extra="自动保留报告周期、截止时间和数据依据。"><Select aria-label="摘要来源报告" placeholder="选择已完成周报或月报" options={reports.map(r=>({value:r.id,label:(r.kind==='monthly'?'月报':'周报')+' · '+r.snapshot.dataset.name+' · '+r.snapshot.scope.startDate+' 至 '+r.snapshot.scope.endDate}))} onChange={id=>{const report=reports.find(r=>r.id===id);if(!report)return;form.setFieldsValue({content:[report.answer?.summary,...(report.answer?.hypotheses??[]).map(t=>'待验证原因：'+t),...(report.answer?.recommendations??[]).map(t=>'行动建议：'+t)].join('\n\n')});markDirty();}}/></Form.Item>}
      <Form.Item name="content" label="正文" rules={[{required:true,message:'请输入正文'}]}><Input.TextArea aria-label="知识正文" rows={14} maxLength={20000} showCount/></Form.Item>
     </Form>
     {previewOpen&&<div className={styles.prose}><MarkdownContent content={content??''}/></div>}
     <Flex gap={8} wrap><Button icon={<FileTextOutlined/>} disabled={saving||!knowledgeExamples.some(e=>e.kind===kind)} onClick={()=>setTemplateOpen(v=>!v)}>使用模板</Button><Upload accept=".txt,.md,.markdown" showUploadList={false} beforeUpload={importText} disabled={saving}><Button icon={<ImportOutlined/>}>导入文本</Button></Upload></Flex>
     {templateOpen&&<Select aria-label="示例材料" value={undefined} placeholder="选择当前类别的示例" style={{width:'100%',marginTop:12}} options={knowledgeExamples.filter(e=>e.kind===kind).map(e=>({value:e.title,label:e.title}))} onChange={applyTemplate}/>}
    </>:selected?<>
     <div className={styles.readerHeading}><Typography.Title level={3}>{selected.title}</Typography.Title><Flex gap={8} wrap>{badges(selected)}<Tag>v{selected.version}</Tag><Tag>{labels[selected.kind]}</Tag></Flex></div>
     <Select aria-label="查看知识版本" value={selected.id} style={{width:'100%',maxWidth:360,marginBottom:16}} options={sources.filter(s=>s.logicalSourceId===selected.logicalSourceId).sort((a,b)=>Number(b.version)-Number(a.version)).map(s=>({value:s.id,label:`v${s.version} · ${s.isCurrent?'当前生效':statuses[s.status]} · ${indexes[s.indexStatus]}`}))} onChange={id=>protect(()=>void view(id))}/>
     {usable(selected)&&<Alert type="success" title="已可用于智能分析" action={<Button href="/dashboard/agent">开始分析</Button>}/>}
     {selected.status==='draft'&&selected.indexStatus!=='failed'&&selected.indexStatus!=='indexing'&&<Alert type="info" title="请核对正文，再审核此版本"/>}
     {selected.indexStatus==='indexing'&&<Alert type={indexExpired?'warning':'info'} title={indexExpired?'准备已超时，可刷新状态或重试':'正在准备，请稍后刷新查看'} action={<Button onClick={()=>void view(selected.id,false)}>刷新状态</Button>}/>}
     {selected.error&&<Alert type="error" title={selected.error} description={!selected.isCurrent&&sources.some(s=>s.logicalSourceId===selected.logicalSourceId&&usable(s))?'已有生效版本继续可用。':undefined}/>}
     <div className={styles.prose}><MarkdownContent content={selected.content}/></div>
     {selected.period&&<Typography.Paragraph type="secondary">历史统计期：{selected.period.startDate} 至 {selected.period.endDate}；截止：{selected.dataCutoff}</Typography.Paragraph>}
     <details><summary>来源、版本与历史引用</summary><Typography.Paragraph>{selected.id} · v{selected.version}</Typography.Paragraph>{selected.evidence.map(e=><Typography.Paragraph key={e.id}>{e.summary}</Typography.Paragraph>)}</details>
    </>:!viewLoading&&!viewError&&<Empty className={styles.readerEmpty} description="选择左侧材料查看正文、版本与可用状态"/>}
   </WorkspacePane>
  </WorkspaceSplit>
  <Drawer title="检索测试" open={searchOpen} onClose={()=>setSearchOpen(false)} width={560}>
   <Flex vertical gap={14}><Flex gap={8}><Input aria-label="检索问题" value={query} maxLength={1000} placeholder="例如：请假是否计入应出勤？" onChange={e=>setQuery(e.target.value)} onPressEnter={()=>void search()}/><Button type="primary" disabled={!query.trim()||capability?.status!=='ready'} loading={searching} onClick={()=>void search()}>检索</Button></Flex><Typography.Text type="secondary">匹配度表示语义接近程度，不是答案准确率。</Typography.Text>{searchMessage&&(searchFailed?<Alert type="error" title={searchMessage} action={<Button loading={searching} onClick={()=>void search()}>重试</Button>}/>:<Typography.Text>{searchMessage}</Typography.Text>)}{result?.hits.map(hit=><Card key={hit.id} size="small" title={hit.title+' · v'+hit.version} extra={<Tag color="blue">匹配度 {(Math.max(0,Math.min(1,hit.similarity))*100).toFixed(1)}%</Tag>}><MarkdownContent content={hit.text}/><Button onClick={()=>protect(()=>{setSearchOpen(false);void view(hit.sourceId);})}>查看来源</Button></Card>)}{result&&!result.hits.length&&<Empty description="暂无相关知识依据"/>}<Collapse items={[{key:'explanation',label:'材料如何生效',children:<Typography.Paragraph>保存后核对正文并审核具体版本。准备成功后才用于智能分析；新版失败时保留旧版，历史来源和引用仍可查看。</Typography.Paragraph>}]}/></Flex>
  </Drawer>
 </Workspace>;
}
