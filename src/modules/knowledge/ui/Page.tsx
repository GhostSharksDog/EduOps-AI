'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, App, Button, Card, Collapse, Empty, Flex, Form, Grid, Input, Modal, Select, Table, Tag, Typography, Upload} from 'antd';
import {BookOutlined, FileTextOutlined, ImportOutlined} from '@ant-design/icons';
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
 const screens = Grid.useBreakpoint(), narrow = screens.md === false;
 const token = useAuthStore(s => s.token), role = useAuthStore(s => s.user?.role), canWrite = role === 'admin' || role === 'operator';
 const [sources, setSources] = useState<KnowledgeSource[]>([]), [capability, setCapability] = useState<CapabilityResult<KnowledgeCapabilityVO>|null>(null);
 const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [indexingId, setIndexingId] = useState('');
 const [searching, setSearching] = useState(false), [query, setQuery] = useState(''), [result, setResult] = useState<KnowledgeSearchResultVO|null>(null), [searchMessage, setSearchMessage] = useState(''), [searchFailed, setSearchFailed] = useState(false);
 const [editor, setEditor] = useState<Editor>({open:false, base:null}), [selected, setSelected] = useState<KnowledgeSource|null>(null), [dirty, setDirty] = useState(false);
 const [form] = Form.useForm<SourceForm>(), kind = Form.useWatch('kind', form), content = Form.useWatch('content', form);
 const [reports, setReports] = useState<ReportVO[]>([]), [filter, setFilter] = useState(''), [kindFilter, setKindFilter] = useState<KnowledgeKind>(), [stateFilter, setStateFilter] = useState<string>();
 const [templateOpen, setTemplateOpen] = useState(false), [previewOpen, setPreviewOpen] = useState(false);
 const savingRef = useRef(false), searchRef = useRef(false), indexRef = useRef(false);
 const request = useCallback(async <T,>(path:string, method='GET', body?:unknown):Promise<T> => api<T>('/api/knowledge'+path, body, method), [api]);
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
  if(buffer && canWrite) {setEditor(buffer.editor); setDirty(true); form.setFieldsValue(buffer.values);}
  const id = new URLSearchParams(window.location.search).get('sourceId');
  if(id) request<KnowledgeSource>('/sources/'+encodeURIComponent(id)).then(setSelected).catch(e => setError(e.message));
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
    const latest = base ? Math.max(...sources.filter(s => s.logicalSourceId === base.logicalSourceId).map(s => Number(s.version))) : undefined;
    const input:CreateKnowledgeSourceDTO = {title:values.title, kind:values.kind, content:values.content, evidence:base?.evidence ?? [], ...(base ? {logicalSourceId:base.logicalSourceId, expectedVersion:latest, period:base.period, dataCutoff:base.dataCutoff} : {}), ...(values.kind === 'analysis_snapshot' && values.reportId ? {reportId:values.reportId} : {})};
    saved = await request('/sources', 'POST', input);
   }
   closeEditor(); setSelected(saved); message.success('草稿已保存，请核对并审核。'); await refresh(); return true;
  } catch(e) {message.error((e as Error).message); return false;} finally {savingRef.current = false; setSaving(false);}
 }
 const protect = useUnsavedChanges(dirty && editor.open, save, '知识正文', () => {setDirty(false); clearEditBuffer('knowledge');});
 function openCreate(base:KnowledgeSource|null=null, editing=false) {
  setSelected(null); setEditor({open:true, base, editing}); setDirty(false); setTemplateOpen(false); setPreviewOpen(false); clearEditBuffer('knowledge');
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
   setSelected(updated); message.success(updated.isCurrent ? '已可用于智能分析。' : '此版本已准备完成，更新版本仍保持生效。');
  } catch(e) {
   message.error((e as Error).message);
   try {setSelected(await request('/sources/'+source.id));} catch {/* 保留正在核对的正文。 */}
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
 const view = async (id:string) => {try {setSelected(await request('/sources/'+id));} catch(e) {message.error((e as Error).message);}};
 const badges = (source:KnowledgeSource) => <Flex gap={4} wrap><Tag>{statuses[source.status]}</Tag><Tag color={source.indexStatus === 'ready' && !source.needsReindex ? 'green' : source.indexStatus === 'failed' ? 'red' : 'default'}>{source.needsReindex ? '需重新准备' : indexes[source.indexStatus]}</Tag>{source.isCurrent && <Tag color="blue">当前生效</Tag>}</Flex>;
 const usable = (source:KnowledgeSource|undefined) => !!source && source.status === 'approved' && source.isCurrent && source.indexStatus === 'ready' && !source.needsReindex;
 const indexExpired = !!selected && selected.indexStatus === 'indexing' && Date.now()-Date.parse(selected.updatedAt) >= 120000;
 const needsAction = selected && (selected.indexStatus !== 'indexing' || indexExpired) && (selected.status === 'draft' || selected.indexStatus === 'failed' || selected.needsReindex || selected.indexStatus === 'pending' || indexExpired);
 const available = sources.filter(usable).length, total = new Set(sources.map(s => s.logicalSourceId)).size;
 const groupStatus = (group:typeof groups[number]) => <Flex gap={4} wrap>{usable(group.current) ? <Tag color="green">可用 · v{group.current!.version}</Tag> : group.current ? <Tag color="orange">生效版需重新准备</Tag> : <Tag>暂无可用版</Tag>}{group.pending && <Tag color={group.pending.indexStatus === 'failed' ? 'red' : 'orange'}>{group.pending.indexStatus === 'failed' ? '准备失败' : group.pending.indexStatus === 'indexing' ? '正在准备' : group.pending.status === 'draft' ? '待审核' : '待准备'} · v{group.pending.version}</Tag>}{!group.pending && !usable(group.current) && <Tag>{indexes[group.latest.indexStatus]}</Tag>}</Flex>;
 const primaryLabel = (group:typeof groups[number]) => group.pending?.status === 'draft' ? '核对草稿' : group.pending ? '处理新版' : '查看材料';

 return <Flex vertical gap={16}>
  <div className="business-page-header"><Typography.Title level={2}><BookOutlined/> 业务知识</Typography.Title><Button href="/dashboard/help#knowledge">帮助</Button></div>
  {error && <Alert type="error" title={error} action={<Button onClick={() => void refresh()}>重新加载</Button>} showIcon/>}
  {capability?.status === 'unconfigured' && <Alert type="warning" title="材料可保存，问答准备尚未配置" action={canWrite ? <Button href="/dashboard/system/diagnostics">检查配置</Button> : undefined}/>}
  {capability?.status === 'error' && <Alert type="error" title={capability.message} action={<Button onClick={() => void refresh()}>重新检查</Button>}/>}
  <Card title={<Flex gap={8} align="center" wrap><span>材料</span><Typography.Text type="secondary" style={{fontSize:13, fontWeight:400}}>{loading || error ? '正在读取' : `共${total}份 · ${available}份可用`}</Typography.Text></Flex>} extra={<Flex gap={8} wrap><Button loading={loading} onClick={() => void refresh()}>刷新</Button>{canWrite && <Button type="primary" onClick={() => protect(() => openCreate())}>添加材料</Button>}</Flex>}>
   <Flex gap={8} wrap style={{marginBottom:16}}>
    <Input aria-label="知识标题搜索" placeholder="查找材料" value={filter} onChange={e => setFilter(e.target.value)} allowClear style={{flex:1, minWidth:180}}/>
    <Select aria-label="知识类型筛选" placeholder="全部类别" allowClear value={kindFilter} onChange={setKindFilter} style={{width:180}} options={Object.entries(labels).map(([value,label]) => ({value,label}))}/>
    <Select aria-label="知识状态筛选" placeholder="全部状态" allowClear value={stateFilter} onChange={setStateFilter} style={{width:140}} options={[{value:'ready',label:'当前可用'},{value:'draft',label:'待审核'},{value:'failed',label:'准备失败'}]}/>
   </Flex>
   <Table rowKey="id" loading={loading} dataSource={groups} pagination={{pageSize:8}} scroll={narrow?undefined:{x:650}} locale={{emptyText:error ? '材料读取失败，请重新加载' : <Empty description={filter || kindFilter || stateFilter ? '没有符合筛选的材料' : '添加并审核材料后，可用于智能分析'}/>}} columns={[
    {title:'材料', render:(_,g) => <Flex vertical gap={narrow?8:0}><Typography.Text strong>{g.current?.title ?? g.latest.title}</Typography.Text><Typography.Text type="secondary">{labels[g.latest.kind]}</Typography.Text>{narrow&&<>{groupStatus(g)}<Button size="small" style={{alignSelf:'flex-start'}} onClick={() => void view((g.pending ?? g.current ?? g.latest).id)}>{primaryLabel(g)}</Button></>}</Flex>},
    {title:'可用状态', responsive:['md'], render:(_,g) => groupStatus(g)},
    {title:'更新时间', responsive:['md'], render:(_,g) => new Date(g.latest.updatedAt).toLocaleDateString('zh-CN')},
    {title:'操作', responsive:['md'], render:(_,g) => <Flex gap={4} wrap><Button onClick={() => void view((g.pending ?? g.current ?? g.latest).id)}>{primaryLabel(g)}</Button>{g.current && g.pending && <Button type="link" onClick={() => void view(g.current!.id)}>生效版</Button>}</Flex>},
   ]} expandable={{expandedRowRender:g => <Table size="small" rowKey="id" pagination={false} scroll={{x:420}} dataSource={g.versions} columns={[{title:'历史版本',render:(_,s) => 'v'+s.version},{title:'状态',render:(_,s) => badges(s)},{title:'操作',render:(_,s) => <Button onClick={() => void view(s.id)}>查看此版本</Button>}]}/>}}/>
  </Card>
  <Collapse items={[
   {key:'search', label:'检索测试', children:<Flex vertical gap={12}>
    <Flex gap={8} wrap><Input aria-label="检索问题" value={query} maxLength={1000} placeholder="例如：请假是否计入应出勤？" onChange={e => setQuery(e.target.value)} onPressEnter={() => void search()} style={{flex:1, minWidth:180}}/><Button type="primary" disabled={!query.trim() || capability?.status !== 'ready'} loading={searching} onClick={() => void search()}>检索</Button></Flex>
    <Typography.Text type="secondary">匹配度表示材料与问题的语义接近程度，不是答案准确率。</Typography.Text>
    {searchMessage && (searchFailed ? <Alert type="error" title={searchMessage} action={<Button loading={searching} onClick={() => void search()}>重试</Button>}/> : <Typography.Text>{searchMessage}</Typography.Text>)}
    {result?.hits.map(hit => <Card key={hit.id} size="small" title={hit.title+' · v'+hit.version} extra={<Flex gap={8} wrap><Tag color="blue">匹配度 {(Math.max(0,Math.min(1,hit.similarity))*100).toFixed(1)}%</Tag><Button onClick={() => void view(hit.sourceId)}>查看来源</Button></Flex>}><MarkdownContent content={hit.text}/></Card>)}
    {result && !result.hits.length && <Empty description="暂无相关知识依据"/>}
   </Flex>},
   {key:'explanation', label:'材料如何生效', children:<Typography.Paragraph style={{marginBottom:0}}>保存草稿后，核对正文并审核具体版本。准备成功后才用于智能分析；新版准备失败时，已有生效版继续使用。修改已审核正文需要创建新版，历史来源和引用仍可查看。</Typography.Paragraph>},
  ]}/>
  <Modal open={editor.open} title={editor.editing ? '编辑材料草稿' : editor.base ? '创建材料新版本' : '添加材料'} width={820} okText="保存并核对" cancelText="返回" confirmLoading={saving} onOk={() => void save()} onCancel={() => protect(closeEditor)}>
   <Form form={form} layout="vertical" onValuesChange={markDirty}>
    <Form.Item name="title" label="标题" rules={[{required:true,message:'请输入标题'}]}><Input maxLength={160}/></Form.Item>
    <Form.Item name="kind" label="类别" rules={[{required:true,message:'请选择类别'}]}><Select disabled={!!editor.base} options={Object.entries(labels).map(([value,label]) => ({value,label}))}/></Form.Item>
    {kind === 'analysis_snapshot' && !editor.base && <Form.Item name="reportId" label="摘要来源报告" rules={[{required:true,message:'请选择成功报告，以便绑定数据依据'}]} extra="自动保留报告周期、截止时间和数据依据。"><Select aria-label="摘要来源报告" placeholder="选择已完成周报或月报" options={reports.map(r => ({value:r.id,label:(r.kind === 'monthly' ? '月报' : '周报')+' · '+r.snapshot.dataset.name+' · '+r.snapshot.scope.startDate+' 至 '+r.snapshot.scope.endDate}))} onChange={id => {const report = reports.find(r => r.id === id); if(!report) return; form.setFieldsValue({content:[report.answer?.summary,...(report.answer?.hypotheses ?? []).map(t => '待验证原因：'+t),...(report.answer?.recommendations ?? []).map(t => '行动建议：'+t)].join('\n\n')}); markDirty();}}/></Form.Item>}
    <Form.Item name="content" label="正文" rules={[{required:true,message:'请输入正文'}]}><Input.TextArea aria-label="知识正文" rows={10} maxLength={20000} showCount/></Form.Item>
   </Form>
   <Flex gap={8} wrap>
    <Button icon={<FileTextOutlined/>} disabled={saving || !knowledgeExamples.some(e => e.kind === kind)} onClick={() => setTemplateOpen(true)}>使用模板</Button>
    <Upload accept=".txt,.md,.markdown" showUploadList={false} beforeUpload={importText} disabled={saving}><Button icon={<ImportOutlined/>}>导入文本</Button></Upload>
    <Button disabled={!content} onClick={() => setPreviewOpen(true)}>阅读预览</Button>
   </Flex>
  </Modal>
  <Modal open={templateOpen && editor.open} title="选择当前类别的模板" width={520} footer={null} onCancel={() => setTemplateOpen(false)}><Select aria-label="示例材料" value={undefined} placeholder="选择示例材料" style={{width:'100%'}} options={knowledgeExamples.filter(e => e.kind === kind).map(e => ({value:e.title,label:e.title}))} onChange={applyTemplate}/></Modal>
  <Modal open={previewOpen && editor.open} title="阅读预览" width={820} footer={<Button onClick={() => setPreviewOpen(false)}>返回编辑</Button>} onCancel={() => setPreviewOpen(false)}><MarkdownContent content={content ?? ''}/></Modal>
  <Modal open={!!selected} title={selected ? selected.title+' · v'+selected.version : ''} width={850} onCancel={() => setSelected(null)} footer={selected ? <Flex justify="end" gap={8} wrap>{canWrite && selected.status === 'draft' && <Button disabled={!!indexingId} onClick={() => openCreate(selected,true)}>编辑草稿</Button>}{canWrite && <Button disabled={!!indexingId} onClick={() => openCreate(selected)}>创建新版</Button>}{canWrite && selected.status !== 'superseded' && needsAction && <Button type="primary" loading={indexingId === selected.id} onClick={() => confirmApprove(selected)}>{selected.status === 'draft' ? '核对并审核' : '重试准备'}</Button>}<Button onClick={() => setSelected(null)}>关闭</Button></Flex> : null}>
   {selected && <Flex vertical gap={14}>
    {badges(selected)}
    {usable(selected) && <Alert type="success" title="已可用于智能分析" action={<Button href="/dashboard/agent">开始分析</Button>}/>}
    {selected.status === 'draft' && selected.indexStatus !== 'failed' && selected.indexStatus !== 'indexing' && <Alert type="info" title="请核对正文，再审核此版本"/>}
    {selected.indexStatus === 'indexing' && <Alert type={indexExpired ? 'warning' : 'info'} title={indexExpired ? '准备已超时，可刷新状态或重试' : '正在准备，请稍后刷新查看'} action={<Button onClick={() => void view(selected.id)}>刷新状态</Button>}/>}
    {selected.error && <Alert type="error" title={selected.error} description={!selected.isCurrent && sources.some(s => s.logicalSourceId === selected.logicalSourceId && usable(s)) ? '已有生效版本继续可用。' : undefined}/>}
    <MarkdownContent content={selected.content}/>
    {selected.period && <Typography.Text type="secondary">历史统计期：{selected.period.startDate} 至 {selected.period.endDate}；截止：{selected.dataCutoff}</Typography.Text>}
    <details><summary>来源与版本依据</summary><Typography.Paragraph>{selected.id} · v{selected.version}</Typography.Paragraph>{selected.evidence.map(e => <Typography.Paragraph key={e.id}>{e.summary}</Typography.Paragraph>)}</details>
   </Flex>}
  </Modal>
 </Flex>;
}
