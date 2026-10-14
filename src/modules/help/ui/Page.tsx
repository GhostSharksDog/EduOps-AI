'use client';
import {useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Collapse,Flex,Typography} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import type {DatasetVO} from '@/modules/education/contracts';
import {datasetAnalysisType} from '@/modules/education/contracts';
import ResumeJourney from './ResumeJourney';
import {analysisHref,selectionFromSearch} from '@/shared/lib/analysis-navigation';
import type {AnalysisSelection} from '@/shared/lib/analysis-navigation';
const sections=[
 {id:'data',title:'1. 选择数据模式和分析范围',path:'/dashboard',where:'运营总览 → 修改范围 → 选择数据来源与周期 → 应用。',input:'完整业务演示选择第三版模拟数据，统计期2026-08-01至2026-08-31，课程选择少儿编程。公开学习用课程批次与相对日；财务案例只选年度。',expected:'看到数据来源标识、截止时间、指标及趋势。缺失数据应显示未知或待观察。',error:'没有数据集：前往工作台的数据中心导入；字段不完整：查看导入批次质量报告。三种来源不能合并成同一家机构的经营流水。'},
 {id:'knowledge',title:'2. 准备业务知识',path:'/dashboard/knowledge',where:'工作台 → 业务知识 → 核对草稿 → 核对并审核。',input:'先审核出勤、续费、运营标签与模拟服务流程；财务模式审核财务口径。审核的是具体版本，不是所有未来修改。',expected:'状态为当前可用；展开检索测试可查看原文与来源版本。',error:'准备失败：检查向量模型配置后重试。旧版仍有效时继续可用；未审核草稿不能用于正式问答。'},
 {id:'agent',title:'3. 分析问题',path:'/dashboard/agent',where:'智能分析 → 修改范围并应用 → 输入问题 → 提交分析。',input:'例：查询当前指标并检索口径，解释出勤变化，创建出勤率低于80%、应出勤至少4次的运营标签，并预览覆盖范围。',expected:'先看到结论、关键数字和行动建议；查看完整分析可展开待验证原因与数据依据。已有会话的范围固定。',error:'范围要改：新建会话；调用失败：查看保存的步骤，不重复发布。没有模型配置仍可手工设置运营标签。'},
 {id:'tag',title:'4. 预览并人工发布运营标签',path:'/dashboard/tags/risk',where:'标签与人群 → 标签规则 → 设置规则 → 预览名单 → 确认发布。',input:'确认同校区同课程条件、统计周期、规则版本、覆盖人数和未知人数。组合最多5个条件，选择全部满足或任一满足。',expected:'发布的是当前预览对应版本；改条件后旧预览失效。人数来自实际计算，不是模型估计。',error:'未发布预览有效期30分钟；预览过期、版本变化或批次更新：重新预览后确认；未知签到不是缺勤。公开学习和集团财务不生成经营标签。'},
 {id:'segment',title:'5. 保存人群与查看画像',path:'/dashboard/segments/risk',where:'标签发布后 → 保存人群；随后进入标签与人群 → 已保存人群 → 查看画像。',input:'填写人群名称，确认绑定的标签版本；查看出勤、到期、课时余额、客诉分布，点击成员打开个人抽屉。',expected:'人数与发布预览一致。已保存人群保留当时名单，后续数据不会自动改变；画像注明统计期或截止日。',error:'没有人群：仅发布标签不会自动保存人群，返回标签规则确认建立。名单不会随新导入静默改写。'},
 {id:'alert',title:'6. 评估并处理预警',path:'/dashboard/alerts',where:'行动中心 → 异常预警 → 选择相同范围 → 评估规则 → 查看依据 → 确认关注或标记处理。',input:'查看命中数字、阈值、两期分子分母和最小样本量；必要时进入智能分析查询校区或课程拆解。',expected:'管理员可发布阈值与样本配置，预警冻结规则版本；历史回放只查询，不生成正式预警。数据不足单列，独立标注后才能计算误报和漏报。',error:'没有预警不等于没有问题：先检查是否评估过、是否达到样本量。预警不会自动发布标签或创建人群。'},
 {id:'report',title:'7. 生成周报或月报',path:'/dashboard/reports',where:'行动中心 → 分析报告 → 选择周期和范围 → 生成报告 → 查看详情或导出。',input:'月报按自然月，周报按周一至周日；经营演示月报选2026年8月，课程少儿编程。',expected:'先冻结本期与对比期数字，再生成摘要与建议；完整分析和数据依据按需展开。',error:'模型失败保留计算数据和失败状态，不能当作成功报告。报告不是自动定时发送，需要点击生成。'},
 {id:'decision',title:'8. 采纳建议、执行并复核',path:'/dashboard/decisions',where:'智能分析或报告的行动建议 → 核对建议并建立任务；也可进入行动中心处理。',input:'填写具体动作、责任人、优先级、期限、复核方法和可选同范围已确认人群。选择采纳、暂缓或不采纳。',expected:'新任务可在执行前设置最多三个量化目标和复核周期；提交复核先计算前后对比，再确认冻结。未设置目标的旧任务仅作描述性对比，变化不自动证明因果。',error:'旧版本提示：刷新任务后重试；只读账号不能修改。模拟任务和反馈必须标演示，不冒充真实经营改善。'},
 {id:'finance',title:'9. 阅读真实年度财务案例',path:'/dashboard',where:'运营总览 → 修改范围 → 选择昂立教育年度公开财务案例 → 选择年度并应用 → 智能分析。',input:'2023—2025年度集团合并收入、成本、销售费用、管理费用；金额原单位人民币元，卡片换算亿元。',expected:'毛利=收入−营业成本；毛利率、费用率分母为收入。每项可回查原始金额、年报页码、披露时间及旧来源。',error:'没有年度对比留空。集团年报不提供学员签到、月度利润、校区利润或渠道获客成本。'},
 {id:'channels',title:'11. 核对来源渠道',path:'/dashboard/channels',where:'渠道分析 → 选择统计周期、校区、课程和渠道 → 查看八项指标与招生批次。',input:'查看首购来源、续费继承、未知来源及对应证据；选择渠道会同步影响Agent、标签、人群和报告。',expected:'各渠道分别计算分子分母；同学员跨课程可能出现在不同渠道。满班指标在渠道范围显示为渠道席位贡献率。',error:'缺少明确线索或合约关联会显示未知来源，不依据姓名或手机号猜测；没有渠道支出就不计算获客成本和ROI。'},
 {id:'environment',title:'12. 检查环境并恢复操作',path:'/dashboard/system/diagnostics',where:'工作台 → 系统管理 → 运行诊断 → 重新检查 → 按具体状态打开恢复入口。',input:'管理员或运营人员查看数据库连接、必要结构和模型配置；已有库仅追加开发说明列出的字段。',expected:'检查就绪、配置不足和连接失败分别显示；不展示密钥，检查不会改动数据或联网调用模型。',error:'先启动数据库服务，再核对配置。模型实际可用性在知识准备或智能分析时验证；只读账号需要联系有操作权限的账号。'},
 {id:'evaluation',title:'10. 记录研究评价',path:'/dashboard/evaluation',where:'工作台 → 研究评价 → 选择成功冻结报告 → 生成三方案对照 → 并排阅读 → 人工评分 → 导出历史和汇总。',input:'同一冻结数据比较固定模板、直接模型、工具辅助Agent；按数字一致性、证据支持、洞察、可执行性与清晰度各1—5分，并写评分者、情境及依据。',expected:'未评分显示待评阅，失败显示失败；实际输入、模型和知识版本可查。每个账号的最新评分计入均分，历史保留；输入不全的旧样本不纳入严格对照。',error:'情境演示不是实际使用者采用率；论文及真人试用评价仍需完成。不要为了显示结果填写未经开展的实验分数。'},
];
export default function Page(){
 const token=useAuthStore(s=>s.token),[datasets,setDatasets]=useState<DatasetVO[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[openSections,setOpenSections]=useState<string[]>([]),[referenceOpen,setReferenceOpen]=useState<string[]>([]),[currentSelection,setCurrentSelection]=useState<AnalysisSelection|null>(null),[currentSearch,setCurrentSearch]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);try{const response=await fetch('/api/education/datasets',{headers:{Authorization:'Bearer '+token}}),body=await response.json();if(!response.ok)throw Error(body.message??'数据范围读取失败');setDatasets(body.data??[]);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[token]);
 useEffect(()=>{
  void refresh();setCurrentSelection(selectionFromSearch(window.location.search));setCurrentSearch(window.location.search);
  const open=()=>{const hash=window.location.hash.slice(1);if(sections.some(s=>s.id===hash)){setReferenceOpen(['reference']);setOpenSections([hash]);}else setOpenSections([]);};
  open();window.addEventListener('hashchange',open);return()=>window.removeEventListener('hashchange',open);
 },[refresh]);
 const finance=datasets.find(d=>datasetAnalysisType(d)==='finance');
 const simulation=datasets.find(d=>datasetAnalysisType(d)==='operations'&&d.schemaVersion==='3');
 const selectedDataset=datasets.find(d=>d.id===currentSelection?.datasetId),selection=currentSelection&&selectedDataset&&datasetAnalysisType(selectedDataset)==='operations'?currentSelection:simulation?{datasetId:simulation.id,scope:{startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:['sim:course:1'],channelIds:[],dataCutoff:simulation.dataCutoff}}:null;
 const href=(path:string,extras?:Record<string,string>)=>selection?analysisHref(path,selection,extras):path;
 const currentParams=new URLSearchParams(currentSearch),currentDataset=datasets.find(d=>d.id===currentParams.get('datasetId'));
 const publicSelection=currentDataset&&datasetAnalysisType(currentDataset)!=='operations'&&(currentParams.has('learningScope')||currentParams.has('financeScope'));
 const analyseHref=publicSelection?'/dashboard'+currentSearch:href('/dashboard',{review:'attendance'});
 const contextualHref=(path:string)=>publicSelection&&['/dashboard','/dashboard/agent','/dashboard/decisions'].includes(path)?path+currentSearch:href(path);
 return <Flex vertical gap={18}>
  <div className="business-page-header"><Typography.Title level={2}>操作指南</Typography.Title></div>
  {error&&<Alert type="warning" title={error} action={<Button loading={loading} onClick={()=>void refresh()}>重新加载</Button>}/>}
  <div className="help-task-grid">
   <Card title="分析问题"><Typography.Paragraph>先看关键指标，再解释变化并安排下一步。</Typography.Paragraph><Button type="primary" disabled={loading} href={analyseHref}>从看板开始</Button></Card>
   <Card title="创建标签与人群"><Typography.Paragraph>设置条件，预览名单，确认后保存人群。</Typography.Paragraph><Button disabled={loading||!selection} href={href('/dashboard/tags/risk',{review:'combination'})}>设置标签规则</Button>{!loading&&!selection&&<Typography.Paragraph type="secondary" style={{marginTop:8,marginBottom:0}}>请先在工作台导入经营数据。</Typography.Paragraph>}</Card>
   <Card title="处理决策任务"><Typography.Paragraph>安排执行动作、责任人和期限，再复核结果。</Typography.Paragraph><Button href={publicSelection?contextualHref('/dashboard/decisions'):currentSelection?href('/dashboard/decisions'):'/dashboard/decisions'}>查看待办</Button></Card>
  </div>
  <ResumeJourney/>
  <Collapse activeKey={referenceOpen} onChange={keys=>setReferenceOpen(typeof keys==='string'?[keys]:keys)} items={[
   {key:'reference',label:'查阅完整操作说明与截图',children:<Collapse activeKey={openSections} onChange={keys=>setOpenSections(typeof keys==='string'?[keys]:keys)} items={[...sections].sort((a,b)=>Number(a.title.split('.')[0])-Number(b.title.split('.')[0])).map(section=>({key:section.id,label:section.title,children:<div id={section.id}>
    <Flex justify="end"><Button href={section.id==='finance'&&finance?'/dashboard?'+new URLSearchParams({datasetId:finance.id,financeScope:JSON.stringify({years:[]})}):['knowledge','evaluation','environment'].includes(section.id)?section.path:contextualHref(section.path)}>前往操作</Button></Flex>
    <Typography.Paragraph><b>在哪里操作：</b>{section.where}</Typography.Paragraph><Typography.Paragraph><b>填写什么：</b>{section.input}</Typography.Paragraph><Typography.Paragraph><b>应看到什么：</b>{section.expected}</Typography.Paragraph><Alert type="info" title="遇到问题时" description={section.error}/>
    {['data','tag','segment','decision'].includes(section.id)&&<details style={{marginTop:12}}><summary>查看实际页面截图（模拟数据）</summary><img src={'/help/'+section.id+'.png'} alt={section.title+'实际操作页面'} loading="lazy" style={{width:'100%',borderRadius:8,marginTop:12}}/></details>}
   </div>}))}/>},
   {key:'modes',label:'数据来源与业务流程',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>模拟经营用于完整操作闭环；匿名公开OULAD用于学习分析；公开年报用于年度财务案例，三种来源分别统计。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>线索获取 → 试听 → 签约 → 上课与课耗 → 续费／正常结课／退班。转介绍连接新线索，客诉退款作为服务事件单独记录。</Typography.Paragraph></Flex>},
   {key:'requirements',label:'研究评价与后续工作',children:<Typography.Paragraph style={{marginBottom:0}}>系统提供业务指标、看板、预警、智能分析、业务知识、报告、运营标签、人群画像和决策任务。成本分析使用独立集团年度案例，完整业务操作使用模拟数据。报告质量、预警时效和真实采用率需要实际评价，真人评分保持待评阅。真实机构流水接入前需验证授权、匿名化和脱敏。</Typography.Paragraph>},
  ]}/>
 </Flex>;
}
