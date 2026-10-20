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
 {id:'workbench',title:'0. 从工作台继续我的工作',path:'/dashboard/workbench',where:'左侧工作台 → 我的工作；查找其他入口时切换全部功能或使用功能搜索。',input:'选择全部、任务、方案或材料；待办只显示本人负责或创建的记录，不用先选择经营周期。',expected:'看到待处理事项和最多六条最近保存的工作。点击记录进入它自己的来源与范围；高级配置默认折叠。登录后仍进入运营总览。',error:'某类读取失败时数量显示未知，点击重试。只读账号可以查看；确认发布、审核、安排和执行仍需在原页面核对，工作台不会自动执行。'},
 {id:'workspace',title:'0. 使用分区工作台',path:'/dashboard/agent',where:'左侧导航进入功能；总览左侧看图、右侧看事项，智能分析左侧交流、右侧查看所选回答的结果。',input:'范围在工具栏调整；历史会话从入口打开。标签、人群、任务、知识和报告先在目录选一条，再在旁边继续操作。',expected:'长对话不会把输入框推走；右侧可切换结果、操作计划和数据依据。手机通过对话／结果或列表／详情切换，返回不会重新选择。',error:'准备操作后仍需页面确认。查看历史结果时先核对它自己的周期和截止，不把下一轮范围当作历史依据；未保存修改先保存或放弃再切换。'},
 {id:'data',title:'1. 选择数据模式和分析范围',path:'/dashboard',where:'运营总览 → 修改范围 → 选择数据来源与周期 → 应用。',input:'完整业务演示选择第三版模拟数据，统计期2026-08-01至2026-08-31，课程选择少儿编程。公开学习用课程批次与相对日；财务案例只选年度。',expected:'看到数据来源标识、截止时间、指标及趋势。缺失数据应显示未知或待观察。',error:'没有数据集：前往工作台的数据中心导入；字段不完整：查看导入批次质量报告。三种来源不能合并成同一家机构的经营流水。'},
 {id:'knowledge',title:'2. 准备业务知识',path:'/dashboard/knowledge',where:'工作台 → 业务知识 → 核对草稿 → 核对并审核。',input:'先审核出勤、续费、运营标签与模拟服务流程；财务模式审核财务口径。审核的是具体版本，不是所有未来修改。',expected:'状态为当前可用；展开检索测试可查看原文与来源版本。',error:'准备失败：检查向量模型配置后重试。旧版仍有效时继续可用；未审核草稿不能用于正式问答。'},
 {id:'agent',title:'3. 分析问题',path:'/dashboard/agent',where:'智能分析 → 选择范围 → 输入问题 → 发送；分析后继续追问或核对操作计划。',input:'例：帮我看看出勤为什么下降。随后追问：把这批学员建成人群，并准备一项跟进任务。助手会查询指标、拆解课程，预览规则并给出操作计划。',expected:'可以连续追问，也可以让助手准备标签、人群、报告和跟进任务。需要补充信息时先回答澄清问题；每一轮显示自己的范围与数据依据。',error:'修改范围用于下一轮，历史结果不变；切换数据来源时核对提示。调用失败保留事实与草稿，先看失败步骤再恢复；只读账号可查询，不能执行业务写入。'},
 {id:'tag',title:'4. 预览并人工发布运营标签',path:'/dashboard/tags/risk',where:'标签与人群 → 标签规则 → 设置规则 → 预览名单 → 确认发布。',input:'确认同校区同课程条件、统计周期、规则版本、覆盖人数和未知人数。组合最多5个条件，选择全部满足或任一满足。',expected:'发布的是当前预览对应版本；改条件后旧预览失效。人数来自实际计算，不是模型估计。',error:'未发布预览有效期30分钟；预览过期、版本变化或批次更新：重新预览后确认；未知签到不是缺勤。公开学习和集团财务不生成经营标签。'},
 {id:'segment',title:'5. 保存人群与查看画像',path:'/dashboard/segments/risk',where:'标签发布后 → 保存人群；随后进入标签与人群 → 已保存人群 → 查看画像。',input:'填写人群名称，确认绑定的标签版本；查看出勤、到期、课时余额、客诉分布，点击成员打开个人抽屉。',expected:'人数与发布预览一致。已保存人群保留当时名单，后续数据不会自动改变；画像注明统计期或截止日。',error:'仅发布标签不会自动保存人群；可回标签规则确认，或让智能分析准备保存人群计划，核对后执行。名单不会随新导入静默改写。'},
 {id:'alert',title:'6. 评估并处理预警',path:'/dashboard/alerts',where:'行动中心 → 异常预警 → 选择相同范围 → 评估规则 → 查看依据 → 确认关注或标记处理。',input:'查看命中数字、阈值、两期分子分母和最小样本量；必要时进入智能分析查询校区或课程拆解。',expected:'管理员可发布阈值与样本配置，预警冻结规则版本；历史回放只查询，不生成正式预警。数据不足单列，独立标注后才能计算误报和漏报。',error:'没有预警不等于没有问题：先检查是否评估过、是否达到样本量。预警不会自动发布标签或创建人群。'},
 {id:'report',title:'7. 生成周报或月报',path:'/dashboard/reports',where:'行动中心 → 报告。左侧选择记录，右侧阅读；生成入口选择周期与范围后确认，详情仍可独立打开。',input:'月报按自然月，周报按周一至周日；经营演示月报选2026年8月，课程少儿编程。',expected:'先冻结本期与对比期数字，再生成摘要与建议；完整分析和数据依据按需展开。',error:'模型失败保留计算数据和失败状态，不能当作成功报告。报告不是自动定时发送，需要点击生成。'},
 {id:'decision',title:'8. 采纳建议、执行并复核',path:'/dashboard/decisions',where:'行动中心左侧切换任务与建议，选择一条后在右侧核对安排、记录执行或填写复核。',input:'填写具体动作、责任人、优先级、期限、复核方法和可选同范围已确认人群。选择采纳、暂缓或不采纳。',expected:'新任务可在执行前设置最多三个量化目标和复核周期；提交复核先计算前后对比，再确认冻结。未设置目标的旧任务仅作描述性对比，变化不自动证明因果。',error:'旧版本提示：刷新任务后重试；只读账号不能修改。模拟任务和反馈必须标演示，不冒充真实经营改善。'},
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
   {key:'spatial-workspace',label:'使用新版工作区',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>总览点击指标切换主图，右侧编号事项可直接进入处理；“查看口径与依据”保留计算说明。工作台提供两个重点入口和四个常用入口，已保存工作仍可从待办和最近工作继续。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>智能分析左侧交流、右侧查看结果，输入区始终留在对话底部。行动中心选择任务后先看执行动作、负责人和期限，需要时展开来源、复核及记录。系统启用减少动画时，页面直接显示最终状态，操作方式相同。</Typography.Paragraph></Flex>},
   {key:'assistance-agent',label:'继续分析、看图表与等待时操作',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>在输入框填写问题，Enter换行，Ctrl／Command + Enter发送；中文组词确认不会触发快捷发送。发送按钮在输入框下方右侧，长问题会在输入框内滚动。“查看新消息”只滚动对话，不会清空正在写的问题。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>每条结果按实际状态给出最多两个下一步。单项普通补充信息可直接选择，多项条件选齐后点击“补充并继续”。已有未提交文字时先选择保留或放弃；发布、保存人群和执行任务仍需核对操作卡。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>有查询数据时可切换趋势或对比图，打开数据表核对未知值、单位与来源，点击“查看数据依据”定位证据。旧记录不会用当前数字补图；历史回答与下一轮范围不同，先明确选择“按该回答范围继续”。</Typography.Paragraph><Alert type="info" title="等待时可以继续工作" description="可以起草下一问、查看历史或切换会话，本轮结束不会清空后来写的草稿。同一会话等待后再发送；已开始的分析可从历史会话或工作台最近工作查看，离开不代表取消。草稿只暂存于当前应用会话，关闭窗口前请留意提醒。"/></Flex>},
   {key:'reference',label:'查阅完整操作说明与截图',children:<Collapse activeKey={openSections} onChange={keys=>setOpenSections(typeof keys==='string'?[keys]:keys)} items={[...sections].sort((a,b)=>Number(a.title.split('.')[0])-Number(b.title.split('.')[0])).map(section=>({key:section.id,label:section.title,children:<div id={section.id}>
    <Flex justify="end"><Button href={section.id==='finance'&&finance?'/dashboard?'+new URLSearchParams({datasetId:finance.id,financeScope:JSON.stringify({years:[]})}):['knowledge','evaluation','environment','workbench'].includes(section.id)?section.path:contextualHref(section.path)}>前往操作</Button></Flex>
    <Typography.Paragraph><b>在哪里操作：</b>{section.where}</Typography.Paragraph><Typography.Paragraph><b>填写什么：</b>{section.input}</Typography.Paragraph><Typography.Paragraph><b>应看到什么：</b>{section.expected}</Typography.Paragraph><Alert type="info" title="遇到问题时" description={section.error}/>
    {['workbench','data','tag','segment','decision'].includes(section.id)&&<details style={{marginTop:12}}><summary>{section.id==='workbench'?'查看工作台实际页面截图':'查看实际页面截图（模拟数据）'}</summary><img src={'/help/'+section.id+'.png'} alt={section.title+'实际操作页面'} loading="lazy" style={{width:'100%',borderRadius:8,marginTop:12}}/></details>}
   </div>}))}/>},
   {key:'company-agent',label:'公司登录、连续交流与操作确认',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>登录页先选择所属公司，再输入本地账号。同名账号在不同公司分别管理，当前公司显示在页面顶部。切换公司请先退出；旧请求、页面结果及查询缓存会清理。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>普通使用问题可以直接问，不必预先知道指标名称。遇到对象不明确时，选择助手给出的候选项并发送。修改周期、校区或课程用于下一轮提问，历史回答和操作计划保留自身范围。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>助手可以查询数据、保存草稿和预览覆盖范围。发布标签、保存人群、建立任务和生成报告需核对操作卡；修改计划后确认新版本。聊天里的“确认”不能替代页面确认按钮。</Typography.Paragraph><Alert type="info" title="部分操作未完成时" description="先查看每一步结果。恢复只执行未完成步骤，不重复创建已有对象。计划或预览过期需要重新准备；知识草稿仍需人工审核与索引。"/></Flex>},
   {key:'task-agent',label:'当前任务与失败恢复',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>智能分析顶部展开“当前任务”，查看目标、条件、所选对象和待补信息；修改后保存，或清除当前任务开始新的目标。清除不会删除对话、标签或人群。范围变化或对象版本变化时，按提示重新核对。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>助手会按指导、分析、规则和业务方案选择合适的工具。目标不明确时先补充条件，正式发布和执行仍需页面确认。</Typography.Paragraph><Alert type="info" title="部分完成：数据已查到，分析尚未完整" description="事实卡和图表保留已查询数据，未通过核对的结论、原因与建议不展示。要求课程拆解却尚未完成查询时，点击“重新查询”补齐，不能仅靠重写文字完成。必要工具齐全且具备完整冻结依据时才可“仅重试解读”；原失败保留，不重建草稿或执行原计划。提示依据变化、记录过旧或业务错误时也需重新查询。修改任务发生版本冲突时核对最新内容，原输入仍保留。"/></Flex>},
   {key:'modes',label:'数据来源与业务流程',children:<Flex vertical gap={12}><Typography.Paragraph style={{marginBottom:0}}>模拟经营用于完整操作闭环；匿名公开OULAD用于学习分析；公开年报用于年度财务案例，三种来源分别统计。</Typography.Paragraph><Typography.Paragraph style={{marginBottom:0}}>线索获取 → 试听 → 签约 → 上课与课耗 → 续费／正常结课／退班。转介绍连接新线索，客诉退款作为服务事件单独记录。</Typography.Paragraph></Flex>},
   {key:'requirements',label:'研究评价与后续工作',children:<Typography.Paragraph style={{marginBottom:0}}>系统提供业务指标、看板、预警、智能分析、业务知识、报告、运营标签、人群画像和决策任务。成本分析使用独立集团年度案例，完整业务操作使用模拟数据。报告质量、预警时效和真实采用率需要实际评价，真人评分保持待评阅。真实机构流水接入前需验证授权、匿名化和脱敏。</Typography.Paragraph>},
  ]}/>
 </Flex>;
}
