'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Button,DatePicker,Drawer,Flex,Select,Tag,Typography} from 'antd';
import dayjs from 'dayjs';
import {useAuthStore} from '@/modules/identity/client';
import type {DatasetVO} from '@/modules/education/contracts';
import {selectionFromSearch,scopeKey,analysisHref} from '@/shared/lib/analysis-navigation';
import type {AnalysisSelection} from '@/shared/lib/analysis-navigation';
export type SelectedScope=AnalysisSelection;
export default function ScopePicker({onChange,monthly=false,value,datasetId,hideDataset=false,disabled=false,syncUrl=true}:{onChange:(selection:SelectedScope)=>void;monthly?:boolean;value?:SelectedScope|null;datasetId?:string;hideDataset?:boolean;disabled?:boolean;syncUrl?:boolean}){
 const token=useAuthStore(s=>s.token),[open,setOpen]=useState(false),[draft,setDraft]=useState<SelectedScope|null>(null),[datasets,setDatasets]=useState<DatasetVO[]>([]),[selection,setSelection]=useState<SelectedScope|null>(null),[catalog,setCatalog]=useState<{id:string;kind:string;name:string}[]>([]),[channelOptions,setChannelOptions]=useState<{id:string;name:string}[]>([]),[channelError,setChannelError]=useState(''),[error,setError]=useState('');const callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>{const c=new AbortController();fetch('/api/education/datasets',{headers:{Authorization:'Bearer '+token},signal:c.signal}).then(async r=>{
  const b=await r.json();if(!r.ok)throw new Error(b.message??'数据集不可用');
  const available:DatasetVO[]=b.data.filter((d:DatasetVO)=>d.origin==='simulated');setDatasets(available);
  const d=datasetId?available.find(d=>d.id===datasetId):available.find(d=>d.schemaVersion==='3')??available.find(d=>d.schemaVersion==='2')??available[0];
  if(!d){setSelection(null);setError(datasetId?'所选数据集不能用于经营分析，请切换到学习分析。':'暂无经营数据集，请先导入教培模拟数据；公开学习数据在学习分析中查看。');return;}
  const incoming=selectionFromSearch(window.location.search),validIncoming=incoming&&(!datasetId||incoming.datasetId===datasetId)&&available.some(d=>d.id===incoming.datasetId)?incoming:null;
  const date=dayjs(d.dataCutoff).subtract(1,'month'),initial=validIncoming??{datasetId:d.id,scope:{startDate:date.startOf('month').format('YYYY-MM-DD'),endDate:date.endOf('month').format('YYYY-MM-DD'),campusIds:[],courseIds:[],channelIds:[],dataCutoff:d.dataCutoff}};
  setSelection(current=>current&&available.some(d=>d.id===current.datasetId)&&(!datasetId||current.datasetId===datasetId)?current:value&&available.some(d=>d.id===value.datasetId)&&(!datasetId||value.datasetId===datasetId)?value:initial);setError('');
 }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[token,datasetId]);
 useEffect(()=>{if(value&&(!datasetId||value.datasetId===datasetId)&&datasets.some(d=>d.id===value.datasetId)&&(!selection||scopeKey(value)!==scopeKey(selection)))setSelection(value);},[value,datasetId,datasets]);
 useEffect(()=>{if(selection&&(!datasetId||selection.datasetId===datasetId))callback.current(selection);},[selection,datasetId]);
 const startValue=useMemo(()=>draft?dayjs(draft.scope.startDate):null,[draft?.scope.startDate]),endValue=useMemo(()=>draft?dayjs(draft.scope.endDate):null,[draft?.scope.endDate]),cutoffValue=useMemo(()=>draft?.scope.dataCutoff?dayjs(draft.scope.dataCutoff):null,[draft?.scope.dataCutoff]);
 const active=open&&draft?draft:selection;
 useEffect(()=>{if(!active)return;const c=new AbortController();setCatalog([]);fetch('/api/education/datasets/'+active.datasetId,{headers:{Authorization:'Bearer '+token},signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.message??'目录不可用');setCatalog(b.data.catalog);setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[active?.datasetId,token]);
 const channelCatalogKey=active?JSON.stringify({datasetId:active.datasetId,endDate:active.scope.endDate,dataCutoff:active.scope.dataCutoff,campusIds:active.scope.campusIds,courseIds:active.scope.courseIds}):'';
 useEffect(()=>{if(!active)return;const c=new AbortController();setChannelError('');fetch('/api/analytics/channels/catalog',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...active,scope:{...active.scope,channelIds:[]}}),signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||b.status!=='ready')throw new Error(b.message??'渠道目录不可用');setChannelOptions(b.data);}).catch(e=>{if(e.name!=='AbortError'){setChannelOptions([]);setChannelError(e.message);}});return()=>c.abort();},[channelCatalogKey,token]);
 const change=(part:Partial<SelectedScope['scope']>)=>setDraft(s=>s?{...s,scope:{...s.scope,...part}}:s),dataset=datasets.find(d=>d.id===selection?.datasetId);
 const displayNames=(ids:string[])=>ids.length?ids.map(id=>catalog.find(c=>c.id===id)?.name??id).join('、'):'全部';
 const apply=()=>{if(!draft)return;setSelection(draft);setOpen(false);if(syncUrl){const next=new URL(analysisHref(window.location.pathname,draft),window.location.origin);window.history.replaceState(window.history.state,'',next);}};
 return <div className="scope-panel compact-scope-panel">
  {error&&<Alert type="error" title={error}/>}
  <Flex gap={10} align="center" justify="space-between" wrap>
   <Flex gap={8} align="center" wrap style={{minWidth:0,flex:1}}><Tag color="orange">模拟经营</Tag>{!hideDataset&&dataset&&<Typography.Text strong>{dataset.name}</Typography.Text>}{selection&&<><Typography.Text className="scope-period">{selection.scope.startDate}{!monthly&&' 至 '+selection.scope.endDate}</Typography.Text><Typography.Text type="secondary">校区：{displayNames(selection.scope.campusIds)} · 课程：{displayNames(selection.scope.courseIds)}</Typography.Text>{!!selection.scope.channelIds.length&&<Tag>渠道：{selection.scope.channelIds.map(id=>channelOptions.find(c=>c.id===id)?.name??(id==='__unknown__'?'未知来源':id)).join('、')}</Tag>}</>}</Flex>
   <Button size="small" disabled={disabled||!selection} onClick={()=>{setDraft(selection?{...selection,scope:{...selection.scope}}:null);setOpen(true);}}>修改范围</Button>
  </Flex>
  <Drawer title="修改分析范围" open={open} onClose={()=>setOpen(false)} width={440} extra={<Button type="primary" disabled={disabled||!draft||draft.scope.startDate>draft.scope.endDate} onClick={apply}>应用范围</Button>}>

  {error&&<Alert type="error" title={error}/>}
  {channelError&&<Alert type="warning" title={channelError} description="已选择的渠道仍保留，请重新加载目录后再更改。"/>}
  <Flex gap={16} vertical className="scope-editor-fields">
   {!hideDataset&&<Select aria-label="运营数据集" placeholder="选择经营数据集" className="scope-dataset" value={draft?.datasetId} options={datasets.map(d=>({value:d.id,label:'[模拟] '+d.name}))} onChange={id=>{const d=datasets.find(d=>d.id===id)!,date=dayjs(d.dataCutoff).subtract(1,'month');setDraft({datasetId:id,scope:{startDate:date.startOf('month').format('YYYY-MM-DD'),endDate:date.endOf('month').format('YYYY-MM-DD'),campusIds:[],courseIds:[],channelIds:[],dataCutoff:d.dataCutoff}});}}/>}
   {monthly?<DatePicker aria-label="报告日期" format="YYYY-MM-DD" style={{width:165,maxWidth:'100%',flex:'0 0 auto'}} allowClear={false} value={startValue} onChange={v=>{if(v)change({startDate:v.format('YYYY-MM-DD'),endDate:v.format('YYYY-MM-DD')});}}/>:
    <Flex role="group" aria-label="运营统计周期" gap={10} style={{flexDirection:'column',width:'100%',minWidth:0}}>
     <DatePicker aria-label="运营开始日期" placeholder="开始日期" format="YYYY-MM-DD" allowClear={false} style={{width:'100%',minWidth:0,flex:1}} value={startValue} disabledDate={date=>!!draft&&date.isAfter(dayjs(draft.scope.endDate),'day')} onChange={date=>{if(date)change({startDate:date.format('YYYY-MM-DD')});}}/>
     <DatePicker aria-label="运营结束日期" placeholder="结束日期" format="YYYY-MM-DD" allowClear={false} style={{width:'100%',minWidth:0,flex:1}} value={endValue} disabledDate={date=>!!draft&&date.isBefore(dayjs(draft.scope.startDate),'day')} onChange={date=>{if(date)change({endDate:date.format('YYYY-MM-DD')});}}/>
    </Flex>}
   <Select aria-label="预警报告校区" mode="multiple" placeholder="全部校区" style={{width:'100%'}} value={draft?.scope.campusIds??[]} options={catalog.filter(v=>v.kind==='campus').map(v=>({value:v.id,label:v.name}))} onChange={campusIds=>change({campusIds})}/>
   <Select aria-label="预警报告课程" mode="multiple" placeholder="全部课程" style={{width:'100%'}} value={draft?.scope.courseIds??[]} options={catalog.filter(v=>v.kind==='course').map(v=>({value:v.id,label:v.name}))} onChange={courseIds=>change({courseIds})}/>
   <Select aria-label="经营来源渠道" mode="multiple" placeholder="全部渠道（含未知）" style={{width:'100%'}} value={draft?.scope.channelIds??[]} options={[...channelOptions,...(draft?.scope.channelIds??[]).filter(id=>!channelOptions.some(c=>c.id===id)).map(id=>({id,name:id==='__unknown__'?'未知来源':id}))].map(v=>({value:v.id,label:v.name}))} onChange={channelIds=>change({channelIds})}/>
  </Flex>
  <details style={{marginTop:16}}><summary>数据截止设置</summary><DatePicker aria-label="经营数据截止时间" showTime format="YYYY-MM-DD HH:mm:ss" style={{width:'100%',marginTop:8}} value={cutoffValue} onChange={date=>change({dataCutoff:date?.toISOString()})}/></details>
  {draft&&<Typography.Paragraph type="secondary" style={{fontSize:12,margin:'10px 0 0',fontVariantNumeric:'tabular-nums'}}>{monthly?'报告所选日期':'统计周期'}：{draft.scope.startDate}{!monthly&&` 至 ${draft.scope.endDate}`}；数据截止：{draft.scope.dataCutoff||dataset?.dataCutoff?dayjs(draft.scope.dataCutoff??dataset?.dataCutoff).format('YYYY-MM-DD HH:mm:ss'):'未指定'}</Typography.Paragraph>}
  {dataset&&<Flex gap={8} wrap align="center" className="scope-source"><Tag color={dataset.origin==='simulated'?'orange':'blue'}>{dataset.origin==='simulated'?'模拟数据 · 演示与测试':'公开教育数据 · 独立统计'}</Tag><Typography.Text type="secondary">{dataset.origin==='simulated'?'所有经营记录为模拟，数字由业务程序计算。':'公开学习点击数据不替代逐课签到或经营流水。'}</Typography.Text><Typography.Text type="secondary">数据可用截至 {dataset.dataCutoff.slice(0,10)}</Typography.Text></Flex>}
  </Drawer>
 </div>;
}
